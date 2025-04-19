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
import TranslationControls from "./TranslationControls";
import { analyzeSentimentDetailed, getSentimentCategory } from "@/lib/sentiment-analyzer";
import { toast } from "sonner";

interface TranscriptSegment {
  start: string;
  end: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
  speaker?: string;
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
  segments: TranscriptSegment[];
  onSegmentClick?: (segment: TranscriptSegment) => void;
  onWordClick?: (timestamp: number) => void;
  activeSegmentIndex?: number;
  currentTime?: number;
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

  const enhancedSegments = useMemo(() => {
    return segments.map(segment => ({
      ...segment,
      start_seconds: typeof segment.start_seconds === 'number' ? segment.start_seconds : 0,
      end_seconds: typeof segment.end_seconds === 'number' ? segment.end_seconds : 0,
      speaker: segment.speaker,
      sentiment: segment.sentiment || getSentimentCategory(segment.text),
      tags: segment.tags,
      actions: segment.actions,
    }));
  }, [segments]);

  const stats = useMemo(() => {
    const allText = enhancedSegments.map(s => s.text).join(' ');
    const charCount = allText.length;
    const wordCount = allText.split(/\s+/).filter(Boolean).length;
    const sentenceCount = allText.split(/[.!?]+/).filter(Boolean).length;

    const sentimentAnalysis = analyzeSentimentDetailed(allText);

    const allWords = allText.toLowerCase().split(/\s+/).filter(Boolean);

    const positiveWordSet = new Set(sentimentAnalysis.positive.map(w => w.toLowerCase()));
    const negativeWordSet = new Set(sentimentAnalysis.negative.map(w => w.toLowerCase()));

    const positiveWordCount = allWords.filter(word => positiveWordSet.has(word)).length;
    const negativeWordCount = allWords.filter(word => negativeWordSet.has(word)).length;

    const sentimentCounts = {
      positive: enhancedSegments.filter(s => s.sentiment === 'positive').length,
      neutral: enhancedSegments.filter(s => s.sentiment === 'neutral').length,
      negative: enhancedSegments.filter(s => s.sentiment === 'negative').length,
    };

    const speakerCounts = enhancedSegments.reduce((acc: Record<string, number>, segment) => {
      const speaker = segment.speaker || "Unknown";
      acc[speaker] = (acc[speaker] || 0) + 1;
      return acc;
    }, {});

    const allTags = enhancedSegments
      .flatMap(s => s.tags || [])
      .reduce((acc: Record<string, number>, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

    const allActions = enhancedSegments
      .flatMap(s => s.actions || [])
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
      speakerCounts,
    };
  }, [enhancedSegments]);

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
          <span key={i} className="bg-yellow-700 text-white px-1 rounded">
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
      onSegmentClick(segment);
    }
  };

  const processTextWithTimestamps = (segment: TranscriptSegment) => {
    if (!segment.words || segment.words.length === 0) {
      return searchTerm ? highlightSearchTerm(segment.text) : segment.text;
    }

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
              className={`cursor-pointer hover:bg-blue-900/50 px-[1px] rounded ${
                isActive ? 'bg-blue-800 text-white' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (onWordClick) {
                  onWordClick(word.start);
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
          <p className="text-center text-muted-foreground">No transcript available</p>
        </CardContent>
      </Card>
    );
  }

  const fullTranscriptText = useMemo(() => {
    return segments.map(segment => segment.text).join(' ');
  }, [segments]);

  const sentimentChartData = [
    { name: 'Positive Words', value: stats.positiveWordCount },
    { name: 'Negative Words', value: stats.negativeWordCount },
  ];

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-foreground">Transcript</CardTitle>
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
              <p className="text-center text-muted-foreground py-4">No matches found</p>
            ) : (
              <div className="border-b border-border">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/6">
                        Time
                      </th>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/12">
                        Speaker
                      </th>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Text
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredSegments.map((segment, index) => {
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
                              ? 'bg-blue-900/30' 
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm timestamp-cell font-mono">
                            {segment.start} - {segment.end}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-muted-foreground">
                            {segment.speaker || '---'}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">
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
                <h3 className="text-lg font-medium text-foreground">Transcript Statistics</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 p-3 rounded text-center">
                    <p className="text-2xl font-bold">{stats.charCount}</p>
                    <p className="text-xs text-muted-foreground">Characters</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded text-center">
                    <p className="text-2xl font-bold">{stats.wordCount}</p>
                    <p className="text-xs text-muted-foreground">Words</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded text-center">
                    <p className="text-2xl font-bold">{stats.sentenceCount}</p>
                    <p className="text-xs text-muted-foreground">Sentences</p>
                  </div>
                </div>
                
                <h3 className="text-lg font-medium mt-4 text-foreground">Sentiment Words</h3>
                <div className="flex justify-between">
                  <div className="bg-green-900/30 p-3 rounded text-center flex-1 mr-2">
                    <p className="text-2xl font-bold text-green-200">{stats.positiveWordCount}</p>
                    <p className="text-xs text-green-300">Positive Words</p>
                  </div>
                  <div className="bg-red-900/30 p-3 rounded text-center flex-1 ml-2">
                    <p className="text-2xl font-bold text-red-200">{stats.negativeWordCount}</p>
                    <p className="text-xs text-red-300">Negative Words</p>
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
                <h3 className="text-lg font-medium text-foreground">Speaker Distribution</h3>
                {Object.keys(stats.speakerCounts).length > 0 ? (
                  <div className="h-[200px]">
                    <BarChart 
                      data={Object.entries(stats.speakerCounts)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)}
                    />
                  </div>
                ) : (
                  <p className="text-muted-foreground">Speaker identification not available or not performed.</p>
                )}
                
                <h3 className="text-lg font-medium mt-4 text-foreground">Top Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.allTags)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([tag, count]) => (
                      <Badge key={tag} variant="secondary">{tag} ({count})</Badge>
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
            onSeekTo={(time) => {
              if (onWordClick) {
                onWordClick(time);
              } else if (onSegmentClick) {
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
                onWordClick(time);
              } else if (onSegmentClick) {
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
                onWordClick(time);
              } else if (onSegmentClick) {
                const segmentIndex = enhancedSegments.findIndex(s => time >= s.start_seconds && time <= s.end_seconds);
                if (segmentIndex >= 0) {
                  onSegmentClick(enhancedSegments[segmentIndex]);
                }
              }
            }}
          />
        </TabsContent>
      </Tabs>
      
      <CardFooter className="flex justify-between text-xs text-muted-foreground border-t border-border pt-4">
        <span>{enhancedSegments.length} segments</span>
        <span>{stats.wordCount} words · {stats.charCount} characters</span>
      </CardFooter>
    </Card>
  );
}
