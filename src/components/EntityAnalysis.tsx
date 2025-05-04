"use client";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import EntityItem from "./EntityItem";
// Import only the main compromise library
import nlp from "compromise";

interface EntityAnalysisProps {
  segments: any[];
  onSeekTo?: (time: number) => void;
}

// List of entities we want to detect with compromise
const entities = [
  { name: "Person", tag: "Person" },
  { name: "Place", tag: "Place" },
  { name: "Organization", tag: "Organization" },
  { name: "Date", tag: "Date" },
  { name: "Money", tag: "Money" },
  { name: "Unit", tag: "Unit" },
  { name: "Verb", tag: "Verb" },
  { name: "Adjective", tag: "Adjective" }
];

// Helper function to manually detect units in text
function findUnits(text: string): string[] {
  const unitPatterns = [
    // Common units with numbers
    /(\d+(?:\.\d+)?)\s*(kg|g|mg|lb|oz|km|m|cm|mm|mi|miles|ft|feet|in|inch|inches|l|ml|gal|gallons|°C|°F|%|percent)/gi,
    // Time units
    /(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|minute|minutes|min|mins|second|seconds|sec|secs|day|days|week|weeks|month|months|year|years)/gi,
    // Technical units
    /(\d+(?:\.\d+)?)\s*(hz|kHz|mHz|mb|gb|tb|kb|watts|joules|volts|amps)/gi,
    // Currency with symbols
    /(\$|€|£|¥)(\d+(?:\.\d+)?)/g,
  ];

  const matches: string[] = [];
  
  unitPatterns.forEach(pattern => {
    const results = text.matchAll(pattern);
    for (const match of results) {
      if (match[0]) {
        matches.push(match[0].trim());
      }
    }
  });
  
  return [...new Set(matches)]; // Remove duplicates
}

