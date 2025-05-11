import argparse
import os
import subprocess
import json
import tempfile
import wave
import contextlib
import sys
import logging
from pathlib import Path
import pprint # For pretty printing the diarization object
import torch # Import torch

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Argument Parsing ---
parser = argparse.ArgumentParser(description='Transcribe audio/video file using Whisper and optionally perform speaker diarization.')
parser.add_argument('--input', required=True, help='Path to the input media file.')
parser.add_argument('--output-json', required=True, help='Path to save the output JSON file.')
parser.add_argument('--diarize', action='store_true', help='Perform speaker diarization.')
parser.add_argument('--hf-token', help='Hugging Face token for pyannote.audio.')
# Add Whisper model options if needed (e.g., --model, --language)
# parser.add_argument('--model', default='base', help='Whisper model name (e.g., tiny, base, small, medium, large)')

args = parser.parse_args()

# --- Helper Functions ---

def check_ffmpeg():
    """Checks if ffmpeg is accessible."""
    try:
        subprocess.run(['ffmpeg', '-version'], check=True, capture_output=True)
        logging.info("ffmpeg found.")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        logging.error("ffmpeg not found or not executable. Please ensure ffmpeg is installed and in your system's PATH.")
        return False

def convert_to_wav(input_path, output_path):
    """Converts input media to mono WAV @ 16kHz using ffmpeg."""
    if not check_ffmpeg():
        return False
    command = [
        'ffmpeg',
        '-i', input_path,
        '-vn',             # Disable video recording
        '-acodec', 'pcm_s16le', # PCM signed 16-bit little-endian
        '-ar', '16000',    # 16kHz sample rate
        '-ac', '1',        # Mono channel
        '-y',              # Overwrite output file if it exists
        output_path
    ]
    try:
        logging.info(f"Converting '{input_path}' to WAV...")
        process = subprocess.run(command, check=True, capture_output=True, text=True)
        logging.info("Conversion successful.")
        # Check if the output file is valid and not empty
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
             logging.error(f"ffmpeg conversion resulted in an empty or missing file: {output_path}")
             logging.error(f"ffmpeg stderr: {process.stderr}")
             return False
        # Optional: Check WAV file duration
        with contextlib.closing(wave.open(output_path,'r')) as f:
            frames = f.getnframes()
            rate = f.getframerate()
            duration = frames / float(rate)
            if duration < 0.1: # Check for very short duration
                 logging.warning(f"Converted WAV file duration is very short: {duration:.2f}s")
            logging.info(f"Converted WAV duration: {duration:.2f}s")
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"ffmpeg conversion failed for '{input_path}'.")
        logging.error(f"Command: {' '.join(command)}")
        logging.error(f"Error: {e}")
        logging.error(f"ffmpeg stderr: {e.stderr}")
        return False
    except Exception as e:
        logging.error(f"An unexpected error occurred during ffmpeg conversion: {e}")
        return False

def run_whisper(input_path):
    """Runs Whisper transcription and returns segments with word timestamps."""
    try:
        # Ensure whisper-ctranslate2 is installed: pip install -U whisper-ctranslate2 faster-whisper
        # Using faster-whisper for potentially better performance and word timestamps
        from faster_whisper import WhisperModel
        logging.info("Loading Whisper model...")
        # Adjust model size and compute type as needed
        # model_size = args.model or "base"
        model_size = os.environ.get("WHISPER_MODEL_SIZE", "base") # Provide default 'base'
        device_type = os.environ.get("WHISPER_DEVICE_TYPE", "cpu") # Default to 'cpu'
        compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "int8") # Default compute type for CPU

        # Log the device being used
        logging.info(f"Using device: {device_type} with compute type: {compute_type}")

        # For CPU: compute_type="int8"
        # For GPU: compute_type="float16" (or "int8_float16")
        model = WhisperModel(model_size, device=device_type, compute_type=compute_type)
        logging.info(f"Starting Whisper transcription for '{input_path}'...")
        # Use word_timestamps=True
        segments_gen, info = model.transcribe(input_path, beam_size=5, word_timestamps=True)

        segments = []
        for segment in segments_gen:
            segment_dict = {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": []
            }
            if segment.words:
                for word in segment.words:
                    segment_dict["words"].append({
                        "word": word.word.strip(),
                        "start": word.start,
                        "end": word.end,
                        # "probability": word.probability # Optional
                    })
            segments.append(segment_dict)

        logging.info(f"Whisper transcription finished. Detected language: {info.language}")
        return segments
    except ImportError:
        logging.error("faster-whisper or whisper-ctranslate2 not found. Please install with: pip install -U faster-whisper whisper-ctranslate2")
        return None
    except Exception as e:
        logging.error(f"Error during Whisper transcription: {e}")
        return None

