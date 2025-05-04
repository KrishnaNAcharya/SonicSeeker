import sys
import json
from faster_whisper import WhisperModel
from datetime import timedelta
import os
import tempfile
import subprocess
import mimetypes
import whisper
import argparse
import torch
import warnings
import io
import numpy as np # Needed for pyannote processing

# Set default encoding to UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Attempt to import pyannote.audio and handle failure
try:
    from pyannote.audio import Pipeline
    from pyannote.core import Segment
    PYANNOTE_AVAILABLE = True
    # print("Pyannote.audio imported successfully.", file=sys.stderr) # Optional log
except ImportError:
    PYANNOTE_AVAILABLE = False
    Pipeline = None
    Segment = None
    # print("Warning: pyannote.audio not found. Diarization will be skipped.", file=sys.stderr)

# Suppress specific warnings
warnings.filterwarnings("ignore", category=UserWarning, module='torch.functional')
warnings.filterwarnings("ignore", category=UserWarning, module='whisper.transcribe')
# Suppress specific Hugging Face warnings if they appear
warnings.filterwarnings("ignore", message="Using 'chunk_length_s' is deprecated")

# Helper: Convert seconds to HH:MM:SS format
def format_time(seconds):
    # Round to nearest second
    seconds = round(seconds)
    return str(timedelta(seconds=seconds))

def check_file_type(file_path):
    """
    Check if a file is audio or video by examining its contents.
    Returns 'audio', 'video', or 'unknown'
    """
    try:
        # Use ffprobe to detect streams in the media file
        result = subprocess.run([
            "ffprobe", "-v", "error",
            "-show_entries", "stream=codec_type",
            "-of", "json",
            file_path
        ], capture_output=True, text=True, check=True)
        
        data = json.loads(result.stdout)
        streams = data.get('streams', [])
        
        has_video = any(stream.get('codec_type') == 'video' for stream in streams)
        has_audio = any(stream.get('codec_type') == 'audio' for stream in streams)
        
        if has_video:
            return 'video'
        elif has_audio:
            return 'audio'
        else:
            return 'unknown'
    except Exception as e:
        print(f"Error checking file type: {e}", file=sys.stderr)
        # Fallback to checking file extension
        extension = os.path.splitext(file_path)[1].lower()
        if extension in ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']:
            return 'audio'
        elif extension in ['.mp4', '.avi', '.mov', '.mkv']:
            return 'video'
        elif extension == '.webm':
            # For WebM we'll be cautious and treat it as audio if possible
            return 'audio'
        else:
            return 'unknown'

