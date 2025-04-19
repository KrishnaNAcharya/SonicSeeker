from faster_whisper import WhisperModel
from datetime import timedelta
import json
import os

# Helper: Convert seconds to HH:MM:SS format - rounded to whole seconds
def format_time(seconds):
    # Round to nearest second
    seconds = round(seconds)
    return str(timedelta(seconds=seconds))

# Load Whisper model
model = WhisperModel("turbo", device="cuda", compute_type="float16")

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