def run_diarization(wav_path, hf_token):
    """Runs pyannote.audio diarization."""
    if not hf_token:
        logging.warning("Hugging Face token not provided. Skipping diarization.")
        return None
    try:
        # Ensure pyannote.audio is installed: pip install pyannote.audio
        # Ensure torch is installed: pip install torch torchaudio
        from pyannote.audio import Pipeline
        logging.info("Loading pyannote.audio pipeline...")
        # Use token for authentication
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=hf_token)

        # Send pipeline to GPU if available (optional)
        # import torch
        # if torch.cuda.is_available():
        #   pipeline.to(torch.device("cuda"))

        logging.info(f"Starting speaker diarization for '{wav_path}'...")
        diarization = pipeline(wav_path)
        logging.info("Speaker diarization finished.")

        # Process diarization output into a list of turns
        speaker_turns = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speaker_turns.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker # e.g., SPEAKER_00, SPEAKER_01
            })
        return speaker_turns

    except ImportError:
        logging.error("pyannote.audio or torch not found. Please install with: pip install pyannote.audio torch torchaudio")
        return None
    except Exception as e:
        # Handle potential Hugging Face authentication errors, etc.
        logging.error(f"Error during speaker diarization: {e}")
        if "401 Client Error" in str(e):
             logging.error("Hugging Face authentication failed. Check your token (HF_TOKEN).")
        return None

def align_transcription_diarization(transcription_segments, speaker_turns):
    """Aligns Whisper segments with speaker diarization turns."""
    if not speaker_turns:
        # If no diarization, return segments without speaker info
        for segment in transcription_segments:
            segment["speaker"] = "Unknown"
        return transcription_segments

    aligned_segments = []
    for segment in transcription_segments:
        segment_start = segment["start"]
        segment_end = segment["end"]
        segment_midpoint = segment_start + (segment_end - segment_start) / 2

        overlapping_speakers = {}
        max_overlap = 0
        best_speaker = "Unknown" # Default if no overlap found

        # Find speaker turn that contains the segment's midpoint
        speaker_at_midpoint = None
        for turn in speaker_turns:
             if turn["start"] <= segment_midpoint < turn["end"]:
                  speaker_at_midpoint = turn["speaker"]
                  break

        if speaker_at_midpoint:
             best_speaker = speaker_at_midpoint
        else:
             # Fallback: Find speaker with maximum overlap if midpoint fails
             for turn in speaker_turns:
                  overlap_start = max(segment_start, turn["start"])
                  overlap_end = min(segment_end, turn["end"])
                  overlap_duration = max(0, overlap_end - overlap_start)

                  if overlap_duration > 0:
                       speaker = turn["speaker"]
                       overlapping_speakers[speaker] = overlapping_speakers.get(speaker, 0) + overlap_duration
                       if overlapping_speakers[speaker] > max_overlap:
                            max_overlap = overlapping_speakers[speaker]
                            best_speaker = speaker

        segment["speaker"] = best_speaker
        aligned_segments.append(segment)

    return aligned_segments

def assign_speakers(diarization, segments):
    """Assigns speaker labels from diarization results to Whisper segments."""
    print("--- Starting Speaker Assignment ---", file=sys.stderr)
    if not diarization:
        print("No diarization data provided to assign_speakers.", file=sys.stderr)
        # Return segments as is, maybe adding default speaker if needed
        for segment in segments:
             segment['speaker'] = 'SPEAKER_00' # Or None
        return segments

    # Create a list of speaker turns with start, end, and speaker label
    speaker_turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_turns.append({
            "start": turn.start,
            "end": turn.end,
            "speaker": speaker
        })
    print(f"Found {len(speaker_turns)} speaker turns in diarization.", file=sys.stderr)
    if not speaker_turns:
         print("Diarization object contained no speaker turns.", file=sys.stderr)
         for segment in segments:
             segment['speaker'] = 'SPEAKER_00' # Fallback
         return segments

    # Sort turns by start time just in case
    speaker_turns.sort(key=lambda x: x["start"])

    # Assign speaker to each segment based on temporal overlap
    for segment in segments:
        segment_start = segment["start"]
        segment_end = segment["end"]
        segment_center = segment_start + (segment_end - segment_start) / 2

        # Find the turn that contains the segment's center time
        assigned_speaker = None
        max_overlap = 0
        best_speaker = None

        for turn in speaker_turns:
            # Calculate overlap duration
            overlap_start = max(segment_start, turn["start"])
            overlap_end = min(segment_end, turn["end"])
            overlap_duration = max(0, overlap_end - overlap_start)

            if overlap_duration > max_overlap:
                max_overlap = overlap_duration
                best_speaker = turn["speaker"]

            # Alternative: Check if center point falls within a turn
            # if segment_center >= turn["start"] and segment_center < turn["end"]:
            #     assigned_speaker = turn["speaker"]
            #     break # Found the turn containing the center

        # Assign the speaker with the maximum overlap
        segment["speaker"] = best_speaker if best_speaker else "SPEAKER_UNKNOWN"
        if not best_speaker:
             print(f"Segment {segment['id']} ({segment_start:.2f}-{segment_end:.2f}s) could not be assigned a speaker based on overlap.", file=sys.stderr)


    print("--- Finished Speaker Assignment ---", file=sys.stderr)
    return segments

