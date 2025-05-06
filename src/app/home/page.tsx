'use client';
import Image from "next/image";
import { useEffect, useState, useMemo, useCallback, useRef } from "react"; // Added useMemo, useCallback, useRef
import { useRouter } from "next/navigation";
import GenerateMindMap from "@/components/GenerateMindMap";
import AudioDrop from "@/components/AudioDrop";
import Hero from "@/components/Hero"; // Import the Hero component
import WerComparison from "@/components/ComparisonDrop"; // Update the import name to match the exported component

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator"; // Import Separator
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import Table components

interface ParsedMetric {
  label: string;
  value: string;
}

export default function Home() {
  const [transcriptionMetrics, setTranscriptionMetrics] = useState<string[] | null>(null); // State for raw metrics strings
  const [transcriptionSegments, setTranscriptionSegments] = useState<any[]>([]); // State for transcription segments
  const [hypothesisText, setHypothesisText] = useState<string | null>(null); // State for the full hypothesis text
  const [currentAudioSource, setCurrentAudioSource] = useState<string | File | null>(null); // To track the source for seeking
  const mediaPlayerRef = useRef<any>(null); // Ref for media player (Video.js or WaveSurfer)

  // Handler for updating transcription metrics
  const handleMetricsUpdate = useCallback((metrics: string[] | null) => {
    setTranscriptionMetrics(metrics);
  }, []);

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

  // Use useMemo to parse metrics only when transcriptionMetrics changes
  const parsedMetrics: ParsedMetric[] = useMemo(() => {
    if (!transcriptionMetrics) return [];

    const metricsMap = new Map<string, string>(); // Use a map to store latest value for each label

    transcriptionMetrics.forEach(metric => {
      // Extract Language and Probability
      const langProbMatch = metric.match(/Detected language '(\w+)' with probability (\d+\.\d+)/);
      if (langProbMatch) {
        metricsMap.set("Detected Language", langProbMatch[1]);
        metricsMap.set("Language Probability", langProbMatch[2]);
        return;
      }

      // Extract Language (alternative format)
      const simpleLangMatch = metric.match(/Detected language: (\w+)/);
      if (simpleLangMatch && !metricsMap.has("Detected Language")) {
         metricsMap.set("Detected Language", simpleLangMatch[1]);
         // Probability might be unknown or logged separately
         return;
      }

      // Extract Model
      const modelMatch = metric.match(/Using Model: ([\w.-]+)/);
      if (modelMatch) {
        metricsMap.set("Transcription Model", modelMatch[1]);
        return;
      }

      // Extract Model Parameters
      const modelParamsMatch = metric.match(/Model Parameters: ([\d.]+)M/);
      if (modelParamsMatch) {
        metricsMap.set("Model Size", `${modelParamsMatch[1]}M parameters`);
        return;
      }

      // Extract VAD Status
      const vadMatch = metric.match(/VAD Enabled: (True|False)/i);
      if (vadMatch) {
        metricsMap.set("VAD Status", vadMatch[1]);
        return;
      }

      // Extract Audio File Info
      const audioSizeMatch = metric.match(/Audio File Size: ([\d.]+) MB/);
      if (audioSizeMatch) {
        metricsMap.set("File Size", `${audioSizeMatch[1]} MB`);
        return;
      }
      
      const audioFormatMatch = metric.match(/Audio File Format: (\w+)/);
      if (audioFormatMatch) {
        metricsMap.set("File Format", audioFormatMatch[1]);
        return;
      }
      
      const bitrateMatch = metric.match(/Audio Bitrate: ([\d.]+) MB\/s/);
      if (bitrateMatch) {
        metricsMap.set("Audio Bitrate", `${bitrateMatch[1]} MB/s`);
        return;
      }

      // Extract Transcription metrics
      const transcriptionTimeMatch = metric.match(/Transcription Processing Time: ([\d.]+) seconds/);
      if (transcriptionTimeMatch) {
        metricsMap.set("Processing Time", `${transcriptionTimeMatch[1]}s`);
        return;
      }
      
      const realtimeFactorMatch = metric.match(/Real-time Factor: ([\d.]+)x/);
      if (realtimeFactorMatch) {
        metricsMap.set("Real-time Factor", `${realtimeFactorMatch[1]}x`);
        return;
      }
      
      // Extract Transcript Statistics
      const segmentsMatch = metric.match(/Number of Segments: (\d+)/);
      if (segmentsMatch) {
        metricsMap.set("Segment Count", segmentsMatch[1]);
        return;
      }
      
      const wordCountMatch = metric.match(/Total Word Count: (\d+)/);
      if (wordCountMatch) {
        metricsMap.set("Word Count", wordCountMatch[1]);
        return;
      }
      
      const speechRateMatch = metric.match(/Speech Rate: ([\d.]+) words per minute/);
      if (speechRateMatch) {
        metricsMap.set("Speech Rate", `${speechRateMatch[1]} WPM`);
        return;
      }

      // Extract Confidence Statistics
      const avgConfidenceMatch = metric.match(/Average Word Confidence: ([\d.]+)/);
      if (avgConfidenceMatch) {
        metricsMap.set("Avg. Word Confidence", avgConfidenceMatch[1]);
        return;
      }
      
      const medianConfidenceMatch = metric.match(/Median Word Confidence: ([\d.]+)/);
      if (medianConfidenceMatch) {
        metricsMap.set("Median Confidence", medianConfidenceMatch[1]);
        return;
      }
      
      const minConfidenceMatch = metric.match(/Min Word Confidence: ([\d.]+)/);
      if (minConfidenceMatch) {
        metricsMap.set("Min Confidence", minConfidenceMatch[1]);
        return;
      }
      
      // Extract Diarization Status
      const diarizeReqMatch = metric.match(/Diarization Requested: (True|False)/i);
      if (diarizeReqMatch) {
          // Only set initial request status if final status isn't set yet
          if (!metricsMap.has("Diarization Status")) {
              metricsMap.set("Diarization Status", `Requested (${diarizeReqMatch[1]})`);
          }
          return;
      }
      
      const diarizeStatusMatch = metric.match(/Diarization Status: (.*)/);
      if (diarizeStatusMatch) {
        metricsMap.set("Diarization Status", diarizeStatusMatch[1]); // Overwrite initial request status
        return;
      }
      
      const speakersMatch = metric.match(/Number of Speakers Detected: (\d+)/);
      if (speakersMatch) {
        metricsMap.set("Speaker Count", speakersMatch[1]);
        return;
      }

      // Extract Overall Metrics
      const totalTimeMatch = metric.match(/Total Script Execution Time: ([\d.]+) seconds/);
      if (totalTimeMatch) {
        metricsMap.set("Total Processing Time", `${totalTimeMatch[1]}s`);
        return;
      }
      
      const processingEfficiencyMatch = metric.match(/Overall Processing Efficiency: ([\d.]+)x real-time/);
      if (processingEfficiencyMatch) {
        metricsMap.set("Processing Efficiency", `${processingEfficiencyMatch[1]}x real-time`);
        return;
      }

      // Extract Total Script Execution Time
      const timeMatch = metric.match(/Total Script Execution Time: ([\d.]+) seconds/);
      if (timeMatch) {
        metricsMap.set("Total Processing Time", `${timeMatch[1]}s`);
        return;
      }
       // Extract failure time
      const failTimeMatch = metric.match(/Total Script Execution Time: ([\d.]+) seconds \(Failed\)/);
      if (failTimeMatch) {
        metricsMap.set("Total Processing Time", `${failTimeMatch[1]}s (Failed)`);
        return;
      }

      // Extract Average Word Confidence
      const confidenceMatch = metric.match(/Average Word Confidence: (\d\.\d+)/);
      if (confidenceMatch) {
        metricsMap.set("Avg. Word Confidence", confidenceMatch[1]);
        return;
      }

    });

    // Convert map to array of ParsedMetric objects
    const metrics: ParsedMetric[] = [];
    // Define desired order
    const order = [
        "Detected Language",
        "Language Probability",
        "Word Count",
        "Speech Rate",
        "Avg. Word Confidence", 
        "Median Confidence",
        "Processing Time",
        "Real-time Factor",
        "Processing Efficiency",
        "Speaker Count",
        "Transcription Model",
        "Model Size",
        "Diarization Status",
        "Total Processing Time"
    ];

    order.forEach(label => {
        if (metricsMap.has(label)) {
            metrics.push({ label, value: metricsMap.get(label)! });
        }
    });

    // Add any other metrics found that weren't in the predefined order
    metricsMap.forEach((value, label) => {
        if (!order.includes(label)) {
            metrics.push({ label, value });
        }
    });


    return metrics;
  }, [transcriptionMetrics]);

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
            {/* Pass the metrics update handler to AudioDrop */}
            <AudioDrop onMetricsUpdate={setTranscriptionMetrics} onHypothesisUpdate={handleHypothesisUpdate} />
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
            {/* Metrics section removed from here */}
          </CardContent>
        </Card>

        {/* Conditionally render Metrics Card BELOW the Mind Map Card */}
        {/* Check parsedMetrics instead of transcriptionMetrics */}
        {parsedMetrics.length > 0 && (
          <Card className="w-full max-w-[95vw] border border-gray-200 dark:border-gray-700 p-6 rounded-xl glass-card">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-300">
                Transcription Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Use Shadcn Table component - Simplified 2-column layout */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Metric</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Map over the parsed metrics */}
                  {parsedMetrics.map((metric, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-sm">{metric.label}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{metric.value}</TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Add the new Comparison Component */}
        <div className="w-full max-w-[95vw]">
             <WerComparison hypothesisText={hypothesisText} />
        </div>

      </div>
</div>
);
}