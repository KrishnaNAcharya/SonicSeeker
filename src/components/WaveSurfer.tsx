"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react'; 
import WaveSurfer, { WaveSurferOptions } from 'wavesurfer.js';
import { Button } from "@/components/ui/button";

interface WaveformPlayerProps {
  audioSource: string | File;
  options?: Partial<WaveSurferOptions>;
  initialPlaybackRate?: number;
  onReady?: (instance: WaveSurfer | any) => void;
  onTimeUpdate?: (time: number) => void;
}

// Define the available speed steps
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioSource,
  options,
  initialPlaybackRate = 1,
  onReady,
  onTimeUpdate,
}) => {
  // References
  const waveformRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const videoObjectURLRef = useRef<string | null>(null);
  const currentSourceRef = useRef<string | File | null>(null); // Track current source
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate);
  const [preservePitch, setPreservePitch] = useState(true);
  const [isVideo, setIsVideo] = useState(false);
  const [playerInitialized, setPlayerInitialized] = useState(false);
  const onReadyCalledRef = useRef(false);

  // Find the index of the initial playback rate in the speeds array
  const initialSpeedIndex = speeds.indexOf(initialPlaybackRate);
  const [speedIndex, setSpeedIndex] = useState(initialSpeedIndex !== -1 ? initialSpeedIndex : speeds.indexOf(1));
  
  // Only reset player if the source has actually changed
  useEffect(() => {
    const sourceHasChanged = 
      currentSourceRef.current !== audioSource &&
      (currentSourceRef.current instanceof File 
        ? !(audioSource instanceof File && currentSourceRef.current.name === audioSource.name) 
        : true);
    
    if (sourceHasChanged) {
      console.log("WaveformPlayer: Source changed, will create new instance");
      currentSourceRef.current = audioSource;
      
      // Clean up previous resources only if source actually changed
      if (videoObjectURLRef.current) {
        URL.revokeObjectURL(videoObjectURLRef.current);
        videoObjectURLRef.current = null;
      }
      
      // Note: WaveSurfer instance will be destroyed in its own effect when source changes
      
      setIsLoading(true);
      setPlayerInitialized(false);
      onReadyCalledRef.current = false;
      setIsVideo(audioSource instanceof File && audioSource.type.startsWith('video/'));
    }
  }, [audioSource]);
  
  // Effect for initializing WaveSurfer for audio files
  useEffect(() => {
    if (isVideo || !waveformRef.current || !audioSource) return;
    
    // Don't recreate instance if already exists and source hasn't changed
    const sourceHasChanged = 
      wavesurferRef.current && 
      currentSourceRef.current !== audioSource &&
      (currentSourceRef.current instanceof File 
        ? !(audioSource instanceof File && currentSourceRef.current.name === audioSource.name) 
        : true);
      
    // Only recreate if source changed or no instance exists
    if (sourceHasChanged || !wavesurferRef.current) {
      console.log("Initializing WaveSurfer for audio");
      
      // Clean up existing instance if it exists
      if (wavesurferRef.current) {
        console.log("Destroying previous WaveSurfer instance");
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      
      const ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'rgb(200, 200, 200)',
        progressColor: 'rgb(100, 100, 100)',
        cursorColor: 'rgb(255, 255, 255)',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 100,
        responsive: true,
        ...options,
      });
      
      wavesurferRef.current = ws;
      setIsLoading(true);
      
      // Set up event listeners
      ws.on('ready', () => {
        setIsLoading(false);
        setPlayerInitialized(true);
        ws.setPlaybackRate(playbackRate, preservePitch);
        console.log('WaveSurfer is ready');
        
        if (onReady && !onReadyCalledRef.current) {
          console.log("Calling onReady for WaveSurfer");
          onReadyCalledRef.current = true;
          onReady(ws);
        }
      });
      
      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));
      ws.on('error', (err) => {
        console.error('WaveSurfer error:', err);
        setIsLoading(false);
      });
      
      // Time update handling
      if (onTimeUpdate) {
        ws.on('audioprocess', () => {
          onTimeUpdate(ws.getCurrentTime());
        });
        ws.on('seek', () => {
          onTimeUpdate(ws.getCurrentTime());
        });
      }
      
      // Load the audio source
      if (audioSource instanceof File) {
        ws.loadBlob(audioSource);
      } else {
        ws.load(audioSource.toString());
      }
      
      // Store current source
      currentSourceRef.current = audioSource;
    }
    
    return () => {
      // Do NOT destroy on every render, only when component unmounts
      if (wavesurferRef.current && !document.body.contains(waveformRef.current)) {
        console.log('Destroying WaveSurfer instance on unmount');
        wavesurferRef.current.unAll();
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioSource, isVideo, options, onReady, onTimeUpdate]);
  
  // Separate effect for handling video files
  // ...existing video handling code...

  // Update playback rate when it changes
  useEffect(() => {
    if (wavesurferRef.current && !isLoading) {
      wavesurferRef.current.setPlaybackRate(playbackRate, preservePitch);
    }
  }, [playbackRate, preservePitch, isLoading]);

  // Control handlers
  const handlePlayPause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  const handleSpeedChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(event.target.value, 10);
    const newSpeed = speeds[newIndex];
    setSpeedIndex(newIndex);
    setPlaybackRate(newSpeed);
  }, []);

  const handlePitchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPreservePitch(event.target.checked);
  }, []);

  // Return the component JSX
  return (
    <div className="w-full">
      <div ref={waveformRef} className="w-full h-[100px] bg-neutral-700 rounded mb-4 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 bg-neutral-700/50">
            Loading waveform...
            <div className="ml-2 w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          onClick={handlePlayPause}
          disabled={isLoading}
          className={`px-4 py-2 rounded text-white font-medium transition-colors ${isLoading ? 'bg-neutral-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <label htmlFor="speed-slider">Speed:</label>
          <span className="font-medium text-white w-10 text-right">{playbackRate.toFixed(2)}x</span>
          <input
            id="speed-slider"
            type="range"
            min="0"
            max={speeds.length - 1}
            step="1"
            value={speedIndex}
            onChange={handleSpeedChange}
            disabled={isLoading}
            className="w-24 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Playback speed: ${playbackRate.toFixed(2)}x`}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            id="preserve-pitch"
            type="checkbox"
            checked={preservePitch}
            onChange={handlePitchChange}
            disabled={isLoading}
            className="w-4 h-4 text-blue-600 bg-neutral-600 border-neutral-500 rounded focus:ring-blue-500 focus:ring-offset-neutral-800 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label htmlFor="preserve-pitch">Preserve pitch</label>
        </div>
      </div>
    </div>
  );
};

export default WaveformPlayer;
