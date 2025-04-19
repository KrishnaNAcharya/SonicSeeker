import sys
import json
from faster_whisper import WhisperModel
from datetime import timedelta
import os
import tempfile
import subprocess
import mimetypes

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
    model_size = "turbo"
    # Use "cpu" if CUDA is not available or causing issues
    device_type = "cuda"
    compute_type = "float16" # Use "int8" or "float32" if float16 causes issues

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

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe_api.py <media_file_path> [--diarize]", file=sys.stderr)
        sys.exit(1)

    media_file = sys.argv[1]
    if not os.path.exists(media_file):
        print(f"Error: File not found at {media_file}", file=sys.stderr)
        sys.exit(1)

    # Check for diarization flag
    enable_diarization = "--diarize" in sys.argv

    try:
        result_json = transcribe_media(media_file, enable_diarization)
        print(result_json) # Print JSON to stdout
    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        sys.exit(1)
