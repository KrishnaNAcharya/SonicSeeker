"use client";
import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, PieChart } from "@/components/ui/charts";
import SentimentAnalysis from "./SentimentAnalysis";
import EntityAnalysis from "./EntityAnalysis";
import GrammarAnalysis from "./GrammarAnalysis";
import TranslationControls from "./TranslationControls"; // Import the new component
import { analyzeSentimentDetailed, getSentimentCategory } from "@/lib/sentiment-analyzer";
import { toast } from "sonner"; // Make sure you have this package installed or use your preferred toast library

interface TranscriptSegment {
  start: string; // Keep HH:MM:SS for display
  end: string;   // Keep HH:MM:SS for display
  start_seconds: number; // Expect number from props
  end_seconds: number;   // Expect number from props
  text: string;
  speaker?: string; // Add speaker field
  sentiment?: 'positive' | 'negative' | 'neutral';
  tags?: string[];
  actions?: string[];
  words?: {
    word: string;
    start: number;
    end: number;
  }[];
}

interface TranscriptProps {
  segments: TranscriptSegment[]; // Expect segments to already have start_seconds/end_seconds
  onSegmentClick?: (segment: TranscriptSegment) => void;
  onWordClick?: (timestamp: number) => void; // Add this new handler
  activeSegmentIndex?: number;
  currentTime?: number; // Add this to track current playback time
}

