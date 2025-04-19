"use client";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import EntityItem from "./EntityItem";
import nlp from "compromise";

interface GrammarAnalysisProps {
  segments: any[];
  onSeekTo?: (time: number) => void;
}

// List of grammar categories to analyze
const grammarCategories = [
  { name: "Auxiliary", tag: "Auxiliary", description: "Important for tense/voice (\"is\", \"have\", \"was\")" },
  { name: "Negative", tag: "Negative", description: "Crucial for detecting sentiment or negation (\"not\", \"never\")" },
  { name: "Acronym", tag: "Acronym", description: "Often represent key entities or topics (\"NASA\", \"FBI\")" },
  { name: "Adverb", tag: "Adverb", description: "Adds context to actions (\"quickly\", \"seriously\")" },
  { name: "Determiner", tag: "Determiner", description: "Helps in grammatical structure (\"the\", \"some\")" },
  { name: "Conjunction", tag: "Conjunction", description: "Important for structure and connecting ideas (\"and\", \"but\")" },
  { name: "Preposition", tag: "Preposition", description: "Aids in understanding relationships (\"in\", \"on\", \"under\")" },
  { name: "QuestionWord", tag: "QuestionWord", description: "Helps identify questions (\"why\", \"how\", \"what\")" },
  { name: "Pronoun", tag: "Pronoun", description: "Keeps track of subjects (\"he\", \"they\")" },
  { name: "HashTag", tag: "HashTag", description: "Social media hashtags and topic markers" },
  { name: "Abbreviation", tag: "Abbreviation", description: "Shortened forms of words and phrases" },
  { name: "Url", tag: "Url", description: "Website addresses and links" }
];

