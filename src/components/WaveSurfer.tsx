"use client";
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface WaveformProps {
  audioFile: File | null;
}

export default function Waveform({ audioFile }: WaveformProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (waveformRef.current && audioFile) {
      // Cleanup previous instance
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
      
      // Create new abort controller
      abortController.current?.abort();
      abortController.current = new AbortController();

      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4B5563',
        progressColor: '#2563EB',
        cursorColor: '#2563EB',
        barWidth: 2,
        barRadius: 3,
        cursorWidth: 1,
        height: 100,
        barGap: 3,
      });

      const audioUrl = URL.createObjectURL(audioFile);
      
      try {
        wavesurfer.current.load(audioUrl, undefined, undefined, abortController.current.signal);
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Loading aborted');
        } else {
          console.error('Error loading audio:', error);
        }
      }

      return () => {
        abortController.current?.abort();
        URL.revokeObjectURL(audioUrl);
        wavesurfer.current?.destroy();
      };
    }
  }, [audioFile]);

  const togglePlayPause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSkipForward = () => {
    if (wavesurfer.current) {
      const currentTime = wavesurfer.current.getCurrentTime();
      wavesurfer.current.setTime(currentTime + 5);
    }
  };

  const handleSkipToEnd = () => {
    if (wavesurfer.current) {
      wavesurfer.current.setTime(wavesurfer.current.getDuration());
    }
  };

  const handleSkipBackward = () => {
    if (wavesurfer.current) {
      const currentTime = wavesurfer.current.getCurrentTime();
      wavesurfer.current.setTime(Math.max(0, currentTime - 5));
    }
  };

  const handleSkipToStart = () => {
    if (wavesurfer.current) {
      wavesurfer.current.setTime(0);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div ref={waveformRef} className="w-full min-w-[300px]" />
      {audioFile && (
        <div className="flex justify-center items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleSkipToStart}>
            <Image 
              src="/icons/fast-backward-start.png" 
              alt="Skip to start"
              width={24}
              height={24}
            />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSkipBackward}>
            <Image 
              src="/icons/fast-backward.png" 
              alt="Skip back 5 seconds"
              width={24}
              height={24}
            />
          </Button>
          <Button variant="ghost" size="icon" onClick={togglePlayPause}>
            <Image 
              src={isPlaying ? "/icons/pause.png" : "/icons/play.png"} 
              alt={isPlaying ? "Pause" : "Play"}
              width={24}
              height={24}
            />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSkipForward}>
            <Image 
              src="/icons/fast-forward.png" 
              alt="Skip 5 seconds"
              width={24}
              height={24}
            />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSkipToEnd}>
            <Image 
              src="/icons/fast-forward-end.png" 
              alt="Skip to end"
              width={24}
              height={24}
            />
          </Button>
        </div>
      )}
    </div>
  );
}
