from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
from urllib.parse import urlparse, parse_qs
import argparse
import json
import sys

def get_video_id(url):
    """Extracts the YouTube video ID from a URL."""
    # Examples:
    # - http://youtu.be/SA2iWivDJiE
    # - http://www.youtube.com/watch?v=_oPAwA_Udwc&feature=feedu
    # - http://www.youtube.com/embed/SA2iWivDJiE
    # - http://www.youtube.com/v/SA2iWivDJiE?version=3&amp;hl=en_US
    query = urlparse(url)
    if query.hostname == 'youtu.be':
        # Handles youtu.be/VIDEO_ID?t=123s
        return query.path.split('/')[1]
    if query.hostname in ('www.youtube.com', 'youtube.com', 'm.youtube.com'):
        if query.path == '/watch':
            p = parse_qs(query.query)
            if 'v' in p:
                return p['v'][0]
        if query.path[:7] == '/embed/':
            return query.path.split('/')[2]
        if query.path[:3] == '/v/':
            return query.path.split('/')[2]
        # Handle shorts /live/ etc. - extract 'v' parameter if present
        if query.path.startswith(('/shorts/', '/live/')):
             p = parse_qs(query.query)
             if 'v' in p:
                 return p['v'][0]
             # Sometimes video ID is in the path for shorts/live
             parts = query.path.split('/')
             if len(parts) > 2 and len(parts[2]) == 11: # Basic check for video ID length
                 return parts[2]

    # fail?
    return None

def fetch_transcript(video_id):
    """Fetches the transcript for a given video ID."""
    try:
        # Fetch available transcripts
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Try to find English first, then any generated, then any manual
        preferred_langs = ['en', 'en-US', 'en-GB']
        transcript = None

        # Try preferred languages first
        for lang in preferred_langs:
            try:
                transcript = transcript_list.find_transcript([lang])
                print(f"Found preferred transcript: {lang}", file=sys.stderr)
                break
            except NoTranscriptFound:
                continue

        # If no preferred found, try finding a generated transcript in any language
        if not transcript:
            try:
                transcript = transcript_list.find_generated_transcript(transcript_list.languages)
                print(f"Found generated transcript: {transcript.language}", file=sys.stderr)
            except NoTranscriptFound:
                pass # Continue to try manual

        # If still no transcript, try finding a manual transcript in any language
        if not transcript:
             try:
                 transcript = transcript_list.find_manually_created_transcript(transcript_list.languages)
                 print(f"Found manual transcript: {transcript.language}", file=sys.stderr)
             except NoTranscriptFound:
                 # If absolutely no transcript is found after all attempts
                 print(f"ERROR: No transcript found for video ID: {video_id}", file=sys.stderr)
                 return None

        # Fetch the actual transcript data
        transcript_data = transcript.fetch()

        # Format data similar to Whisper output for consistency
        # Adding 'start_seconds' and 'end_seconds'
        formatted_data = []
        for item in transcript_data:
             # --- Access attributes instead of keys ---
             start_seconds = item.start
             duration = item.duration
             text = item.text
             # --- End change ---

             end_seconds = start_seconds + duration
             formatted_data.append({
                 "start": f"{int(start_seconds // 3600):02}:{int((start_seconds % 3600) // 60):02}:{int(start_seconds % 60):02},{int((start_seconds % 1) * 1000):03}",
                 "end": f"{int(end_seconds // 3600):02}:{int((end_seconds % 3600) // 60):02}:{int(end_seconds % 60):02},{int((end_seconds % 1) * 1000):03}",
                 "start_seconds": start_seconds,
                 "end_seconds": end_seconds,
                 "text": text
             })

        # Return the list of segments directly
        return formatted_data

    except TranscriptsDisabled:
        print(f"ERROR: Transcripts are disabled for video ID: {video_id}", file=sys.stderr)
        return None
    except Exception as e:
        # Print the type of the exception as well for better debugging
        print(f"ERROR: An unexpected error occurred while fetching transcript: {type(e).__name__}: {e}", file=sys.stderr)
        # Optionally, print traceback for more details
        # import traceback
        # traceback.print_exc(file=sys.stderr)
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Fetch YouTube transcript.')
    parser.add_argument('--url', required=True, help='YouTube video URL')
    args = parser.parse_args()

    youtube_url = args.url
    video_id = get_video_id(youtube_url)

    if not video_id:
        print(f"ERROR: Could not extract video ID from URL: {youtube_url}", file=sys.stderr)
        sys.exit(1)

    transcript_segments = fetch_transcript(video_id)

    if transcript_segments is None:
        # Error message already printed in fetch_transcript
        sys.exit(1)
    else:
        # Wrap the segments list in a structure similar to Whisper's output
        output_data = {
            "text": " ".join([seg['text'] for seg in transcript_segments]), # Full text
            "segments": transcript_segments,
            "language": "unknown" # Language detection not performed here, set placeholder
        }
        # Print the JSON output to stdout
        print(json.dumps(output_data))
