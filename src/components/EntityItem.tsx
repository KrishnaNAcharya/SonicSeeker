import React from "react";

// Helper function to format seconds to HH:MM:SS
function toHHMMSS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const hDisplay = h > 0 ? String(h).padStart(2, '0') + ':' : '';
  const mDisplay = String(m).padStart(2, '0');
  const sDisplay = String(s).padStart(2, '0');
  
  return `${hDisplay}${mDisplay}:${sDisplay}`;
}

// Helper function to get sample text around a word
function getSampleText(words: any[], index: number, contextSize = 5): string {
  const start = Math.max(0, index - contextSize);
  const end = Math.min(words.length - 1, index + contextSize);
  
  return words.slice(start, end + 1)
    .map(w => w.word || w)
    .join(' ');
}

interface EntityItemProps {
  transcript: any;
  index: number;
  sequence: number;
  entity: string;
  color: string;
  word: string;
  time: number;
  onClick: () => void;
}

export default function EntityItem({
  transcript,
  index,
  sequence,
  entity,
  color,
  word,
  time,
  onClick
}: EntityItemProps) {
  return (
    <div 
      className="flex p-3 gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-md mb-2"
      onClick={onClick}
    >
      <div className="flex items-center justify-center w-12">
        <span
          className="text-lg font-bold"
          style={{ color }}
        >
          #{sequence + 1}
        </span>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium">
          {entity}:{" "}
          <span
            className="font-semibold"
            style={{ color }}
          >
            {word}
          </span>{" "}
          at {toHHMMSS(time)}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
          {getSampleText(transcript.words, index)}
        </p>
      </div>
    </div>
  );
}
