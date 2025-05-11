'use client';
import Image from "next/image";
import { useEffect, useState, useMemo, useCallback, useRef } from "react"; // Added useMemo, useCallback, useRef
import { useRouter } from "next/navigation";
import GenerateMindMap from "@/components/GenerateMindMap";
import AudioDrop from "@/components/AudioDrop";
import Hero from "@/components/Hero"; // Import the Hero component

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator"; // Import Separator

export default function Home() {
  const [transcriptionSegments, setTranscriptionSegments] = useState<any[]>([]); // State for transcription segments
  const [hypothesisText, setHypothesisText] = useState<string | null>(null); // State for the full hypothesis text
  const [currentAudioSource, setCurrentAudioSource] = useState<string | File | null>(null); // To track the source for seeking
  const mediaPlayerRef = useRef<any>(null); // Ref for media player (Video.js or WaveSurfer)

  // Handler for updating transcription segments and hypothesis text
  const handleTranscriptionUpdate = useCallback((segments: any[] | null, source: string | File | null, fullText: string | null) => {
    setTranscriptionSegments(segments || []);
    setCurrentAudioSource(source);
    setHypothesisText(fullText); // Update hypothesis text state
  }, []);

  // Handler specifically for hypothesis text update (can be combined with above if preferred)
  const handleHypothesisUpdate = useCallback((text: string | null) => {
      setHypothesisText(text);
  }, []);

  // Function to handle seek requests from child components
  const handleSeekTo = useCallback((time: number) => {
    if (mediaPlayerRef.current) {
      if (typeof mediaPlayerRef.current.seekTo === 'function') { // WaveSurfer specific
        mediaPlayerRef.current.seekTo(time / mediaPlayerRef.current.getDuration());
        mediaPlayerRef.current.play();
      } else if (typeof mediaPlayerRef.current.currentTime === 'function') { // Video.js specific
        mediaPlayerRef.current.currentTime(time);
        if (mediaPlayerRef.current.paused()) {
          mediaPlayerRef.current.play().catch((e: any) => console.error("Error playing after seek:", e));
        }
      } else {
        console.warn("Seek function not available on media player ref.");
      }
    } else {
      console.warn("Media player ref is null or not ready for seeking.");
    }
  }, []); // mediaPlayerRef should be stable, no dependency needed unless it changes identity

  // Callback to get the player instance from AudioDrop
  const handlePlayerReady = useCallback((player: any) => {
    mediaPlayerRef.current = player;
  }, []);

  return (
    // Remove min-height from the main content div if Hero takes full screen
    <div>
     {/* Add the Hero component here */}

      {/* Wrap existing content in a separate div for padding/margin */}
      <div className="flex flex-col items-start justify-center p-8 gap-8">
        <Card className="w-full max-w-[95vw] border border-gray-200 dark:border-gray-700 p-6 rounded-xl glass-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-4xl font-bold text-gray-800 dark:text-gray-200">
              sonicseeker
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Pass only the necessary handlers to AudioDrop */}
            <AudioDrop 
              onTranscriptionUpdate={handleTranscriptionUpdate} 
              onHypothesisUpdate={handleHypothesisUpdate}
              onPlayerReady={handlePlayerReady}
            />
          </CardContent>
        </Card>

        {/* Mind Map Card */}
        <Card className="w-full max-w-[95vw] border border-gray-200 dark:border-gray-700 p-6 rounded-xl glass-card">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
              Mind Map
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6"> {/* Add space between elements */}
            <GenerateMindMap />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}