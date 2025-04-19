"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square } from "lucide-react";
import { toast } from "sonner";

interface MicrophoneRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
}

export default function MicrophoneRecorder({ onRecordingComplete }: MicrophoneRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Add a state to track if AudioContext is active
  const audioContextActiveRef = useRef<boolean>(false);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  // Separate cleanup function to ensure consistent cleanup logic
  const cleanupResources = () => {
    // Stop all timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop media recorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error("Error stopping media recorder:", err);
      }
    }
    
    // Close audio context only if it's active
    if (audioContextRef.current && audioContextActiveRef.current) {
      try {
        audioContextRef.current.close().catch(err => {
          console.warn("Error closing AudioContext:", err);
        });
      } catch (err) {
        console.warn("Error closing AudioContext:", err);
      } finally {
        audioContextActiveRef.current = false;
      }
    }
    
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.error("Error stopping media track:", err);
        }
      });
      streamRef.current = null;
    }
    
    // Reset state
    setIsRecording(false);
    setRecordingSeconds(0);
    setAudioLevel(0);
    audioChunksRef.current = [];
  };

  // Function to determine best MIME type for the browser
  const getBestMimeType = (): string => {
    const types = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav'
    ];
    
    if (MediaRecorder && MediaRecorder.isTypeSupported) {
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          console.log(`Using MIME type: ${type}`);
          return type;
        }
      }
    }
    
    // Fallback to a common type
    console.log("No supported MIME types found, using fallback: audio/webm");
    return 'audio/webm';
  };

  // Function to update audio level visualization
  const updateAudioLevel = () => {
    if (!analyserRef.current || !audioContextActiveRef.current) return;
    
    try {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(average / 255); // Normalize to 0-1 range
      
      // Continue animation loop only if still recording
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      }
    } catch (err) {
      console.error("Error updating audio level:", err);
    }
  };

  const startRecording = async () => {
    // Clean up previous resources first to ensure a fresh start
    cleanupResources();
    
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    
    try {
      // Request microphone access with constraints for better quality
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      
      // Create and initialize AudioContext
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("AudioContext not supported in this browser");
        }
        
        audioContextRef.current = new AudioContextClass();
        audioContextActiveRef.current = true;
        
        const analyser = audioContextRef.current.createAnalyser();
        analyserRef.current = analyser;
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        
        // Start audio level visualization
        updateAudioLevel();
      } catch (audioErr) {
        console.warn("Failed to initialize audio visualization:", audioErr);
        // Continue with recording even if visualization fails
      }
      
      // Create media recorder with best MIME type
      const mimeType = getBestMimeType();
      try {
        const mediaRecorder = new MediaRecorder(stream, { 
          mimeType,
          audioBitsPerSecond: 128000 // 128kbps for decent quality
        });
        mediaRecorderRef.current = mediaRecorder;
        
        // Handle data available
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        // Handle recording stop
        mediaRecorder.onstop = () => {
          finalizeRecording();
        };
        
        // Handle recording errors
        mediaRecorder.onerror = (event) => {
          console.error("MediaRecorder error:", event);
          toast.error("Recording error occurred. Please try again.");
          cleanupResources();
        };
        
        // Start recording
        mediaRecorder.start();
        setIsRecording(true);
        
        // Setup timer for recording duration
        timerRef.current = setInterval(() => {
          setRecordingSeconds(prev => prev + 1);
        }, 1000);
      } catch (recorderErr) {
        console.error("Failed to initialize MediaRecorder:", recorderErr);
        toast.error("Could not start recording. Your browser might not support this feature.");
        cleanupResources();
      }
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Couldn't access microphone. Please make sure it's connected and permissions are granted.");
      cleanupResources();
    }
  };

  const stopRecording = () => {
    // Only attempt to stop if we were actively recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Ensure we have at least 1 second of recording
      if (recordingSeconds < 1) {
        toast.info("Recording is too short. Please record for at least 1 second.");
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }, 1000);
        return;
      }
      
      mediaRecorderRef.current.stop();
    } else {
      cleanupResources();
    }
  };

  // Function to finalize the recording after stopping
  const finalizeRecording = () => {
    try {
      // Make sure we have audio data
      if (audioChunksRef.current.length === 0) {
        toast.error("No audio data was recorded. Please try again.");
        cleanupResources();
        return;
      }
      
      // Get the MIME type used for recording
      const mimeType = mediaRecorderRef.current?.mimeType || getBestMimeType();
      
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      
      // Check if the blob has actual data
      if (audioBlob.size < 100) {
        toast.error("Recording is too short or empty. Please try again.");
        cleanupResources();
        return;
      }
      
      // Pass the audio blob to the parent component before cleaning up
      onRecordingComplete(audioBlob);
      
      // Clean up resources
      cleanupResources();
    } catch (error) {
      console.error("Error finalizing recording:", error);
      toast.error("An error occurred while saving the recording.");
      cleanupResources();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Audio level visualization */}
      {isRecording && (
        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-red-500 rounded-full transition-all duration-100"
            style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
          />
        </div>
      )}
      
      <div className="flex items-center gap-4">
        {/* Record/Stop button */}
        <Button
          // Apply red background and larger size only when not recording
          variant={isRecording ? "destructive" : "default"} // Use default for custom styling
          size="lg" // Make the button larger
          className={cn(
            "h-16 w-16 rounded-full", // Larger size
            !isRecording && "bg-red-600 hover:bg-red-700 text-white" // Red color when not recording
          )}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </Button>
        
        {/* Timer display */}
        <span className="text-sm font-mono min-w-[40px]">
          {formatTime(recordingSeconds)}
        </span>
      </div>
      
      {isRecording && (
        <div className="flex items-center gap-2">
          <span className="text-sm">Recording</span>
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
        </div>
      )}
    </div>
  );
}