def extract_audio_from_video(video_path):
    """
    Extract audio from a video file and return the path to the audio file.
    Requires ffmpeg to be installed.
    """
    # Create a temporary file for the audio
    audio_path = os.path.join(tempfile.gettempdir(), f"audio-{os.path.basename(video_path)}.wav")
    
    try:
        print(f"Extracting audio from {video_path} to {audio_path}", file=sys.stderr)
        
        # Run ffmpeg to extract audio with more detailed output
        result = subprocess.run([
            "ffmpeg", "-i", video_path,
            "-vn",  # No video
            "-acodec", "pcm_s16le",  # Use PCM 16-bit audio codec
            "-ar", "16000",  # 16k sample rate
            "-ac", "1",  # Mono channel
            "-y",  # Overwrite output file if it exists
            audio_path
        ], capture_output=True, text=True)
        
        # Check for successful extraction
        if result.returncode != 0:
            print(f"ffmpeg error: {result.stderr}", file=sys.stderr)
            return None
        
        if os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
            print(f"Audio extracted successfully: {audio_path} ({os.path.getsize(audio_path)} bytes)", file=sys.stderr)
            return audio_path
        else:
            print(f"Audio extraction failed: Output file empty or not created", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Unexpected error during audio extraction: {e}", file=sys.stderr)
        return None

def transcribe_media(file_path, enable_diarization=False):
    file_extension = os.path.splitext(file_path)[1].lower()
    audio_path = file_path
    temp_audio_created = False
    
    # Check the actual content type of the file
    print(f"Analyzing file type of {file_path}", file=sys.stderr)
    file_type = check_file_type(file_path)
    print(f"Detected file type: {file_type}", file=sys.stderr)
    
    # Handle WebM files specially - they can be audio or video
    if file_extension == '.webm':
        if file_type == 'video':
            print(f"WebM file contains video, extracting audio...", file=sys.stderr)
            audio_path = extract_audio_from_video(file_path)
            temp_audio_created = audio_path is not None
            if not audio_path:
                print(json.dumps({"error": "Failed to extract audio from WebM video"}), file=sys.stderr)
                return False
        else:
            print(f"WebM file appears to be audio-only, using directly", file=sys.stderr)
    # Handle regular video files
    elif file_type == 'video' or file_extension in ['.mp4', '.avi', '.mov', '.mkv']:
        print(f"Extracting audio from video file {file_path}", file=sys.stderr)
        audio_path = extract_audio_from_video(file_path)
        temp_audio_created = audio_path is not None
        
        if not audio_path:
            print(json.dumps({"error": "Failed to extract audio from video"}), file=sys.stderr)
            return False
    else:
        print(f"Using file directly as audio: {file_path}", file=sys.stderr)

    # If the flag is passed, just log that it's disabled
    if enable_diarization:
        print("Speaker diarization is disabled in this version", file=sys.stderr)

    # Load Whisper model (consider loading only once if possible for performance)
    model_size = os.environ.get("WHISPER_MODEL_SIZE") 
    # Use "cpu" if CUDA is not available or causing issues
    device_type = os.environ.get("WHISPER_DEVICE_TYPE")
    compute_type = os.environ.get("WHISPER_COMPUTE_TYPE") # Use "int8" or "float32" if float16 causes issues

    try:
        print(f"Loading whisper model: {model_size} on {device_type}", file=sys.stderr)
        model = WhisperModel(model_size, device=device_type, compute_type=compute_type)
    except Exception as e:
        print(f"Error loading model on {device_type}: {e}", file=sys.stderr)
        # Fallback to CPU if CUDA fails
        try:
            print("Falling back to CPU model loading...", file=sys.stderr)
            model = WhisperModel(model_size, device="cpu", compute_type="int8") # More compatible CPU type
        except Exception as e_cpu:
             print(f"Fatal error loading model on CPU: {e_cpu}", file=sys.stderr)
             sys.exit(1)

    # Transcribe audio
    try:
        print(f"Starting transcription of {audio_path}", file=sys.stderr)
        segments_gen, _ = model.transcribe(audio_path, beam_size=5) # Added beam_size
    except Exception as e:
        print(f"Error during transcription: {e}", file=sys.stderr)
        sys.exit(1)

    # Format results
    output = []
    segment_count = 0
    try:
        for segment in segments_gen:
            segment_count += 1
            output.append({
                "start": format_time(segment.start),
                "end": format_time(segment.end),
                "start_seconds": round(segment.start),  # Round to whole seconds
                "end_seconds": round(segment.end),      # Round to whole seconds
                "text": segment.text.strip() # Strip leading/trailing whitespace
            })
    except Exception as e:
        print(f"Error processing segments: {e}", file=sys.stderr)
        if segment_count == 0:
            print(f"No segments were processed, likely an issue with the audio file", file=sys.stderr)
            sys.exit(1)

    print(f"Transcription completed: {segment_count} segments found", file=sys.stderr)
    
    # Check if we actually got any transcription
    if len(output) == 0:
        print(f"Warning: No transcription was generated. The audio might be empty or too short.", file=sys.stderr)
        # Create a single empty segment to avoid errors in the frontend
        output.append({
            "start": "00:00",
            "end": "00:01",
            "start_seconds": 0,
            "end_seconds": 1,
            "text": "(No speech detected)"
        })

    result_json = json.dumps(output, indent=2, ensure_ascii=False)

    # Clean up temporary audio file if created
    if temp_audio_created:
        try:
            os.remove(audio_path)
        except Exception as e:
            print(f"Error cleaning up temporary audio file: {e}", file=sys.stderr)
                
    return result_json

def format_timestamp(seconds):
    return str(timedelta(seconds=round(seconds)))

def transcribe_and_diarize(file_path, diarize_flag):
    """
    Transcribes the media file using Whisper and optionally performs speaker diarization.
    """
    try:
        # Check device availability
        device = "cuda" if torch.cuda.is_available() else "cpu"
        # print(f"Using device: {device}", file=sys.stderr)

        # Load the Whisper model
        model_size = "base" # Use 'base' for speed, 'medium'/'large' for accuracy
        # print(f"Loading Whisper model: {model_size}", file=sys.stderr)
        model = whisper.load_model(model_size, device=device)
        # print("Whisper model loaded.", file=sys.stderr)

        # Perform transcription with word timestamps
        # print(f"Starting transcription for: {file_path}", file=sys.stderr)
        result = model.transcribe(file_path, word_timestamps=True, fp16=torch.cuda.is_available())
        # print("Transcription finished.", file=sys.stderr)

        diarization = None
        diarization_error = None
        if diarize_flag:
            if PYANNOTE_AVAILABLE:
                try:
                    # print("Attempting speaker diarization...", file=sys.stderr)
                    # Use a token if required by the model (replace 'YOUR_HF_TOKEN' or manage via env vars)
                    # pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token="YOUR_HF_TOKEN")
                    # Or try without token if the model allows
                    pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")

                    # Move pipeline to appropriate device
                    pipeline.to(torch.device(device))

                    # Perform diarization
                    diarization = pipeline(file_path)
                    # print("Diarization finished.", file=sys.stderr)
                except Exception as dia_err:
                    diarization_error = f"Diarization failed: {dia_err}"
                    print(f"Warning: {diarization_error}", file=sys.stderr)
                    diarization = None # Ensure diarization is None on error
            else:
                diarization_error = "Diarization requested but pyannote.audio is not installed."
                print(f"Warning: {diarization_error}", file=sys.stderr)

        # Process segments and words
        processed_segments = []
        if 'segments' in result:
            segment_idx = 0
            for segment in result['segments']:
                segment_start = segment['start']
                segment_end = segment['end']
                segment_text = segment['text'].strip()

                speaker_label = f"SPEAKER_{segment_idx % 2:02d}" # Default speaker if diarization fails/skipped

                if diarization:
                    try:
                        # Find speaker for the segment's midpoint
                        segment_midpoint = segment_start + (segment_end - segment_start) / 2
                        # Get the speaker label for the turn containing the midpoint
                        overlapping_turns = diarization.crop(Segment(segment_start, segment_end))
                        if overlapping_turns:
                           # Find the turn covering the midpoint or the most overlapping turn
                           best_speaker = None
                           max_overlap = 0
                           for turn, _, speaker in overlapping_turns.itertracks(yield_label=True):
                               if turn.start <= segment_midpoint <= turn.end:
                                   best_speaker = speaker
                                   break # Found speaker covering midpoint
                               overlap = turn.intersection(Segment(segment_start, segment_end)).duration
                               if overlap > max_overlap:
                                   max_overlap = overlap
                                   best_speaker = speaker

                           if best_speaker:
                               speaker_label = best_speaker
                        # else: speaker_label remains default
                    except Exception as assign_err:
                         print(f"Warning: Error assigning speaker to segment {segment_idx}: {assign_err}", file=sys.stderr)
                         # Keep default speaker label

                # Extract words with timestamps for this segment
                words_in_segment = []
                # ... existing word processing code ...
                if 'words' in segment:
                    for word_info in segment['words']:
                        word_start = word_info.get('start')
                        word_end = word_info.get('end')
                        word_text = word_info.get('word', '').strip()

                        if word_start is not None and word_end is not None and word_text:
                            words_in_segment.append({
                                "word": word_text,
                                "start": word_start,
                                "end": word_end,
                                "start_formatted": format_timestamp(word_start),
                                "end_formatted": format_timestamp(word_end),
                            })


                processed_segments.append({
                    "start_seconds": segment_start,
                    "end_seconds": segment_end,
                    "start": format_timestamp(segment_start),
                    "end": format_timestamp(segment_end),
                    "text": segment_text,
                    "words": words_in_segment,
                    "speaker": speaker_label, # Assign determined or default speaker
                })
                segment_idx += 1
        else:
             # Handle cases where Whisper might not return segments
             # ... existing code ...
             full_text = result.get('text', '').strip()
             if full_text:
                 duration = result.get('duration', 0)
                 processed_segments.append({
                     "start_seconds": 0,
                     "end_seconds": duration,
                     "start": format_timestamp(0),
                     "end": format_timestamp(duration),
                     "text": full_text,
                     "words": [],
                     "speaker": "SPEAKER_00", # Default speaker
                 })


        # Include diarization error in the output if it occurred
        output = {"transcription": processed_segments}
        if diarization_error:
            output["diarization_warning"] = diarization_error

        return output

    except Exception as e:
        print(f"Error during transcription/diarization: {e}", file=sys.stderr)
        # Return an error structure
        return {"error": f"Processing failed: {e}"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Transcribe audio/video file using Whisper and optionally diarize.')
    parser.add_argument('--file', type=str, required=True, help='Path to the media file.')
    # Keep diarize argument
    parser.add_argument('--diarize', action='store_true', help='Enable speaker diarization.')

    args = parser.parse_args()

    if not os.path.exists(args.file):
        # Output error as JSON
        print(json.dumps({"error": f"File not found: {args.file}"}))
        sys.exit(1)

    # Perform transcription and diarization
    result_data = transcribe_and_diarize(args.file, args.diarize)

    # Check if the result indicates an error from the function
    if "error" in result_data:
        print(json.dumps(result_data)) # Output the error JSON
        sys.exit(1)

    # Output the final result (transcription and optional warning) as JSON
    print(json.dumps(result_data.get("transcription", []), ensure_ascii=False, indent=2))
    # Optionally print warning to stderr if it exists, so it doesn't interfere with JSON stdout
    if "diarization_warning" in result_data:
        print(f"Diarization Warning: {result_data['diarization_warning']}", file=sys.stderr)