export default function GrammarAnalysis({ segments, onSeekTo }: GrammarAnalysisProps) {
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [grammarArray, setGrammarArray] = useState<any[]>([]);

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

  // Extract grammar elements from the transcript text
  const extractedGrammar = useMemo(() => {
    try {
      console.log("Running grammar analysis on transcript");
      // Initialize compromise NLP
      const doc = nlp(transcript.transcript);
      
      // Add custom patterns for additional categories - using strings instead of RegExp objects
      doc.match('#HashTag').tag('HashTag');
      doc.match('#[a-zA-Z][a-zA-Z0-9_]+').tag('HashTag');
      doc.match('[A-Z]{2,}').tag('Abbreviation');
      doc.match('(http|https)://*').tag('Url');
      doc.match('www.*').tag('Url');
      
      const results: Record<string, string[]> = {};
      
      // Use compromise tags to detect grammar elements
      grammarCategories.forEach(({ name, tag }) => {
        try {
          let matches: string[] = [];
          
          switch (tag) {
            case 'HashTag':
              matches = doc.match('#HashTag').out('array');
              break;
            case 'Abbreviation':
              matches = doc.match('[A-Z]{2,}').out('array');
              break;
            case 'Url':
              matches = [
                ...doc.match('(http|https)://*').out('array'),
                ...doc.match('www.*').out('array')
              ];
              break;
            default:
              // Use standard compromise tag matching
              matches = doc.match('#' + tag).out('array');
          }
          
          // Store unique values
          results[name] = Array.from(
            new Set(matches
              .map((text: string) => text?.trim())
              .filter(Boolean)
            )
          );
        } catch (err) {
          console.error(`Error extracting ${name} grammar elements:`, err);
          results[name] = [];
        }
      });
      
      return results;
    } catch (error) {
      console.error("Error analyzing grammar:", error);
      return {};
    }
  }, [transcript.transcript]);
  
  // Count grammar elements
  const grammarCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    grammarCategories.forEach(({ name }) => {
      counts[name] = extractedGrammar[name]?.length || 0;
    });
    
    return counts;
  }, [extractedGrammar]);

  // Find all occurrences of the selected grammar category in the transcript
  useEffect(() => {
    if (!activeCategory || !extractedGrammar[activeCategory]) {
      setGrammarArray([]);
      return;
    }

    const categoryTerms = extractedGrammar[activeCategory] || [];
    const foundGrammar: any[] = [];
    
    // Find all occurrences of each grammar term in the transcript
    categoryTerms.forEach(term => {
      if (!term) return;
      
      const termLower = term.toLowerCase();
      const termWords = termLower.split(/\s+/);
      const wordsArray = transcript.words;
      
      // Special handling for URLs, hashtags, and abbreviations which might be case-sensitive
      const isCaseSensitive = ['HashTag', 'Url', 'Abbreviation'].includes(activeCategory);
      
      // Find all occurrences of this term in the transcript
      for (let i = 0; i < wordsArray.length - termWords.length + 1; i++) {
        let isMatch = true;
        
        // Check if each word matches
        for (let j = 0; j < termWords.length; j++) {
          const wordToMatch = termWords[j];
          const transcriptWord = isCaseSensitive 
            ? wordsArray[i + j].word
            : wordsArray[i + j].word.toLowerCase();
          
          const compareWord = isCaseSensitive ? wordToMatch : wordToMatch.toLowerCase();
          
          if (transcriptWord !== compareWord) {
            isMatch = false;
            break;
          }
        }
        
        if (isMatch) {
          // Found a match for this term
          foundGrammar.push({
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
    
    // Set the array of found grammar elements
    setGrammarArray(foundGrammar);
  }, [activeCategory, extractedGrammar, transcript.words]);

  const handleCategoryClick = (category: string) => {
    setActiveCategory(activeCategory === category ? "" : category);
  };
  
  // Get the description for the active category
  const activeCategoryDescription = activeCategory 
    ? grammarCategories.find(c => c.name === activeCategory)?.description 
    : "";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Grammar Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Grammar category selection */}
            <div className="grid grid-cols-3 gap-2">
              {grammarCategories.map(({ name }) => (
                <div 
                  key={name}
                  className={`cursor-pointer p-3 rounded-md flex flex-col items-center transition-colors
                    ${activeCategory === name 
                      ? 'bg-purple-100 dark:bg-purple-900/30 border-l-2 border-purple-500' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  onClick={() => handleCategoryClick(name)}
                >
                  <h3 className="text-base font-semibold text-purple-600 dark:text-purple-400">{name}</h3>
                  <p className="mt-1 text-xs">
                    <span className="font-medium">{grammarCounts[name] || 0}</span> found
                  </p>
                </div>
              ))}
            </div>
            
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-2">About Grammar Analysis</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Grammar analysis helps you understand the structure and composition of your transcript. 
                Identifying parts of speech can reveal patterns in language use and help improve clarity and style.
              </p>
            </div>
            
            {/* Show examples of found grammar elements */}
            {activeCategory && extractedGrammar[activeCategory]?.length > 0 && (
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">
                  {activeCategory}: <span className="font-normal text-sm">{activeCategoryDescription}</span>
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {extractedGrammar[activeCategory].slice(0, 20).map((item, i) => (
                    <Badge key={i} variant="outline" className="text-purple-600">
                      {item}
                    </Badge>
                  ))}
                  {extractedGrammar[activeCategory].length > 20 && (
                    <Badge variant="outline">+{extractedGrammar[activeCategory].length - 20} more</Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right panel - grammar occurrences */}
          <div className="border rounded-md">
            {activeCategory ? (
              <div className="h-full flex flex-col">
                <div className="border-b p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      <span className="text-purple-600">{activeCategory}</span> Occurrences
                    </h3>
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      {grammarArray.length} instances
                    </Badge>
                  </div>
                </div>
                
                <div className="overflow-auto flex-1 p-2 max-h-[300px]">
                  {grammarArray.length > 0 ? (
                    grammarArray
                      .sort((a, b) => a.start - b.start)
                      .map((item, index) => (
                        <EntityItem
                          key={index}
                          transcript={transcript}
                          index={item.index}
                          sequence={index}
                          entity={activeCategory}
                          word={item.word}
                          time={item.start}
                          color="purple"
                          onClick={() => onSeekTo?.(item.start)}
                        />
                      ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No {activeCategory} elements found in transcript
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6 text-gray-500">
                <p>Select a grammar category to see occurrences</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