export default function EntityAnalysis({ segments, onSeekTo }: EntityAnalysisProps) {
  const [activeEntity, setActiveEntity] = useState<string>("");
  const [entityArray, setEntityArray] = useState<any[]>([]);

  // Create a transcript object with words array for seeking
  const transcript = useMemo(() => {
    const fullText = segments.map(s => s.text).join(' ');
    
    // Map each word to its approximate timestamp
    const words = segments.flatMap((segment, segmentIndex) => {
      const segmentWords = segment.text.split(/\s+/).filter(Boolean);
      const segmentDuration = (segment.end_seconds || 0) - (segment.start_seconds || 0);
      const wordDuration = segmentDuration / (segmentWords.length || 1); // Avoid division by zero
      
      return segmentWords.map((word: string, wordIndex: number) => ({
        word,
        start: (segment.start_seconds || 0) + wordIndex * wordDuration,
        end: (segment.start_seconds || 0) + (wordIndex + 1) * wordDuration,
        segmentIndex
      }));
    });

    return {
      transcript: fullText,
      words
    };
  }, [segments]);

  // Extract entities from the transcript text
  const extractedEntities = useMemo(() => {
    try {
      console.log("Running NLP analysis on transcript");
      // Initialize compromise NLP
      const doc = nlp(transcript.transcript);
      
      const results: Record<string, string[]> = {};
      
      // Use pure compromise tags and methods
      entities.forEach(({ name, tag }) => {
        try {
          let matches: string[] = [];
          
          switch (tag) {
            case 'Person':
              matches = doc.match('#Person').out('array');
              break;
            case 'Place':
              matches = doc.match('#Place').out('array');
              break;
            case 'Organization':
              matches = doc.match('#Organization').out('array');
              break;
            case 'Date':
              matches = doc.match('#Date').out('array');
              break;
            case 'Money':
              matches = doc.match('#Money').out('array');
              break;
            case 'Unit':
              // Custom implementation for units since compromise doesn't handle them well
              matches = findUnits(transcript.transcript);
              break;
            case 'Verb':
              matches = doc.match('#Verb').out('array');
              break;
            case 'Adjective':
              matches = doc.match('#Adjective').out('array');
              break;
            default:
              matches = doc.match('#' + tag).out('array');
          }
          
          // Store unique entity values
          results[name] = Array.from(
            new Set(matches
              .map((text: string) => text?.trim())
              .filter(Boolean)
              .filter((text: string) => text.length > 1)
            )
          );
        } catch (err) {
          console.error(`Error extracting ${name} entities:`, err);
          results[name] = [];
        }
      });
      
      return results;
    } catch (error) {
      console.error("Error extracting entities:", error);
      return {};
    }
  }, [transcript.transcript]);
  
  // Count entities
  const entityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    entities.forEach(({ name }) => {
      counts[name] = extractedEntities[name]?.length || 0;
    });
    
    return counts;
  }, [extractedEntities]);

  // Find all occurrences of the selected entity in the transcript
  useEffect(() => {
    if (!activeEntity || !extractedEntities[activeEntity]) {
      setEntityArray([]);
      return;
    }

    const entityTerms = extractedEntities[activeEntity] || [];
    const foundEntities: any[] = [];
    
    // Special handling for units which may contain special characters
    if (activeEntity === 'Unit') {
      entityTerms.forEach(term => {
        if (!term || term.length < 2) return;
        
        // For units, search the original text segments
        segments.forEach((segment, segmentIndex) => {
          const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          let match;
          
          while ((match = regex.exec(segment.text)) !== null) {
            // Find approximate position in transcript.words
            const segmentStartIdx = transcript.words.findIndex(w => 
              w.segmentIndex === segmentIndex
            );
            
            if (segmentStartIdx >= 0) {
              // Approximate word index
              const wordOffset = segment.text.substring(0, match.index)
                .split(/\s+/).length - 1;
              
              const wordIndex = Math.max(0, segmentStartIdx + wordOffset);
              
              foundEntities.push({
                ...transcript.words[wordIndex],
                index: wordIndex,
                word: term,
                endIndex: wordIndex + term.split(/\s+/).length - 1
              });
            }
          }
        });
      });
    } else {
      // Existing approach for other entity types
      entityTerms.forEach(term => {
        if (!term || term.length < 2) return;
      
        const termLower = term.toLowerCase();
        const termWords = termLower.split(/\s+/);
        const wordsArray = transcript.words;
        
        // Find all occurrences of this term in the transcript
        for (let i = 0; i < wordsArray.length - termWords.length + 1; i++) {
          let isMatch = true;
          
          // Check if each word matches
          for (let j = 0; j < termWords.length; j++) {
            const wordToMatch = termWords[j];
            const transcriptWord = wordsArray[i + j].word.toLowerCase();
            
            if (transcriptWord !== wordToMatch) {
              isMatch = false;
              break;
            }
          }
          
          if (isMatch) {
            // Found a match for this term
            foundEntities.push({
              ...wordsArray[i],
              index: i,
              word: term,
              endIndex: i + termWords.length - 1
            });
            
            // Skip ahead to avoid overlapping matches
            i += termWords.length - 1;
          }
        }
      });
    }
    
    // Set the array of found entities
    setEntityArray(foundEntities);
  }, [activeEntity, extractedEntities, transcript.words, segments]);

  const handleEntityClick = (entity: string) => {
    setActiveEntity(activeEntity === entity ? "" : entity);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Entity Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Entity selection */}
            <div className="grid grid-cols-3 gap-3">
              {entities.map(({ name }) => (
                <div 
                  key={name}
                  className={`cursor-pointer p-3 rounded-md flex flex-col items-center transition-colors
                    ${activeEntity === name 
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  onClick={() => handleEntityClick(name)}
                >
                  <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400">{name}</h3>
                  <p className="mt-1 text-xs">
                    <span className="font-medium">{entityCounts[name] || 0}</span> found
                  </p>
                </div>
              ))}
            </div>
            
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-2">About Entity Analysis</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Entity analysis identifies important elements in your transcript: people, places, 
                organizations, dates, and more. Click on any entity type to explore occurrences.
              </p>
            </div>
            
            {/* Show examples of found entities */}
            {activeEntity && extractedEntities[activeEntity]?.length > 0 && (
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Found {activeEntity} Entities</h3>
                <div className="flex flex-wrap gap-2">
                  {extractedEntities[activeEntity].slice(0, 15).map((entity, i) => (
                    <Badge key={i} variant="outline" className="text-blue-600">
                      {entity}
                    </Badge>
                  ))}
                  {extractedEntities[activeEntity].length > 15 && (
                    <Badge variant="outline">+{extractedEntities[activeEntity].length - 15} more</Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right panel - entity occurrences */}
          <div className="border rounded-md">
            {activeEntity ? (
              <div className="h-full flex flex-col">
                <div className="border-b p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      Entity: <span className="text-blue-600">{activeEntity}</span>
                    </h3>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {entityArray.length} occurrences
                    </Badge>
                  </div>
                </div>
                
                <div className="overflow-auto flex-1 p-2 max-h-[300px]">
                  {entityArray.length > 0 ? (
                    entityArray
                      .sort((a, b) => a.start - b.start)
                      .map((item, index) => (
                        <EntityItem
                          key={index}
                          transcript={transcript}
                          index={item.index}
                          sequence={index}
                          entity={activeEntity}
                          word={item.word}
                          time={item.start}
                          color="blue"
                          onClick={() => onSeekTo?.(item.start)}
                        />
                      ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No {activeEntity} entities found in transcript
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6 text-gray-500">
                <p>Select an entity type to see occurrences</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
