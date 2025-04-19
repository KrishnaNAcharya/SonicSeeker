"use client";
import { useState, useMemo } from "react";
import SentimentItem from "./SentimentItem";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { analyzeSentimentDetailed } from "@/lib/sentiment-analyzer";

interface SentimentAnalysisProps {
  segments: any[];
  wordCounts?: {
    positive: number;
    negative: number;
  };
  onSeekTo?: (time: number) => void;
}

export default function SentimentAnalysis({ 
  segments, 
  wordCounts,
  onSeekTo 
}: SentimentAnalysisProps) {
  const [emotion, setEmotion] = useState<'positive' | 'negative' | null>(null);
  const [sentimentList, setSentimentList] = useState<any[]>([]);

  // Create a transcript object with words array for seeking
  const transcript = useMemo(() => {
    const words = segments.flatMap((segment, segmentIndex) => {
      // Split each segment's text into words with estimated time positions
      const words = segment.text.split(/\s+/).filter(Boolean);
      const segmentDuration = (segment.end_seconds || 0) - (segment.start_seconds || 0);
      const wordDuration = segmentDuration / words.length;
      
      return words.map((word: string, wordIndex: number) => ({
        word,
        start: (segment.start_seconds || 0) + wordIndex * wordDuration,
        end: (segment.start_seconds || 0) + (wordIndex + 1) * wordDuration,
        segmentIndex
      }));
    });

    return {
      transcript: segments.map(s => s.text).join(' '),
      words
    };
  }, [segments]);

  // Use sentiment library to analyze the transcript
  const analysis = useMemo(() => {
    return analyzeSentimentDetailed(transcript.transcript);
  }, [transcript.transcript]);

  // Extract all words from transcript for efficient lookups
  const transcriptWords = useMemo(() => 
    transcript.words.map(w => w.word.toLowerCase()),
  [transcript.words]);
  
  // Ensure we look up words in a case-insensitive way by creating lowercase sets
  const lowercasePositiveWords = useMemo(() => 
    new Set(analysis.positive.map(word => word.toLowerCase())), 
  [analysis.positive]);
  
  const lowercaseNegativeWords = useMemo(() => 
    new Set(analysis.negative.map(word => word.toLowerCase())), 
  [analysis.negative]);

  // Count all sentiment word occurrences in the transcript
  const sentimentOccurrences = useMemo(() => {
    // If wordCounts are provided from parent, use those
    if (wordCounts) {
      return wordCounts;
    }
    
    // Otherwise calculate our own
    const allWords = transcriptWords;
    
    const positiveWords = allWords.filter(word => 
      lowercasePositiveWords.has(word.toLowerCase())
    );
    
    const negativeWords = allWords.filter(word => 
      lowercaseNegativeWords.has(word.toLowerCase())
    );
    
    return {
      positive: positiveWords.length,
      negative: negativeWords.length
    };
  }, [transcriptWords, lowercasePositiveWords, lowercaseNegativeWords, wordCounts]);

  // Set the sentiment list based on selected emotion - get ALL occurrences
  const handleSetEmotion = (type: 'positive' | 'negative') => {
    setEmotion(type);
    
    // Use the appropriate lowercase set for comparison
    const sentimentWordSet = type === 'positive' ? lowercasePositiveWords : lowercaseNegativeWords;
    
    // Find all occurrences of all sentiment words in the transcript
    const matches: any[] = [];
    
    transcript.words.forEach((wordObj, wordIndex) => {
      if (sentimentWordSet.has(wordObj.word.toLowerCase())) {
        // Find the score for this word from the sentiment analysis
        // Look through calculation list to find the matching word
        const wordEntry = analysis.calculation.find(calc => {
          const key = Object.keys(calc)[0].toLowerCase();
          return key === wordObj.word.toLowerCase();
        });
        
        // Get the score for this word
        const score = wordEntry ? Object.values(wordEntry)[0] : (type === 'positive' ? 1 : -1);
        
        matches.push({
          ...wordObj,
          index: wordIndex,
          score
        });
      }
    });
    
    setSentimentList(matches);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sentiment Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Positive/Negative buttons */}
            <div className="flex justify-between items-center">
              <div 
                className="cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 p-4 rounded-md flex-1 text-center"
                onClick={() => handleSetEmotion('positive')}
              >
                <h3 className="text-green-500 font-semibold text-lg">Positive</h3>
                <p className="mt-1">
                  <span className="font-medium">{sentimentOccurrences.positive}</span> words
                </p>
              </div>
              <div 
                className="cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 p-4 rounded-md flex-1 text-center" 
                onClick={() => handleSetEmotion('negative')}
              >
                <h3 className="text-red-500 font-semibold text-lg">Negative</h3>
                <p className="mt-1">
                  <span className="font-medium">{sentimentOccurrences.negative}</span> words
                </p>
              </div>
            </div>
            
            {/* Sentiment meter */}
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-2">Overall Sentiment</h3>
              <div className="flex items-center space-x-2">
                <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${analysis.score >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ 
                      width: `${Math.min(100, Math.abs(analysis.comparative * 100))}%`,
                      marginLeft: analysis.comparative >= 0 ? '50%' : undefined,
                      marginRight: analysis.comparative < 0 ? '50%' : undefined,
                    }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span>Negative</span>
                <span></span>
                <span>Positive</span>
              </div>
            </div>

            {/* Key words - show words found in both the sentiment library and the transcript */}
            <div>
              <h3 className="font-medium mb-2">Words Found in Transcript</h3>
              
              {/* Positive words that actually appear in the transcript */}
              <div className="mb-2">
                <h4 className="text-sm text-green-600 mb-1">Positive Words</h4>
                <div className="flex flex-wrap gap-2">
                  {transcript.words
                    .map(w => w.word.toLowerCase())
                    .filter(word => lowercasePositiveWords.has(word))
                    .filter((word, i, arr) => arr.indexOf(word) === i) // Unique words only
                    .slice(0, 10)
                    .map((word, i) => (
                      <Badge key={`p-${i}`} variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                        {word}
                      </Badge>
                    ))}
                </div>
              </div>
              
              {/* Negative words that actually appear in the transcript */}
              <div>
                <h4 className="text-sm text-red-600 mb-1">Negative Words</h4>
                <div className="flex flex-wrap gap-2">
                  {transcript.words
                    .map(w => w.word.toLowerCase())
                    .filter(word => lowercaseNegativeWords.has(word))
                    .filter((word, i, arr) => arr.indexOf(word) === i) // Unique words only
                    .slice(0, 10)
                    .map((word, i) => (
                      <Badge key={`n-${i}`} variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                        {word}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right panel - sentiment words */}
          <div className="border rounded-md">
            {emotion ? (
              <div className="h-full flex flex-col">
                <div className="border-b p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      {emotion.charAt(0).toUpperCase() + emotion.slice(1)} Words
                    </h3>
                    <Badge className={emotion === 'positive' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {sentimentList.length} occurrences
                    </Badge>
                  </div>
                </div>
                
                <div className="overflow-auto flex-1 p-2">
                  {sentimentList.length > 0 ? (
                    sentimentList
                      .sort((a, b) => a.start - b.start)
                      .map((item, index) => (
                        <SentimentItem
                          key={index}
                          transcript={transcript}
                          index={item.index}
                          sentiment={emotion}
                          score={item.score}
                          word={item.word}
                          time={item.start}
                          onClick={() => onSeekTo?.(item.start)}
                        />
                      ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No {emotion} words found
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6 text-gray-500">
                <p>Select a sentiment type to see details</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
