import Sentiment from 'sentiment';

// Initialize the sentiment analyzer
const sentimentAnalyzer = new Sentiment();

export type SentimentResult = {
  score: number;
  comparative: number;
  positive: string[];
  negative: string[];
  calculation: Record<string, number>[];
};

/**
 * Analyzes text for sentiment using the sentiment library
 */
export function analyzeSentimentDetailed(text: string): SentimentResult {
  const result = sentimentAnalyzer.analyze(text);
  
  // Map the sentiment calculation to match our expected format
  const calculation = result.tokens.map(token => {
    const score = result.words[token] || 0;
    return { [token]: score };
  });
  
  return {
    score: result.score,
    comparative: result.comparative,
    positive: result.positive,
    negative: result.negative,
    calculation
  };
}

/**
 * Simplified sentiment analysis that just returns the sentiment category
 */
export function getSentimentCategory(text: string): 'positive' | 'negative' | 'neutral' {
  const result = sentimentAnalyzer.analyze(text);
  if (result.score > 0) return 'positive';
  if (result.score < 0) return 'negative';
  return 'neutral';
}
