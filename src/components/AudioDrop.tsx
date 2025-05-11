"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileUpload } from "@/components/FileUpload";
import MediaPlayer from '@/components/MediaPlayer';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input component
import Transcript from './Transcript';
import { toast } from "sonner";
import toHHMMSS from '@/helpers/getMinuteFormat';
import type Player from "video.js/dist/types/player";
import WaveSurfer from 'wavesurfer.js';
import { Loader2, Youtube } from "lucide-react"; // Import Youtube icon

// Update onMetricsUpdate prop to make it optional
interface AudioDropProps {
  onTranscriptionUpdate?: (segments: any[] | null, source: string | File | null, fullText: string | null) => void; // Combined update
  onPlayerReady?: (player: Player | WaveSurfer) => void; // Callback for player instance
  onHypothesisUpdate?: (text: string | null) => void;
}

const AudioDrop = ({ onTranscriptionUpdate, onPlayerReady, onHypothesisUpdate }: AudioDropProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [currentAudioSource, setCurrentAudioSource] = useState<string | File | null>(null);
  const [transcription, setTranscription] = useState<any[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [requestDiarization, setRequestDiarization] = useState(true);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const mediaPlayerRef = useRef<Player | WaveSurfer | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState(""); // State for YouTube URL input
  const [isFetchingYoutube, setIsFetchingYoutube] = useState(false); // State for YouTube fetch loading
  const [hypothesisText, setHypothesisText] = useState<string | null>(null); // Add state to hold hypothesis text locally if needed

  const trackTranscriptionProgress = useCallback((file: File) => {
    const fileSizeInMB = file.size / (1024 * 1024);
    const estimatedSeconds = Math.max(5, Math.ceil(fileSizeInMB * 6));
    let elapsedTime = 0;
    const interval = setInterval(() => {
      elapsedTime += 0.5;
      const progress = Math.min(95, Math.ceil((elapsedTime / estimatedSeconds) * 100));
      setTranscriptionProgress(progress);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const generateWordTimestampsForTranscript = (segments: any[]) => {
    return segments.map(segment => {
      if (segment.words && segment.words.length > 0) {
        return segment;
      }
      const text = segment.text || '';
      const words = text.split(/\s+/).filter(Boolean);
      const duration = (segment.end_seconds || 0) - (segment.start_seconds || 0);
      const wordDuration = words.length > 0 ? duration / words.length : 0;

      if (isNaN(duration) || isNaN(wordDuration) || !isFinite(wordDuration)) {
        console.warn(`Invalid duration calculation for segment:`, segment, `Duration: ${duration}, WordDuration: ${wordDuration}`);
      }

      const wordTimestamps = words.map((word: string, idx: number) => {
        const start = segment.start_seconds + (idx * wordDuration);
        const end = segment.start_seconds + ((idx + 1) * wordDuration);
        return {
          word,
          start: !isNaN(start) && isFinite(start) ? start : segment.start_seconds,
          end: !isNaN(end) && isFinite(end) ? end : segment.start_seconds,
        };
      });
      return { ...segment, words: wordTimestamps };
    });
  };

  // Fixed saveTranscriptionToDB function
  const saveTranscriptionToDB = async (segments: any[], mediaFile: File) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("No token found for saving transcription");
        return;
      }
  
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.userId;
  
      // Create FormData object
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("fileName", mediaFile.name);
      formData.append("fileType", mediaFile.type.startsWith("video/") ? "video" : "audio");
      
      // Format and append transcript data
      const transcriptData = segments.map(seg => ({
        start: seg.start_seconds,
        end: seg.end_seconds,
        text: seg.text,
        ...(seg.speaker ? { speaker: seg.speaker } : {})
      }));
      formData.append("transcript", JSON.stringify(transcriptData));
      
      // Append the actual media file
      formData.append("mediaFile", mediaFile);
  
      // Send to API
      const response = await fetch("/api/transcription", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error("Error saving transcription:", result.message || result.error);
        toast.error("Failed to save transcription to your history");
        throw new Error(result.message || result.error);
      } else {
        console.log("Transcription saved successfully!");
        toast.success("Transcription saved to your history");
        return result;
      }
    } catch (error) {
      console.error("Failed to save transcription:", error);
      toast.error("Could not save transcription to history");
      throw error;
    }
  };

  // Helper to extract text from transcription result
  const extractHypothesisText = (transcriptionResult: any): string => {
    if (!transcriptionResult) return '';
    
    // If transcription is an array of segments with text
    if (transcriptionResult.transcription && Array.isArray(transcriptionResult.transcription)) {
        return transcriptionResult.transcription.map((seg: any) => seg.text).join(' ').trim();
    }
    
    // If it's an array directly
    if (Array.isArray(transcriptionResult) && transcriptionResult.every((seg: any) => typeof seg.text === 'string')) {
        return transcriptionResult.map((seg: any) => seg.text).join(' ').trim();
    }
    
    return '';
  };

  const handleTranscribe = async () => {
    const fileToTranscribe = currentAudioSource instanceof File ? currentAudioSource : null;
    if (!fileToTranscribe && !youtubeUrl) { // Also check youtubeUrl
       toast.error("Please select, record, or provide a YouTube URL first.");
       return;
     }

    // If YouTube URL is present, use that flow instead
    if (youtubeUrl && !fileToTranscribe) {
        await handleFetchYouTubeTranscript();
        return;
    }

    // Proceed with file transcription if fileToTranscribe exists
    if (!fileToTranscribe) {
        toast.error("No file selected or recorded for transcription.");
        return;
    }


    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscription([]);
    setTranscriptionProgress(0);
    setActiveSegmentIndex(-1);
    setHypothesisText(null); // Clear local hypothesis text
    onHypothesisUpdate?.(null); // Notify parent: clearing hypothesis text
    onTranscriptionUpdate?.(null, fileToTranscribe, null); // Notify parent: clearing transcription, but source is set

    const stopProgressTracking = trackTranscriptionProgress(fileToTranscribe);

    try {
      toast.info("Starting transcription...");
      const formData = new FormData();
      formData.append('mediaFile', fileToTranscribe);
      formData.append('diarize', String(requestDiarization));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      }).catch(err => {
        if (err.name === 'AbortError') throw new Error('Request timed out.');
        throw err;
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.error || 'Failed to transcribe media';
        if (response.status === 504) {
            errorMessage = 'Transcription timed out. The file might be too long or the server is busy.';
        } else if (response.status === 413) {
            errorMessage = 'File is too large. Please upload a smaller file.';
        } else if (errorData.details) {
            errorMessage += ` Details: ${errorData.details}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Remove metrics handling
      
      if (data.transcription && Array.isArray(data.transcription)) {
        const processedSegments = data.transcription.map((segment: any, index: number) => {
          const startSeconds = segment.start_seconds ||
            (typeof segment.start === 'string' ? Math.round(parseFloat(segment.start)) :
              typeof segment.start === 'number' ? Math.round(segment.start) : 0);

          const endSeconds = segment.end_seconds ||
            (typeof segment.end === 'string' ? Math.round(parseFloat(segment.end)) :
              typeof segment.end === 'number' ? Math.round(segment.end) : 0);


          const startFormatted = toHHMMSS(startSeconds);
          const endFormatted = toHHMMSS(endSeconds);

          const speaker = segment.speaker || `SPEAKER ${index % 2}`;

          return {
            ...segment,
            speaker: speaker,
            start_seconds: startSeconds,
            end_seconds: endSeconds,
            start: startFormatted,
            end: endFormatted,
          };
        });

        const segmentsWithWordTimestamps = generateWordTimestampsForTranscript(processedSegments);
        setTranscription(segmentsWithWordTimestamps);

        // --- Extract and update hypothesis text ---
        const fullText = extractHypothesisText(data);
        console.log("Extracted hypothesis text:", fullText.substring(0, 50) + "...");
        onHypothesisUpdate?.(fullText); // Update parent with hypothesis text

        onTranscriptionUpdate?.(segmentsWithWordTimestamps, fileToTranscribe, fullText);

        // Save transcription to database
        try {
          await saveTranscriptionToDB(segmentsWithWordTimestamps, fileToTranscribe);
        } catch (saveError) {
          console.error("Failed to save transcription to database:", saveError);
          // Don't block the UI flow on save error, just log it
        }

        toast.success("Transcription completed!");
        setTranscriptionProgress(100);
      } else {
        throw new Error(data.error || 'No valid transcription data returned from the server.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setTranscriptionError(message);
      toast.error(`Transcription failed: ${message}`);
      setTranscriptionProgress(0);
      setHypothesisText(null); // Clear local hypothesis on error
      onTranscriptionUpdate?.(null, fileToTranscribe, null); // Notify parent about error (clearing transcription)
      onHypothesisUpdate?.(null); // Clear hypothesis text on error
    } finally {
      stopProgressTracking();
      setIsTranscribing(false);
    }
  };

  const handleSeekTo = (time: number) => {
    if (mediaPlayerRef.current) {
      if ('setTime' in mediaPlayerRef.current && typeof mediaPlayerRef.current.setTime === 'function') {
        mediaPlayerRef.current.setTime(time);
      } else if ('currentTime' in mediaPlayerRef.current && typeof mediaPlayerRef.current.currentTime === 'function') {
        mediaPlayerRef.current.currentTime(time);
        if (mediaPlayerRef.current.paused()) {
          mediaPlayerRef.current.play().catch(e => console.error("Error playing after seek:", e));
        }
      } else {
        console.warn("Seek function not available on media player ref.");
      }
    } else {
      console.warn("Media player ref is null.");
    }
  };

  const handleTimeUpdate = useCallback((currentTime: number) => {
    setCurrentPlaybackTime(currentTime);
    if (transcription.length === 0) return;
    const roundedTime = Math.round(currentTime);
    for (let i = 0; i < transcription.length; i++) {
      const segment = transcription[i];
      const start = segment.start_seconds;
      const end = segment.end_seconds || (i < transcription.length - 1 ? transcription[i + 1].start_seconds : Infinity);
      if (roundedTime >= start && roundedTime < end) {
        if (activeSegmentIndex !== i) setActiveSegmentIndex(i);
        break;
      }
    }
  }, [transcription, activeSegmentIndex]);

  // Update handlePlayerReady to call the prop
  const handlePlayerReady = useCallback((playerInstance: Player | WaveSurfer) => {
    mediaPlayerRef.current = playerInstance;
    onPlayerReady?.(playerInstance); // Call the prop with the player instance
  }, [onPlayerReady]); // Add onPlayerReady as dependency

  const handleWordClick = useCallback((timestamp: number) => {
    handleSeekTo(timestamp);
  }, [handleSeekTo]);

  const handleFileUpload = (uploadedFiles: File[]) => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return;
    }

    setFiles(uploadedFiles);
    const firstMedia = uploadedFiles[0]; // Get the first file

    if (firstMedia && (firstMedia.type.startsWith('audio/') || firstMedia.type.startsWith('video/'))) {
      setCurrentAudioSource(firstMedia);
      setTranscription([]);
      setTranscriptionError(null);
      setActiveSegmentIndex(-1);
      setCurrentPlaybackTime(0);
      mediaPlayerRef.current = null;
      setYoutubeUrl(""); // Clear YouTube URL when a file is uploaded
      onTranscriptionUpdate?.(null, firstMedia, null); // Notify parent about new source, clear transcription
    } else {
      setCurrentAudioSource(null);
      toast.error("Selected file is not a valid audio or video file");
    }
  };

  const startRecording = async () => {
    setFiles([]);
    setCurrentAudioSource(null);
    setTranscription([]);
    setTranscriptionError(null);
    setActiveSegmentIndex(-1);
    setCurrentPlaybackTime(0);
    audioChunksRef.current = [];
    setYoutubeUrl(""); // Clear YouTube URL when starting recording
    onTranscriptionUpdate?.(null, null, null); // Clear transcription in parent

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? { mimeType: 'audio/mp4' }
          : {};
      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/wav';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const fileExtension = mimeType.split('/')[1]?.split(';')[0] || 'wav';
        const recordedFile = new File([audioBlob], `recording-${Date.now()}.${fileExtension}`, { type: mimeType });

        setFiles([recordedFile]);
        setCurrentAudioSource(recordedFile);
        stream.getTracks().forEach(track => track.stop());
        toast.success("Recording finished.");
        onTranscriptionUpdate?.(null, recordedFile, null); // Notify parent about new source
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info("Recording started...");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast.error("Could not access microphone. Please check permissions.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleSelectFile = (file: File) => {
    if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
      setCurrentAudioSource(file);
      setTranscription([]);
      setTranscriptionError(null);
      setActiveSegmentIndex(-1);
      setCurrentPlaybackTime(0);
      mediaPlayerRef.current = null;
    } else {
      toast.error("Selected file is not an audio or video file and cannot be played.");
    }
  };

  const handleFetchYouTubeTranscript = useCallback(async () => {
    if (!youtubeUrl) {
      toast.warning("Please enter a YouTube URL.");
      return;
    }

    // --- URL Cleaning ---
    let cleanedUrl = youtubeUrl.trim();
    // Attempt to fix common duplication issues like "https:https://"
    if (cleanedUrl.startsWith("https:https://")) {
      cleanedUrl = cleanedUrl.substring(6); // Remove the extra "https:"
    } else if (cleanedUrl.startsWith("http:http://")) {
      cleanedUrl = cleanedUrl.substring(5); // Remove the extra "http:"
    }
    // Basic validation: ensure it starts with http:// or https://
    if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
       // Try prepending https:// if no protocol is present
       if (!cleanedUrl.includes("://")) {
           cleanedUrl = "https://" + cleanedUrl;
       } else {
           toast.error("Invalid URL format. Please enter a valid YouTube URL starting with http:// or https://");
           return;
       }
    }
    // --- End URL Cleaning ---

    setIsFetchingYoutube(true);
    setIsTranscribing(true);
    setCurrentAudioSource(null);
    setTranscription([]);
    setTranscriptionError(null); // Clear previous errors
    setTranscriptionProgress(5); // Initial progress indication
    setActiveSegmentIndex(-1);
    setHypothesisText(null); // Clear local hypothesis
    onTranscriptionUpdate?.(null, cleanedUrl, null); // Notify parent: clearing transcription, source is URL
    toast.info("Fetching YouTube transcript...");

    try {
      const response = await fetch("/api/youtube-transcript", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        // Send the cleaned URL
        body: JSON.stringify({ youtubeUrl: cleanedUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("YouTube Transcript API error:", result);
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      // Use the same handler as file uploads
      const transcriptionResult = result.transcription || result;

      // --- Check if transcriptionResult is an array before mapping ---
      if (!Array.isArray(transcriptionResult?.segments)) {
          console.error("Invalid transcription data received from YouTube API:", transcriptionResult);
          throw new Error("Received invalid data format from YouTube transcript fetch.");
      }
      // --- End Check ---

      const processedSegments = transcriptionResult.segments.map((segment: any, index: number) => {
        // ... (rest of the segment processing logic remains the same) ...
        const startSeconds = segment.start_seconds ??
                            (typeof segment.start === 'string' ? Math.round(parseFloat(segment.start)) :
                             typeof segment.start === 'number' ? Math.round(segment.start) : 0);

        const endSeconds = segment.end_seconds ??
                          (typeof segment.end === 'string' ? Math.round(parseFloat(segment.end)) :
                           typeof segment.end === 'number' ? Math.round(segment.end) : 0);

        const startFormatted = toHHMMSS(startSeconds);
        const endFormatted = toHHMMSS(endSeconds);

        const speaker = segment.speaker || `SPEAKER ${index % 2}`; // Default speaker if not provided

        return {
          ...segment,
          speaker: speaker,
          start_seconds: startSeconds,
          end_seconds: endSeconds,
          start: startFormatted,
          end: endFormatted,
        };
      });
      const segmentsWithWordTimestamps = generateWordTimestampsForTranscript(processedSegments);

      // --- Extract hypothesis text ---
      const fullText = segmentsWithWordTimestamps.map(segment => segment.text).join(' ').trim();
      console.log("Extracted YouTube hypothesis text:", fullText.substring(0, 50) + "...");
      onHypothesisUpdate?.(fullText); // Update parent with hypothesis text
      
      setTranscription(segmentsWithWordTimestamps);
      // --- Call combined update handler ---
      onTranscriptionUpdate?.(segmentsWithWordTimestamps, cleanedUrl, fullText);

      setTranscription(segmentsWithWordTimestamps); // Update local transcription state
      setCurrentAudioSource(cleanedUrl); // Set source to URL for potential playback/linking later

      toast.success("YouTube transcript fetched successfully!");
      setYoutubeUrl(""); // Clear input on success

    } catch (error: any) {
      console.error("Fetching YouTube transcript failed:", error);
      toast.error(`Failed to fetch YouTube transcript: ${error.message}`);
      setTranscription([]);
      setHypothesisText(null); // Clear hypothesis on error
      onTranscriptionUpdate?.(null, cleanedUrl, null); // Notify parent about error
      onHypothesisUpdate?.(null); // Clear hypothesis on error
    } finally {
      setIsFetchingYoutube(false);
      setIsTranscribing(false);
      setTranscriptionProgress(0); // Reset progress
    }
  }, [youtubeUrl, onTranscriptionUpdate, onHypothesisUpdate]); // Remove onMetricsUpdate

  // Add cleanup when component unmounts or on new upload
  useEffect(() => {
    return () => {
      onHypothesisUpdate?.(null); // Clear hypothesis when component unmounts
    };
  }, [onHypothesisUpdate]);

  return (
    <>
      <div className="flex flex-col lg:flex-row flex-grow gap-8">
        <div className="w-full lg:w-1/3 flex flex-col gap-8">
          <div className="flex-grow border border-dashed border-border bg-card rounded-lg flex items-center justify-center p-4 min-h-[200px]">
            <FileUpload onChange={handleFileUpload} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">Fetch from YouTube</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex w-full items-center space-x-2">
                 <Input
                   id="youtube-url"
                   type="url"
                   placeholder="https://www.youtube.com/watch?v=..."
                   value={youtubeUrl}
                   onChange={(e) => setYoutubeUrl(e.target.value)}
                   className="flex-grow" // Use Shadcn Input
                   disabled={isFetchingYoutube || isTranscribing}
                 />
                 <Button
                   onClick={handleFetchYouTubeTranscript}
                   disabled={isFetchingYoutube || isTranscribing || !youtubeUrl}
                   size="icon" // Make button icon-sized
                   aria-label="Fetch YouTube Transcript"
                 >
                   {isFetchingYoutube ? (
                     <Loader2 className="h-4 w-4 animate-spin" />
                   ) : (
                     <Youtube className="h-4 w-4" /> // YouTube icon
                   )}
                 </Button>
               </div>
               <p className="text-xs text-muted-foreground mt-2">Enter a YouTube video URL to fetch its transcript.</p>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-2/3 flex flex-col gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">Record Audio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                {!isRecording ? (
                  <Button onClick={startRecording} variant="destructive" className="flex items-center gap-2">
                    Start Recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="secondary" className="flex items-center gap-2">
                    Stop Recording
                  </Button>
                )}
                {isRecording && <p className="text-sm text-red-400 animate-pulse">Recording...</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-grow flex flex-col min-h-[200px]">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex-shrink-0 text-foreground">Playback</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              {currentAudioSource ? (
                <div className="flex-grow min-h-0">
                  <MediaPlayer
                    // Update key to handle URL strings as well
                    key={typeof currentAudioSource === 'string' ? currentAudioSource : `${currentAudioSource.name}-${currentAudioSource.lastModified}`}
                    mediaFile={currentAudioSource instanceof File ? currentAudioSource : null}
                    // Pass youtubeUrl if the source is a string (assuming it's a YT URL for now)
                    youtubeUrl={typeof currentAudioSource === 'string' ? currentAudioSource : undefined}
                    onReady={handlePlayerReady} // Pass the handler
                    onTimeUpdate={handleTimeUpdate}
                  />
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center">
                  <p className="text-muted-foreground">Upload or record audio/video to see player</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Update Transcribe button disabled logic */}
      {(currentAudioSource || youtubeUrl) && (
        <div className="flex justify-center items-center gap-4 px-10 py-6">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="diarize-checkbox"
              checked={requestDiarization}
              onChange={(e) => setRequestDiarization(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-input text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="diarize-checkbox" className="text-sm font-medium text-muted-foreground">
              Identify Speakers (Diarize)
            </label>
          </div>
          <Button
            onClick={handleTranscribe}
            disabled={isTranscribing || (!currentAudioSource && !youtubeUrl)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTranscribing
              ? 'Processing...'
              : (youtubeUrl && !currentAudioSource ? 'Fetch & Transcribe YT' : 'Transcribe Media')}
          </Button>
        </div>
      )}
      {/* Transcription Results Section */}
      <div className="flex-grow border border-border rounded-lg bg-card flex flex-col min-h-[300px] mt-6">
        {/* Add padding (e.g., p-4 pb-0) to the title */}
        <div className="h-full overflow-y-auto flex-grow">
          {isTranscribing ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p>Transcribing... {transcriptionProgress}%</p>
              <div className="w-full max-w-xs h-2 bg-muted rounded-full mt-2 overflow-hidden">
                <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${transcriptionProgress}%` }}></div>
              </div>
            </div>
          ) : transcriptionError ? (
            <div className="flex flex-col items-center justify-center h-full text-red-400 p-4">
              <p>Error: {transcriptionError}</p>
              <p className="text-sm mt-2 text-red-300">
                Try converting your file to MP3 or WAV format. If recording, ensure it's at least 1 second long.
              </p>
            </div>
          ) : transcription.length > 0 ? (
            <Transcript
              segments={transcription}
              onSegmentClick={(segment: any) => handleSeekTo(segment.start_seconds)}
              onWordClick={handleWordClick}
              activeSegmentIndex={activeSegmentIndex}
              currentTime={currentPlaybackTime}
            />
          ) : (
            // Placeholder shown when no transcription is available
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-32">
              <p>Upload or record audio and click "Transcribe Media".</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AudioDrop;