export default function Transcript({
  segments,
  onSegmentClick,
  onWordClick,
  activeSegmentIndex = -1,
  currentTime = 0
}: TranscriptProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredSegments, setFilteredSegments] = useState<TranscriptSegment[]>(segments);
  const [analysisTab, setAnalysisTab] = useState<string>("transcript");
  const [isSaving, setIsSaving] = useState(false);

  // Enhance segments ONLY with sentiment if not already present
  const enhancedSegments = useMemo(() => {
    return segments.map(segment => ({
      ...segment,
      // Ensure seconds are numbers, default if necessary
      start_seconds: typeof segment.start_seconds === 'number' ? segment.start_seconds : 0,
      end_seconds: typeof segment.end_seconds === 'number' ? segment.end_seconds : 0,
      speaker: segment.speaker, // Ensure speaker is carried over
      sentiment: segment.sentiment || getSentimentCategory(segment.text),
      tags: segment.tags,
      actions: segment.actions,
    }));
  }, [segments]);

  // Calculate stats (ensure it uses enhancedSegments)
  const stats = useMemo(() => {
    const allText = enhancedSegments.map(s => s.text).join(' ');
    const charCount = allText.length;
    const wordCount = allText.split(/\s+/).filter(Boolean).length;
    const sentenceCount = allText.split(/[.!?]+/).filter(Boolean).length;
    
    // Get detailed sentiment analysis for the whole transcript
    const sentimentAnalysis = analyzeSentimentDetailed(allText);
    
    // Count positive and negative words - calculate actual occurrences
    const allWords = allText.toLowerCase().split(/\s+/).filter(Boolean);
    
    // Create lowercase sets for faster lookups
    const positiveWordSet = new Set(sentimentAnalysis.positive.map(w => w.toLowerCase()));
    const negativeWordSet = new Set(sentimentAnalysis.negative.map(w => w.toLowerCase()));
    
    // Count actual occurrences in the transcript
    const positiveWordCount = allWords.filter(word => positiveWordSet.has(word)).length;
    const negativeWordCount = allWords.filter(word => negativeWordSet.has(word)).length;
    
    // Count sentiment distribution by segment
    const sentimentCounts = {
      positive: enhancedSegments.filter(s => s.sentiment === 'positive').length,
      neutral: enhancedSegments.filter(s => s.sentiment === 'neutral').length,
      negative: enhancedSegments.filter(s => s.sentiment === 'negative').length,
    };
    
    // Count segments per speaker
    const speakerCounts = enhancedSegments.reduce((acc: Record<string, number>, segment) => {
      const speaker = segment.speaker || "Unknown";
      acc[speaker] = (acc[speaker] || 0) + 1;
      return acc;
    }, {});
    
    // Collect all tags and actions
    const allTags = enhancedSegments
      .flatMap(s => s.tags || []) // Use empty array if tags undefined
      .reduce((acc: Record<string, number>, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});
    
    const allActions = enhancedSegments
      .flatMap(s => s.actions || []) // Use empty array if actions undefined
      .reduce((acc: Record<string, number>, action) => {
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      }, {});
      
    return {
      charCount,
      wordCount,
      sentenceCount,
      sentimentCounts,
      positiveWordCount,
      negativeWordCount,
      positiveUniqueWordCount: sentimentAnalysis.positive.length,
      negativeUniqueWordCount: sentimentAnalysis.negative.length,
      sentimentAnalysis,
      allTags,
      allActions,
      speakerCounts, // Add speaker counts to stats
    };
  }, [enhancedSegments]);

  // Filter segments based on search term (uses enhancedSegments)
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredSegments(enhancedSegments);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = enhancedSegments.filter(segment =>
        segment.text.toLowerCase().includes(term)
      );
      setFilteredSegments(filtered);
    }
  }, [searchTerm, enhancedSegments]);

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm.trim()) return text;

    try {
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedTerm})`, 'gi');
      const parts = text.split(regex);

      return parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-yellow-200 dark:bg-yellow-800">
            {part}
          </span>
        ) : (
          part
        )
      );
    } catch (e) {
      return text;
    }
  };

  const handleSegmentClick = (segment: TranscriptSegment) => {
    if (onSegmentClick) {
      onSegmentClick(segment); // Pass the segment object
    }
  };

  // Add a function to process text with word timestamps
  const processTextWithTimestamps = (segment: TranscriptSegment) => {
    if (!segment.words || segment.words.length === 0) {
      return searchTerm ? highlightSearchTerm(segment.text) : segment.text;
    }

    // Split the text into words with timestamps for click events
    return (
      <span className="word-timestamps">
        {segment.words.map((word, idx) => {
          const isActive = currentTime >= word.start && currentTime <= word.end;
          const content = searchTerm ? 
            highlightSearchTerm(word.word + (idx < segment.words!.length - 1 ? ' ' : '')) : 
            word.word + (idx < segment.words!.length - 1 ? ' ' : '');

          return (
            <span
              key={idx}
              className={`cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 px-[1px] rounded ${
                isActive ? 'bg-blue-200 dark:bg-blue-800' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation(); // Prevent the segment click from triggering
                if (onWordClick) {
                  onWordClick(word.start); // Pass the exact word timestamp
                }
              }}
            >
              {content}
            </span>
          );
        })}
      </span>
    );
  };

  // Function to save transcript data
  const saveTranscript = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/save-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enhancedSegments),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Transcript saved successfully');
      } else {
        toast.error(`Failed to save transcript: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
      toast.error('Failed to save transcript. See console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!segments || segments.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <p className="text-center text-gray-500">No transcript available</p>
        </CardContent>
      </Card>
    );
  }

  // Get the full transcript text for translation
  const fullTranscriptText = useMemo(() => {
    return segments.map(segment => segment.text).join(' ');
  }, [segments]);

  // Prepare chart data for sentiment analysis - use actual word occurrences
  const sentimentChartData = [
    { name: 'Positive Words', value: stats.positiveWordCount },
    { name: 'Negative Words', value: stats.negativeWordCount },
  ];

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Transcript</CardTitle>
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            type="text"
            placeholder="Search in transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          {searchTerm && (
            <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}>
              Clear
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={saveTranscript}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Transcript'}
          </Button>
        </div>
      </CardHeader>
      
      <Tabs value={analysisTab} onValueChange={setAnalysisTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="translation">Translation</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="grammar">Grammar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="transcript" className="mt-0">
          <CardContent className="max-h-[600px] overflow-y-auto p-0">
            {filteredSegments.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No matches found</p>
            ) : (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  {/* **** Restore the table header **** */}
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/6">
                        Time
                      </th>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/12"> {/* Add Speaker column */}
                        Speaker
                      </th>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Text
                      </th>
                    </tr>
                  </thead>
                  {/* **** Restore the table body **** */}
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredSegments.map((segment, index) => {
                      // Find original index in the unfiltered segments array
                      const originalIndex = enhancedSegments.findIndex(s => 
                        s.start === segment.start && s.text === segment.text
                      );
                      const isActive = originalIndex === activeSegmentIndex;
                      
                      return (
                        <tr 
                          key={index}
                          onClick={() => handleSegmentClick(segment)}
                          className={`cursor-pointer transition-colors ${
                            isActive 
                              ? 'bg-blue-50 dark:bg-blue-900/20' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {/* Ensure timestamp cell has correct classes */}
                          <td className="px-4 py-3 whitespace-nowrap text-sm timestamp-cell font-mono">
                            {segment.start} - {segment.end}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                            {segment.speaker || '---'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                            {processTextWithTimestamps(segment)}
                            {segment.tags && segment.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {segment.tags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    #{tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </TabsContent>
        
        <TabsContent value="translation" className="mt-0">
          <TranslationControls transcriptText={fullTranscriptText} />
        </TabsContent>
        
        <TabsContent value="analysis" className="mt-0 space-y-4">
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Transcript Statistics</h3>
                <div className="grid grid-cols-3 gap-2">
                  {/* **** Restore analysis content **** */}
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-center">
                    <p className="text-2xl font-bold">{stats.charCount}</p>
                    <p className="text-xs text-gray-500">Characters</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-center">
                    <p className="text-2xl font-bold">{stats.wordCount}</p>
                    <p className="text-xs text-gray-500">Words</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-center">
                    <p className="text-2xl font-bold">{stats.sentenceCount}</p>
                    <p className="text-xs text-gray-500">Sentences</p>
                  </div>
                </div>
                
                <h3 className="text-lg font-medium mt-4">Sentiment Words</h3>
                <div className="flex justify-between">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-center flex-1 mr-2">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.positiveWordCount}</p>
                    <p className="text-xs text-gray-500">Positive Words</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded text-center flex-1 ml-2">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.negativeWordCount}</p>
                    <p className="text-xs text-gray-500">Negative Words</p>
                  </div>
                </div>
                
                <div className="h-[200px] mt-4">
                  <PieChart 
                    data={sentimentChartData} 
                    colors={['#10B981', '#EF4444']}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Speaker Distribution</h3>
                {Object.keys(stats.speakerCounts).length > 0 ? (
                  <div className="h-[200px]">
                    <BarChart 
                      data={Object.entries(stats.speakerCounts)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)} // Sort speakers by count
                    />
                  </div>
                ) : (
                  <p className="text-gray-500">Speaker identification not available or not performed.</p>
                )}
                
                <h3 className="text-lg font-medium mt-4">Top Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.allTags)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([tag, count]) => (
                      <Badge key={tag} className="text-xs">
                        #{tag} ({count})
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </TabsContent>

        <TabsContent value="sentiment" className="mt-0 space-y-4">
          <SentimentAnalysis 
            segments={enhancedSegments} 
            wordCounts={{
              positive: stats.positiveWordCount,
              negative: stats.negativeWordCount
            }}
            onSeekTo={(time) => { // time is already in seconds
              if (onWordClick) {
                // Directly use the timestamp
                onWordClick(time);
              } else if (onSegmentClick) {
                // Fallback to segment click if needed
                const segmentIndex = enhancedSegments.findIndex(s => time >= s.start_seconds && time <= s.end_seconds);
                if (segmentIndex >= 0) {
                  onSegmentClick(enhancedSegments[segmentIndex]);
                }
              }
            }}
          />
        </TabsContent>

        <TabsContent value="entities" className="mt-0 space-y-4">
          <EntityAnalysis 
            segments={enhancedSegments} 
            onSeekTo={(time) => {
              if (onWordClick) {
                // Directly use the timestamp
                onWordClick(time);
              } else if (onSegmentClick) {
                // Fallback to segment click if needed
                const segmentIndex = enhancedSegments.findIndex(s => time >= s.start_seconds && time <= s.end_seconds);
                if (segmentIndex >= 0) {
                  onSegmentClick(enhancedSegments[segmentIndex]);
                }
              }
            }}
          />
        </TabsContent>

        <TabsContent value="grammar" className="mt-0 space-y-4">
          <GrammarAnalysis 
            segments={enhancedSegments} 
            onSeekTo={(time) => {
              if (onWordClick) {
                // Directly use the timestamp
                onWordClick(time);
              } else if (onSegmentClick) {
                // Fallback to segment click if needed
                const segmentIndex = enhancedSegments.findIndex(s => time >= s.start_seconds && time <= s.end_seconds);
                if (segmentIndex >= 0) {
                  onSegmentClick(enhancedSegments[segmentIndex]);
                }
              }
            }}
          />
        </TabsContent>
      </Tabs>
      
      <CardFooter className="flex justify-between text-xs text-gray-500 border-t pt-4">
        <span>{enhancedSegments.length} segments</span>
        <span>{stats.wordCount} words · {stats.charCount} characters</span>
      </CardFooter>
    </Card>
  );
}
