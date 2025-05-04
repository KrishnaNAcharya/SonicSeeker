"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Language options for translation
const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "hindi", label: "Hindi" },
  { value: "chinese", label: "Chinese" },
  { value: "japanese", label: "Japanese" },
  { value: "russian", label: "Russian" },
  { value: "arabic", label: "Arabic" },
  { value: "kannada", label: "Kannada" }  // Add Kannada to the language list
];

interface TranslationControlsProps {
  transcriptText: string;
}

export default function TranslationControls({ transcriptText }: TranslationControlsProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("spanish");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear translation when transcript changes
  useEffect(() => {
    setTranslatedText("");
  }, [transcriptText]);

  const handleTranslate = async () => {
    if (!transcriptText.trim()) {
      toast.error("No transcript text to translate.");
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      console.log(`Translating ${transcriptText.length} characters to ${selectedLanguage}...`);
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: transcriptText,
          targetLanguage: selectedLanguage
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Translation API error response:', data);
        throw new Error(data.error || 'Translation failed');
      }

      if (!data.translatedText) {
        console.error('Translation API returned no text');
        throw new Error('Translation API returned no text');
      }

      setTranslatedText(data.translatedText);
      toast.success("Translation complete!");
    } catch (err) {
      console.error('Translation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      toast.error(`Translation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Translation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="language-select" className="font-medium whitespace-nowrap min-w-[80px]">
              Translate to:
            </label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              disabled={isTranslating}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
            <Button 
              onClick={handleTranslate} 
              disabled={isTranslating || !transcriptText.trim()}
            >
              {isTranslating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                'Translate'
              )}
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="border rounded-md p-3 min-h-[200px] max-h-[400px] overflow-y-auto">
            {translatedText ? (
              <div className="whitespace-pre-wrap">{translatedText}</div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 italic">
                {isTranslating ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Translating content...
                  </div>
                ) : (
                  "Select a language and click Translate to see the translated transcript."
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
