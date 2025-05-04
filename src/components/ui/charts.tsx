"use client";
import React from 'react';

// Define props for PieChart
interface PieChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  colors?: string[];
}

// Define props for BarChart
interface BarChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  colors?: string[];
}

// Default colors
const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

// Simple implementation until recharts is installed
export function PieChart({ data, colors = defaultColors }: PieChartProps) {
  // Filter out any data items with zero value
  const filteredData = data.filter(item => item.value > 0);
  
  if (filteredData.length === 0) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const total = filteredData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-center items-center h-full">
        <div className="flex flex-col gap-4">
          {filteredData.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: colors[index % colors.length] }}
              ></div>
              <span>
                {item.name}: {Math.round(item.value/total * 100)}% ({item.value})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Simple implementation until recharts is installed
export function BarChart({ data, colors = defaultColors }: BarChartProps) {
  // Sort data by value in descending order
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const maxValue = Math.max(...data.map(item => item.value));

  return (
    <div className="flex flex-col gap-2 h-full w-full">
      {sortedData.map((item, index) => (
        <div key={index} className="flex flex-col">
          <div className="flex justify-between text-xs mb-1">
            <span>{item.name}</span>
            <span>{item.value}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: colors[index % colors.length]
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
}
