import os
import logging
from faster_whisper import WhisperModel
from dotenv import load_dotenv # Import dotenv
from datetime import timedelta
import json

# Load environment variables from .env.local (or .env)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env.local')) # Adjust path if needed

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

try:
    logging.info("Attempting to load Whisper model...")

    # Get environment variables with defaults
    model_size = os.getenv("WHISPER_MODEL_SIZE", "base") # Provide default 'base'
    device_type = os.getenv("WHISPER_DEVICE_TYPE", "cpu") # Default to 'cpu'
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8") # Default compute type for CPU

    logging.info(f"Using Model Size: {model_size}")
    logging.info(f"Using Device Type: {device_type}")
    logging.info(f"Using Compute Type: {compute_type}")

    # Check if model_size is valid before proceeding
    if not model_size:
        raise ValueError("WHISPER_MODEL_SIZE environment variable is not set and no default was provided.")

    # Initialize the model
    model = WhisperModel(model_size, device=device_type, compute_type=compute_type)

    logging.info("Whisper model loaded successfully!")
    # You could add a dummy transcription here to test further if needed
    # e.g., segments, info = model.transcribe("path/to/dummy/audio.wav")
    # logging.info("Dummy transcription test successful.")

    # Helper: Convert seconds to HH:MM:SS format - rounded to whole seconds
    def format_time(seconds):
        # Round to nearest second
        seconds = round(seconds)
        return str(timedelta(seconds=seconds))

    # Transcribe audio
    segments, _ = model.transcribe("src/Hackfest.m4a")

    for segment in segments:
        # Round the start/end times to whole seconds for display
        print(f"{round(segment.start)}s -> {round(segment.end)}s: {segment.text}")

    # Format results
    output = []
    for segment in segments:
        output.append({
            "start": format_time(segment.start),
            "end": format_time(segment.end),
            "start_seconds": round(segment.start),  # Store as rounded integers
            "end_seconds": round(segment.end),      # Store as rounded integers
            "text": segment.text
        })

    # Define target path
    output_dir = os.path.join("src", "whisper", "transcripts")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "transcript.json")

    # Save to JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"✅ Transcript saved to: {output_path}")

except ImportError:
    logging.error("faster-whisper not found. Please install with: pip install -U faster-whisper")
except ValueError as ve:
    logging.error(f"Configuration error: {ve}")
except Exception as e:
    logging.error(f"An error occurred while loading the Whisper model: {e}", exc_info=True)
