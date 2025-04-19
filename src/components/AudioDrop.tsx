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

const AudioDrop = () => {
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

  const handleTranscribe = async () => {
    const fileToTranscribe = currentAudioSource instanceof File ? currentAudioSource : null;
    if (!fileToTranscribe) {
      toast.error("Please select or record an audio file first.");
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscription([]);
    setTranscriptionProgress(0);
    setActiveSegmentIndex(-1);

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

      if (data.error) {
          throw new Error(`Transcription failed on server: ${data.error}`);
      }

      if (data.diarization_warning) {
          toast.warning(`Diarization issue: ${data.diarization_warning}`, { duration: 5000 });
      }

      const transcriptionResult = data.transcription || data;

      if (transcriptionResult && Array.isArray(transcriptionResult)) {
        const processedSegments = transcriptionResult.map((segment: any, index: number) => {
          const startSeconds = segment.start_seconds ??
                              (typeof segment.start === 'string' ? Math.round(parseFloat(segment.start)) :
                               typeof segment.start === 'number' ? Math.round(segment.start) : 0);

          const endSeconds = segment.end_seconds ??
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
      const end = segment.end_seconds || (i < transcription.length - 1 ? transcription[i+1].start_seconds : Infinity);
      if (roundedTime >= start && roundedTime < end) {
        if (activeSegmentIndex !== i) setActiveSegmentIndex(i);
        break;
      }
    }
  }, [transcription, activeSegmentIndex]);

  const handlePlayerReady = useCallback((playerInstance: Player | WaveSurfer) => {
     mediaPlayerRef.current = playerInstance;
  }, []);

  const handleWordClick = useCallback((timestamp: number) => {
    handleSeekTo(timestamp);
  }, [handleSeekTo]);

  const handleFileUpload = (uploadedFiles: File[]) => {
    setFiles(uploadedFiles);
    const firstMedia = uploadedFiles.find(file => 
      file.type.startsWith('audio/') || file.type.startsWith('video/')
    );
    if (firstMedia) {
      setCurrentAudioSource(firstMedia);
      setTranscription([]);
      setTranscriptionError(null);
      setActiveSegmentIndex(-1);
      setCurrentPlaybackTime(0);
      mediaPlayerRef.current = null;
    } else {
      setCurrentAudioSource(null);
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
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info("Recording started...");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
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
      alert("Selected file is not an audio or video file and cannot be played.");
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
    setIsTranscribing(true); // Use main loading indicator
    setCurrentAudioSource(null); // Clear any selected file
    setTranscription([]); // Clear previous transcription
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
      setTranscription(segmentsWithWordTimestamps);
      toast.success("YouTube transcript fetched successfully!");
      // Optionally, try to display video info or thumbnail if needed later
      // For now, just clear the URL input after success
      setYoutubeUrl("");

    } catch (error: any) {
      console.error("Fetching YouTube transcript failed:", error);
      toast.error(`Failed to fetch YouTube transcript: ${error.message}`);
      setTranscription([]);
    } finally {
      setIsFetchingYoutube(false);
      setIsTranscribing(false);
    }
  }, [youtubeUrl]);

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
                    key={currentAudioSource instanceof File ? `${currentAudioSource.name}-${currentAudioSource.lastModified}` : currentAudioSource}
                    mediaFile={currentAudioSource instanceof File ? currentAudioSource : null}
                    onReady={handlePlayerReady}
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

      {currentAudioSource && (
        <div className="flex justify-center items-center gap-4 px-10 py-6">
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="diarize-checkbox" checked={requestDiarization} onChange={(e) => setRequestDiarization(e.target.checked)} className="h-4 w-4 rounded border-border bg-input text-blue-600 focus:ring-blue-500"/>
            <label htmlFor="diarize-checkbox" className="text-sm font-medium text-muted-foreground">Identify Speakers (Diarize)</label>
          </div>
          <Button onClick={handleTranscribe} disabled={isTranscribing || !currentAudioSource} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {isTranscribing ? 'Transcribing...' : 'Transcribe Media'}
          </Button>
        </div>
      )}

      <div className="flex-grow border border-border rounded-lg bg-card p-4 flex flex-col min-h-[300px] mt-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Transcription</h2>
        <div className="h-full overflow-y-auto p-1 flex-grow">
          {isTranscribing ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
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
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
               <p>Upload or record audio and click "Transcribe Media".</p>
             </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AudioDrop;