from faster_whisper import WhisperModel

# Load model (Change "medium" to "large-v2" if needed)
model = WhisperModel("medium", device="cuda", compute_type="float16")

# Transcribe audio
segments, _ = model.transcribe("src/Hackfest.m4a")

# Print results
for segment in segments:
    print(f"{segment.start:.2f}s -> {segment.end:.2f}s: {segment.text}")