def check_pyannote_gpu_usage():
    """Check if pyannote.audio can use GPU"""
    import torch
    import logging
    
    # Check if CUDA is available
    cuda_available = torch.cuda.is_available()
    device_count = torch.cuda.device_count() if cuda_available else 0
    
    logging.info(f"PyAnnote GPU Check: CUDA available: {cuda_available}")
    logging.info(f"PyAnnote GPU Check: CUDA device count: {device_count}")
    
    if cuda_available:
        for i in range(device_count):
            device_name = torch.cuda.get_device_name(i)
            logging.info(f"PyAnnote GPU Check: CUDA device {i}: {device_name}")
    
    # Return the preferred device
    if cuda_available:
        return "cuda:0"
    else:
        logging.warning("PyAnnote GPU Check: No GPU available, using CPU")
        return "cpu"

# --- Main Execution ---
def main():
    input_file = args.input
    output_json_file = args.output_json
    do_diarize = args.diarize
    hf_token = args.hf_token or os.environ.get('HUGGING_FACE_TOKEN')

    if not os.path.exists(input_file):
        logging.error(f"Input file not found: {input_file}")
        sys.exit(1)

    # Ensure output directory exists
    Path(output_json_file).parent.mkdir(parents=True, exist_ok=True)

    temp_dir = None
    wav_file_path = None
    transcription_input = input_file # Use original file for Whisper by default

    try:
        if do_diarize:
            # Create a temporary directory for the WAV file
            temp_dir = tempfile.TemporaryDirectory()
            wav_file_path = os.path.join(temp_dir.name, "diarization_input.wav")

            # Convert input to WAV for diarization
            if not convert_to_wav(input_file, wav_file_path):
                logging.error("Failed to convert file to WAV for diarization. Proceeding without diarization.")
                do_diarize = False # Disable diarization if conversion fails
            else:
                # Use the converted WAV for Whisper as well for consistency
                transcription_input = wav_file_path
                logging.info(f"Using converted WAV file for transcription: {transcription_input}")

        # 1. Run Whisper Transcription
        transcription_segments = run_whisper(transcription_input)
        if transcription_segments is None:
            logging.error("Whisper transcription failed.")
            sys.exit(1)

        # 2. Run Diarization (if requested and WAV exists)
        speaker_turns = None
        if do_diarize and wav_file_path and os.path.exists(wav_file_path):
            speaker_turns = run_diarization(wav_file_path, hf_token)
            if speaker_turns is None:
                 logging.warning("Diarization failed or was skipped. Speaker labels will be 'Unknown'.")

        # 3. Align Transcription and Diarization
        final_segments = align_transcription_diarization(transcription_segments, speaker_turns)

        # 4. Format output (convert seconds to HH:MM:SS.ms if needed by frontend, but keep seconds for processing)
        output_data = []
        for seg in final_segments:
            # Keep seconds for internal use, format for display later if needed
            output_data.append({
                "start_seconds": seg["start"],
                "end_seconds": seg["end"],
                "text": seg["text"],
                "speaker": seg.get("speaker", "Unknown"),
                "words": seg.get("words", []) # Include word timestamps
            })

        # 5. Save output JSON
        try:
            with open(output_json_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            logging.info(f"Transcription saved to {output_json_file}")
        except Exception as e:
            logging.error(f"Failed to write output JSON: {e}")
            sys.exit(1)

    except Exception as e:
        logging.error(f"An error occurred in the main process: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # Clean up temporary directory and file
        if temp_dir:
            try:
                temp_dir.cleanup()
                logging.info("Cleaned up temporary directory.")
            except Exception as e:
                logging.error(f"Error cleaning up temporary directory: {e}")

if __name__ == "__main__":
    main()
