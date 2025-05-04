"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Remove Image import
// import Image from "next/image"; 
// Import lucide-react icons
import { Play, Pause, Rewind, FastForward, SkipBack, SkipForward } from "lucide-react"; 
import videojs from "video.js";
import WaveSurfer from "wavesurfer.js";
import type Player from "video.js/dist/types/player";
import 'video.js/dist/video-js.css';

interface MediaPlayerProps {
  mediaFile: File | null;
  onTimeUpdate?: (currentTime: number) => void;
  onReady?: (player: Player | WaveSurfer) => void;
}

export default function MediaPlayer({ 
  mediaFile, 
  onTimeUpdate, 
  onReady 
}: MediaPlayerProps) {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [playerInitialized, setPlayerInitialized] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<Player | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const mediaUrlRef = useRef<string | null>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef<boolean>(true); // Track component mount state
  const onReadyCalledRef = useRef<boolean>(false); // Add a flag to track if we've already called onReady
  
  // Add new method to expose direct seeking functionality
  const forceSeekToTime = useCallback((seconds: number) => {
    // Round to nearest second for consistency
    const roundedSeconds = Math.round(seconds);
    console.log(`FORCE SEEKING to ${roundedSeconds}s`);
    
    // Clear previous timeout to prevent multiple operations
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
    
    if (isVideo && videoPlayerRef.current) {
      try {
        // For video, stop all events temporarily
        const wasPlaying = !videoPlayerRef.current.paused();
        videoPlayerRef.current.pause();
        
        // Use a single operation with delayed play to avoid rebuilding
        seekTimeoutRef.current = setTimeout(() => {
          if (!videoPlayerRef.current || !mountedRef.current) return;
          
          videoPlayerRef.current.currentTime(roundedSeconds);
          
          // Resume playback after a brief delay if it was playing
          if (wasPlaying) {
            setTimeout(() => {
              if (videoPlayerRef.current && mountedRef.current) {
                videoPlayerRef.current.play().catch(e => {
                  console.error("Error resuming video playback:", e);
                });
              }
            }, 50);
          }
          seekTimeoutRef.current = null;
        }, 10);
      } catch (error) {
        console.error("Error during video force seek:", error);
      }
    } 
    else if (!isVideo && wavesurferRef.current) {
      try {
        // For audio, use a more direct method without destroying the player
        const wasPlaying = wavesurferRef.current.isPlaying();
        
        // Simple direct seek without rebuilding the waveform
        wavesurferRef.current.setTime(roundedSeconds);
        
        // Only handle play/pause state without destroying/recreating events
        if (wasPlaying && !wavesurferRef.current.isPlaying()) {
          wavesurferRef.current.play();
        }
      } catch (error) {
        console.error("Error during audio force seek:", error);
      }
    }
  }, [isVideo]);
  
  // Reset state and refs when media file changes
  useEffect(() => {
    console.log("MediaPlayer: mediaFile changed, resetting state.");
    // Explicitly destroy previous players *before* resetting state
    if (videoPlayerRef.current) {
      console.log("MediaPlayer: Disposing previous video player due to file change.");
      try {
        videoPlayerRef.current.dispose();
      } catch (err) { console.error("Error disposing video player:", err); }
      videoPlayerRef.current = null;
    }
    if (wavesurferRef.current) {
      console.log("MediaPlayer: Destroying previous wavesurfer due to file change.");
      try {
        wavesurferRef.current.destroy();
      } catch (err) { console.error("Error destroying wavesurfer:", err); }
      wavesurferRef.current = null;
    }
    if (mediaUrlRef.current) {
      URL.revokeObjectURL(mediaUrlRef.current);
      mediaUrlRef.current = null;
    }
    
    setPlayerInitialized(false);
    onReadyCalledRef.current = false;
    setIsLoading(false); // Reset loading state
    setIsPlaying(false); // Reset playing state
    
    if (mediaFile) {
      setIsVideo(mediaFile.type.startsWith('video/'));
    } else {
      setIsVideo(false); // Handle case where mediaFile becomes null
    }
    
    // No cleanup needed here as it's handled by the unmount effect and the start of this effect
  }, [mediaFile]);
  
  // Cleanup on component unmount
  useEffect(() => {
    mountedRef.current = true;
    console.log("MediaPlayer: Component mounted.");
    
    return () => {
      mountedRef.current = false;
      console.log("MediaPlayer: Component unmounting, cleaning up resources.");
      
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      
      // Clean up video player if needed
      if (videoPlayerRef.current) {
        console.log("MediaPlayer: Disposing video player on unmount.");
        try {
          videoPlayerRef.current.dispose();
        } catch (err) { console.error("Error cleaning up video player:", err); }
        videoPlayerRef.current = null;
      }
      
      // Clean up wavesurfer if needed
      if (wavesurferRef.current) {
        console.log("MediaPlayer: Destroying wavesurfer on unmount.");
        try {
          wavesurferRef.current.destroy();
        } catch (err) { console.error("Error cleaning up wavesurfer:", err); }
        wavesurferRef.current = null;
      }
      
      // Revoke any object URLs
      if (mediaUrlRef.current) {
        console.log("MediaPlayer: Revoking media URL on unmount.");
        URL.revokeObjectURL(mediaUrlRef.current);
        mediaUrlRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount
  
  // HANDLE VIDEO: Set up video player when a video file is selected
  useEffect(() => {
    // Ensure conditions are met and component is mounted
    if (!mediaFile || !isVideo || !videoRef.current || !mountedRef.current || playerInitialized) {
      return;
    }
    
    console.log("MediaPlayer: Initializing video player.");
    
    // Create a new URL for the video file
    const videoUrl = URL.createObjectURL(mediaFile);
    mediaUrlRef.current = videoUrl; // Store the new URL
    
    setIsLoading(true);
    
    try {
      // Initialize video.js directly without setTimeout
      const videoElement = videoRef.current;
      
      if (!document.body.contains(videoElement)) {
        console.error("MediaPlayer: Video element not in DOM during initialization.");
        setIsLoading(false);
        if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current); // Clean up URL
        mediaUrlRef.current = null;
        return;
      }
      
      const videoPlayer = videojs(videoElement, {
        controls: true,
        autoplay: false,
        fluid: true,
        sources: [{
          src: videoUrl,
          type: mediaFile.type
        }],
        html5: {
          nativeAudioTracks: true,
          nativeVideoTracks: true
        }
      });
      
      videoPlayerRef.current = videoPlayer; // Store the player instance
      
      // Set up event listeners
      videoPlayer.on('ready', () => {
        console.log('MediaPlayer: Video player is ready.');
        // Set initialized state *before* calling onReady
        setPlayerInitialized(true); 
        setIsLoading(false);
        
        if (onReady && mountedRef.current && !onReadyCalledRef.current) {
          console.log("MediaPlayer: Calling onReady for video player.");
          (videoPlayer as any).forceSeekToTime = forceSeekToTime;
          onReadyCalledRef.current = true;
          onReady(videoPlayer);
        }
      });
      
      videoPlayer.on('timeupdate', () => {
        if (onTimeUpdate && mountedRef.current) {
          // Use more precise time without rounding for word-level highlighting
          const currentTime = videoPlayer.currentTime();
          onTimeUpdate(currentTime);
        }
      });
      
      videoPlayer.on('play', () => {
        console.log('Video playing');
        if (mountedRef.current) {
          setIsPlaying(true);
        }
      });
      
      videoPlayer.on('pause', () => {
        console.log('Video paused');
        if (mountedRef.current) {
          setIsPlaying(false);
        }
      });
      
      videoPlayer.on('ended', () => {
        console.log('Video ended');
        if (mountedRef.current) {
          setIsPlaying(false);
        }
      });
      
      videoPlayer.on('error', (error) => {
        console.error('MediaPlayer: Video player error:', error);
        if (mountedRef.current) setIsLoading(false);
        // Consider cleaning up here if error is fatal
      });
      
    } catch (error) {
      console.error("MediaPlayer: Error initializing video player:", error);
      setIsLoading(false);
      if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current); // Clean up URL on error
      mediaUrlRef.current = null;
    }
    
    // No explicit cleanup needed here, handled by unmount and mediaFile change effects
    
  }, [mediaFile, isVideo, playerInitialized, forceSeekToTime, onReady, onTimeUpdate]); // playerInitialized added to prevent re-run after init
  
  // HANDLE AUDIO: Set up WaveSurfer when an audio file is selected
  useEffect(() => {
    // Ensure conditions are met and component is mounted
    if (!mediaFile || isVideo || !waveformRef.current || !mountedRef.current || playerInitialized) {
      return;
    }
    
    console.log("MediaPlayer: Initializing WaveSurfer.");
    
    // Create new audio URL
    const audioUrl = URL.createObjectURL(mediaFile);
    mediaUrlRef.current = audioUrl; // Store the new URL
    
    setIsLoading(true);
    
    try {
      // Initialize WaveSurfer directly without setTimeout
      if (!document.body.contains(waveformRef.current)) {
        console.error("MediaPlayer: Waveform container not in DOM during initialization.");
        setIsLoading(false);
        if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current); // Clean up URL
        mediaUrlRef.current = null;
        return;
      }
      
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#4B5563",
        progressColor: "#2563EB",
        cursorColor: "#2563EB",
        barWidth: 2,
        barRadius: 3,
        cursorWidth: 1,
        height: 100,
        barGap: 3
      });
      
      wavesurferRef.current = wavesurfer; // Store the instance
      
      // Set up error handler first
      wavesurfer.on("error", (error) => {
        console.error("Wavesurfer error:", error);
        if (mountedRef.current) {
          setIsLoading(false);
        }
      });
      
      // Load the audio file safely
      wavesurfer.loadBlob(mediaFile);
      
      // Set up event handlers
      wavesurfer.on("ready", () => {
        console.log('MediaPlayer: WaveSurfer is ready.');
        // Set initialized state *before* calling onReady
        setPlayerInitialized(true); 
        setIsLoading(false);
        
        if (onReady && mountedRef.current && !onReadyCalledRef.current) {
          console.log("MediaPlayer: Calling onReady for WaveSurfer.");
          (wavesurfer as any).forceSeekToTime = forceSeekToTime;
          onReadyCalledRef.current = true;
          onReady(wavesurfer);
        }
      });
      
      wavesurfer.on("loading", (percentage) => {
        if (mountedRef.current) {
          setIsLoading(true);
        }
      });
      
      wavesurfer.on("audioprocess", () => {
        if (onTimeUpdate && mountedRef.current && wavesurferRef.current) {
          // Use more precise time without rounding for word-level highlighting
          const currentTime = wavesurferRef.current.getCurrentTime();
          onTimeUpdate(currentTime);
        }
      });
      
      wavesurfer.on("play", () => {
        console.log('Audio playing');
        if (mountedRef.current) {
          setIsPlaying(true);
        }
      });
      
      wavesurfer.on("pause", () => {
        console.log('Audio paused');
        if (mountedRef.current) {
          setIsPlaying(false);
        }
      });
      
      wavesurfer.on("finish", () => {
        console.log('Audio finished');
        if (mountedRef.current) {
          setIsPlaying(false);
        }
      });
      
    } catch (error) {
      console.error('MediaPlayer: Error initializing WaveSurfer:', error);
      setIsLoading(false);
      if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current); // Clean up URL on error
      mediaUrlRef.current = null;
    }
    
    // No explicit cleanup needed here, handled by unmount and mediaFile change effects
    
  }, [mediaFile, isVideo, playerInitialized, forceSeekToTime, onReady, onTimeUpdate]); // playerInitialized added
  
  // Media control handlers - audio only (video uses native controls)
  const handlePlayPause = useCallback(() => {
    if (!isVideo && wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, [isVideo]);

  // Add separate play/pause handlers for clarity if needed, or keep combined
  const handlePlay = useCallback(() => {
    if (!isVideo && wavesurferRef.current) {
      wavesurferRef.current.play();
    }
  }, [isVideo]);

  const handlePause = useCallback(() => {
    if (!isVideo && wavesurferRef.current) {
      wavesurferRef.current.pause();
    }
  }, [isVideo]);
  
  const handleSkipForward = useCallback(() => {
    if (!isVideo && wavesurferRef.current) {
      const currentTime = wavesurferRef.current.getCurrentTime();
      wavesurferRef.current.setTime(currentTime + 5);
    }
  }, [isVideo]);
  
  const handleSkipBackward = useCallback(() => {
    if (!isVideo && wavesurferRef.current) {
      const currentTime = wavesurferRef.current.getCurrentTime();
      wavesurferRef.current.setTime(Math.max(0, currentTime - 5));
    }
  }, [isVideo]);
  
  const handleSkipToStart = useCallback(() => {
    if (!isVideo && wavesurferRef.current) {
      wavesurferRef.current.setTime(0);
    }
  }, [isVideo]);
  
  const handleSkipToEnd = useCallback(() => {
    if (!isVideo && wavesurferRef.current) {
      wavesurferRef.current.setTime(wavesurferRef.current.getDuration());
    }
  }, [isVideo]);
  
  // Add these new handlers for video controls
  const handleVideoPlayPause = useCallback(() => {
    if (isVideo && videoPlayerRef.current) {
      if (videoPlayerRef.current.paused()) {
        videoPlayerRef.current.play().catch(e => {
          console.error("Error playing video:", e);
        });
      } else {
        videoPlayerRef.current.pause();
      }
    }
  }, [isVideo]);
  
  const handleVideoSkipForward = useCallback(() => {
    if (isVideo && videoPlayerRef.current) {
      const currentTime = videoPlayerRef.current.currentTime();
      videoPlayerRef.current.currentTime(currentTime + 10);
    }
  }, [isVideo]);
  
  const handleVideoSkipBackward = useCallback(() => {
    if (isVideo && videoPlayerRef.current) {
      const currentTime = videoPlayerRef.current.currentTime();
      videoPlayerRef.current.currentTime(Math.max(0, currentTime - 10));
    }
  }, [isVideo]);
  
  if (!mediaFile) return null;
  
  return (
    <div className="w-full space-y-4">
      {/* Video Player */}
      {isVideo ? (
        <Card className="overflow-hidden">
          <div 
            ref={videoContainerRef} 
            className="relative"
            data-vjs-player
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-blue-200"></div>
              </div>
            )}
            <video 
              ref={videoRef} 
              className="video-js vjs-big-play-centered w-full" 
              playsInline
            />
          </div>
          
          {/* Custom video controls - Add these new controls */}
          {playerInitialized && !isLoading && (
            <div className="flex justify-center items-center gap-4 py-3 border-t">
              <Button variant="ghost" size="icon" onClick={handleVideoSkipBackward} title="Skip back 10s">
                {/* Replace Image with Rewind icon */}
                <Rewind className="h-6 w-6" /> 
              </Button>
              <Button 
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={handleVideoPlayPause}
                title={isPlaying ? "Pause" : "Play"}
              >
                {/* Replace Image with Play/Pause icons */}
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />} 
              </Button>
              <Button variant="ghost" size="icon" onClick={handleVideoSkipForward} title="Skip forward 10s">
                 {/* Replace Image with FastForward icon */}
                 <FastForward className="h-6 w-6" /> 
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div>
          {/* Audio Player */}
          <Card className="p-4">
            <div 
              ref={waveformRef} 
              className="w-full min-h-[100px] relative"
            >
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-blue-500 border-blue-200"></div>
                </div>
              )}
            </div>
            
            {playerInitialized && !isLoading && (
              <div className="flex justify-center items-center gap-4 mt-4">
                <Button variant="ghost" size="icon" onClick={handleSkipToStart} title="Skip to start">
                  {/* Replace Image with SkipBack icon */}
                  <SkipBack className="h-6 w-6" /> 
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSkipBackward} title="Skip back 5s">
                  {/* Replace Image with Rewind icon */}
                  <Rewind className="h-6 w-6" /> 
                </Button>
                {/* Play/Pause Button (Combined or Separate) */}
                <Button 
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handlePlayPause} // Use combined handler
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {/* Replace Image with Play/Pause icons */}
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />} 
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSkipForward} title="Skip forward 5s">
                  {/* Replace Image with FastForward icon */}
                  <FastForward className="h-6 w-6" /> 
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSkipToEnd} title="Skip to end">
                  {/* Replace Image with SkipForward icon */}
                  <SkipForward className="h-6 w-6" /> 
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
