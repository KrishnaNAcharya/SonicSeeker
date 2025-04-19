"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileUpload } from "@/components/FileUpload";
import MediaPlayer from '@/components/MediaPlayer';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Transcript from './Transcript';
import { toast } from "sonner";
import toHHMMSS from '@/helpers/getMinuteFormat';
import type Player from "video.js/dist/types/player";
import WaveSurfer from 'wavesurfer.js';

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
        throw new Error(errorData.error || 'Failed to transcribe media');
      }

      const data = await response.json();

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

          return {
            ...segment,
            speaker: segment.speaker,
            start_seconds: startSeconds,
            end_seconds: endSeconds,
            start: startFormatted,
            end: endFormatted,
          };
        });

        const segmentsWithWordTimestamps = generateWordTimestampsForTranscript(processedSegments);
        setTranscription(segmentsWithWordTimestamps);

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
        throw new Error('No valid transcription data returned');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setTranscriptionError(message);
      toast.error(`Transcription failed: ${message}`);
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

  const handlePlayerReady = useCallback((playerInstance: Player | WaveSurfer) => {
    mediaPlayerRef.current = playerInstance;
  }, []);

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

  return (
    <>
      <div className="flex flex-col lg:flex-row flex-grow gap-8">
        <div className="w-full lg:w-1/3 flex flex-col gap-8">
          <div className="flex-grow border border-dashed border-border bg-card rounded-lg flex items-center justify-center p-4 min-h-[200px]">
            <FileUpload onChange={handleFileUpload} />
          </div>
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
            <input type="checkbox" id="diarize-checkbox" checked={requestDiarization} onChange={(e) => setRequestDiarization(e.target.checked)} className="h-4 w-4 rounded border-border bg-input text-blue-600 focus:ring-blue-500" />
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