import React from "react";
import toHHMMSS from "../helpers/getMinuteFormat";
import getSampleText from "../helpers/getSampleText";

interface SentimentItemProps {
  transcript: any;
  index: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  word: string;
  time: number;
  onClick: () => void;
}

const SentimentItem: React.FC<SentimentItemProps> = ({
  transcript,
  index,
  sentiment,
  score,
  word,
  time,
  onClick,
}) => {
  return (
    <div 
      className="flex p-3 gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-md"
      onClick={onClick}
    >
      <div className="flex items-center justify-center w-12">
        <span
          className={`text-lg font-bold ${
            sentiment === "positive" 
              ? "text-green-500" 
              : sentiment === "negative" 
                ? "text-red-500" 
                : "text-gray-500"
          }`}
        >
          {score > 0 ? "+" : ""}{score}
        </span>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium">
          Word:{" "}
          <span
            className={`font-semibold ${
              sentiment === "positive" 
                ? "text-green-500" 
                : sentiment === "negative" 
                  ? "text-red-500" 
                  : "text-gray-500"
            }`}
          >
            {word}
          </span>{" "}
          at {toHHMMSS(time)}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
          {getSampleText(transcript.words || [], index)}
        </p>
      </div>
    </div>
  );
};

export default SentimentItem;
