"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
// Adjust import paths for UI components if they are in different locations
import { FileUpload } from "@/components/FileUpload"; 
// Import MediaPlayer instead of WaveformPlayer
import MediaPlayer from '@/components/MediaPlayer'; 
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"; // Keep Card imports
import { Button } from "@/components/ui/button";
// Import only Transcript component
import Transcript from './Transcript'; 
// Remove imports for other analysis components
// import SentimentAnalysis from './SentimentAnalysis'; 
// import EntityAnalysis from './EntityAnalysis'; 
// import GrammarAnalysis from './GrammarAnalysis'; 
// import MindMap from './MindMap'; 
// Import other necessary components/utils
import { toast } from "sonner";
import toHHMMSS from '@/helpers/getMinuteFormat';
// Import Player type from video.js for the ref
import type Player from "video.js/dist/types/player"; 
import WaveSurfer from 'wavesurfer.js'; // Keep WaveSurfer type for ref

const AudioDrop = () => {
  const [files, setFiles] = useState<File[]>([]); 
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [currentAudioSource, setCurrentAudioSource] = useState<string | File | null>(null); 
  // Remove activeTab state
  // const [activeTab, setActiveTab] = useState<string>('transcription'); 
  
  // State for analysis results (Keep existing)
  const [transcription, setTranscription] = useState<any[]>([]); 
  const [isTranscribing, setIsTranscribing] = useState(false); 
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [requestDiarization, setRequestDiarization] = useState(true); 
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0); 
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1); 
  const mediaPlayerRef = useRef<Player | WaveSurfer | null>(null); // Change ref type to potentially hold the video wrapper as well

  // --- Transcription Logic (Keep existing) ---
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
        // Log existing word timestamps if provided
        // segment.words.forEach((word: any) => console.log(`Existing word: ${word.word}, start: ${word.start}, end: ${word.end}`));
        return segment;
      }
      const text = segment.text || '';
      const words = text.split(/\s+/).filter(Boolean);
      const duration = (segment.end_seconds || 0) - (segment.start_seconds || 0);
      const wordDuration = words.length > 0 ? duration / words.length : 0;
      
      // Ensure duration and wordDuration are valid numbers
      if (isNaN(duration) || isNaN(wordDuration) || !isFinite(wordDuration)) {
        console.warn(`Invalid duration calculation for segment:`, segment, `Duration: ${duration}, WordDuration: ${wordDuration}`);
      }

      const wordTimestamps = words.map((word: string, idx: number) => {
        const start = segment.start_seconds + (idx * wordDuration);
        const end = segment.start_seconds + ((idx + 1) * wordDuration);
        // Log calculated word timestamps
        // console.log(`Calculated word: ${word}, start: ${start}, end: ${end}`); 
        return {
          word,
          start: !isNaN(start) && isFinite(start) ? start : segment.start_seconds, // Fallback if calculation fails
          end: !isNaN(end) && isFinite(end) ? end : segment.start_seconds, // Fallback
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
        throw new Error(errorData.error || 'Failed to transcribe media');
      }

      const data = await response.json();

      if (data.transcription && Array.isArray(data.transcription)) {
        console.log("Raw API response segments:", data.transcription);
        
        const processedSegments = data.transcription.map((segment: any, index: number) => {
          // Log raw values from API with more detail
          console.log(`Raw segment ${index}:`, {
            start: segment.start,
            end: segment.end,
            start_type: typeof segment.start,
            end_type: typeof segment.end
          });
          
          // Try different parsing approaches
          const startSeconds = segment.start_seconds || 
                              (typeof segment.start === 'string' ? Math.round(parseFloat(segment.start)) : 
                               typeof segment.start === 'number' ? Math.round(segment.start) : 0);
                               
          const endSeconds = segment.end_seconds || 
                            (typeof segment.end === 'string' ? Math.round(parseFloat(segment.end)) : 
                             typeof segment.end === 'number' ? Math.round(segment.end) : 0);

          // Log processed second values
          console.log(`Processed segment ${index}: start_seconds=${startSeconds}, end_seconds=${endSeconds}`);

          // Ensure we're using the fixed toHHMMSS function
          const startFormatted = toHHMMSS(startSeconds);
          const endFormatted = toHHMMSS(endSeconds);
          
          console.log(`Formatted times: start=${startFormatted}, end=${endFormatted}`);

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
        toast.success("Transcription completed!");
        setTranscriptionProgress(100);
        // Remove setActiveTab call
        // setActiveTab('transcription'); 
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
  
  // --- Player Interaction Logic ---
  const handleSeekTo = (time: number) => {
    console.log("Seeking to:", time);
    // Use setTime for WaveSurfer, currentTime for Video.js Player
    if (mediaPlayerRef.current) {
      if ('setTime' in mediaPlayerRef.current && typeof mediaPlayerRef.current.setTime === 'function') {
        // WaveSurfer instance
        mediaPlayerRef.current.setTime(time);
      } else if ('currentTime' in mediaPlayerRef.current && typeof mediaPlayerRef.current.currentTime === 'function') {
        // Video.js Player instance
        mediaPlayerRef.current.currentTime(time);
        // Optionally play if paused after seeking
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

  // Adjust handlePlayerReady type hint
  const handlePlayerReady = useCallback((playerInstance: Player | WaveSurfer) => {
     console.log("Player ready (Audio or Video):", playerInstance);
     mediaPlayerRef.current = playerInstance;
     // Player component now handles internal listeners based on props
  }, []); 

  const handleWordClick = useCallback((timestamp: number) => {
    handleSeekTo(timestamp);
  }, [handleSeekTo]); 

  // --- Remove Analysis Tabs Definition ---
  // const analysisTabs: Tab[] = [ ... ];

  // --- Event Handlers (Keep existing) ---
  const handleFileUpload = (uploadedFiles: File[]) => {
    setFiles(uploadedFiles); 
    console.log("Uploaded files:", uploadedFiles);
    // Allow both audio and video files to be set as the current source
    const firstMedia = uploadedFiles.find(file => 
      file.type.startsWith('audio/') || file.type.startsWith('video/')
    );
    if (firstMedia) {
      setCurrentAudioSource(firstMedia); 
      setTranscription([]); 
      setTranscriptionError(null);
      setActiveSegmentIndex(-1);
      setCurrentPlaybackTime(0);
      // Reset player ref when source changes
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
        
        console.log("Recorded file:", recordedFile);
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
    // Allow selecting audio or video files from the list
    if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
      setCurrentAudioSource(file);
      setTranscription([]); 
      setTranscriptionError(null);
      setActiveSegmentIndex(-1);
      setCurrentPlaybackTime(0);
      // Reset player ref when source changes
      mediaPlayerRef.current = null; 
    } else {
      alert("Selected file is not an audio or video file and cannot be played.");
    }
  };

  // --- Render Logic (Restore original layout) ---
  return (
    <> 
      {/* Main content area */}
      <div className="flex flex-col lg:flex-row flex-grow gap-8"> {/* Removed padding/margin */}
        {/* Left Column: File Upload & List */}
        {/* Make the left column a flex container and allow its children to grow */}
        <div className="w-full lg:w-1/3 flex flex-col gap-8"> 
          {/* File Upload Area */}
          {/* Make the upload area grow to fill the available space */}
          <div className="flex-grow border border-dashed bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-center p-4 min-h-[200px]"> {/* Added flex-grow and min-h */}
            <FileUpload onChange={handleFileUpload} />
          </div>

          {/* REMOVED: File List Area */}
          {/* <div className="flex-grow overflow-y-auto bg-neutral-800 rounded-lg p-4 border border-neutral-700 min-h-[200px]"> ... </div> */}
        </div>

        {/* Right Column: Recorder & Player */}
        <div className="w-full lg:w-2/3 flex flex-col gap-8">
          {/* Recorder */}
          <Card className="bg-neutral-800 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-white">Record Audio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                {!isRecording ? (
                  <Button onClick={startRecording} variant="destructive" className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="bi bi-mic-fill"><path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V3z"/><path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/></svg>
                    Start Recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="secondary" className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="bi bi-stop-fill"><path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a.5.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5.5 0 0 1 5 3.5z"/></svg>
                    Stop Recording
                  </Button>
                )}
                {isRecording && <p className="text-sm text-red-400 animate-pulse">Recording...</p>}
              </div>
            </CardContent>
          </Card>

          {/* Player */}
          <Card className="flex-grow bg-neutral-800 border-neutral-700 flex flex-col min-h-[200px]">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex-shrink-0 text-white">Playback</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              {currentAudioSource ? (
                <div className="flex-grow min-h-0">
                  {/* Replace WaveformPlayer with MediaPlayer */}
                  <MediaPlayer 
                    key={currentAudioSource instanceof File ? `${currentAudioSource.name}-${currentAudioSource.lastModified}` : currentAudioSource} 
                    mediaFile={currentAudioSource instanceof File ? currentAudioSource : null} // Pass mediaFile prop
                    onReady={handlePlayerReady} 
                    onTimeUpdate={handleTimeUpdate} // Pass time update handler
                  />
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center">
                  <p className="text-neutral-500">Upload or record audio/video to see player</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transcribe Button Area */}
      {currentAudioSource && (
        <div className="flex justify-center items-center gap-4 px-10 py-6"> {/* Added py-6 */}
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="diarize-checkbox" checked={requestDiarization} onChange={(e) => setRequestDiarization(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
            <label htmlFor="diarize-checkbox" className="text-sm font-medium text-gray-300">Identify Speakers (Diarize)</label>
          </div>
          <Button onClick={handleTranscribe} disabled={isTranscribing || !currentAudioSource} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {isTranscribing ? 'Transcribing...' : 'Transcribe Media'}
          </Button>
        </div>
      )}
      
      {/* Transcription Loading/Error Indicators (Moved inside the Analysis Results Section) */}
      {/* ... */}

      {/* Analysis Results Section (Always displayed) */}
      <div className="flex-grow border border-neutral-700 rounded-lg bg-neutral-850 p-4 flex flex-col min-h-[300px] mt-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Transcription</h2>
        <div className="h-full overflow-y-auto p-1 flex-grow"> 
          {isTranscribing ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p>Transcribing... {transcriptionProgress}%</p>
              <div className="w-full max-w-xs h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
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
             <div className="flex flex-col items-center justify-center h-full text-neutral-500">
               <p>Upload or record audio and click "Transcribe Media".</p>
             </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AudioDrop;