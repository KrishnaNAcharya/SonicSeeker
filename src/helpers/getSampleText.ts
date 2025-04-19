/**
 * Gets a sample of text around a specific word in the transcript
 */
export default function getSampleText(words: any[], index: number, contextSize = 10) {
  const startIndex = Math.max(0, index - contextSize);
  const endIndex = Math.min(words.length - 1, index + contextSize);
  
  return words
    .slice(startIndex, endIndex + 1)
    .map(w => w.word || w.text)
    .join(' ');
}
