"use client";
import { useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ParsedMetric {
  label: string;
  value: string;
}

interface MetricsDisplayProps {
  transcriptionMetrics: string[] | null;
}

export default function MetricsDisplay({ transcriptionMetrics }: MetricsDisplayProps) {
  // Use useMemo to parse metrics only when transcriptionMetrics changes
  const parsedMetrics: ParsedMetric[] = useMemo(() => {
    if (!transcriptionMetrics) return [];

    const metricsMap = new Map<string, string>();

    // Parsing logic moved to this component
    transcriptionMetrics.forEach(metric => {
      // Extract Language and Probability
      const langProbMatch = metric.match(/Detected language '(\w+)' with probability (\d+\.\d+)/);
      if (langProbMatch) {
        metricsMap.set("Detected Language", langProbMatch[1]);
        metricsMap.set("Language Probability", langProbMatch[2]);
        return;
      }

      // Other parsing logic here
      // ...
    });

    // Convert map to array of ParsedMetric objects
    const metrics: ParsedMetric[] = [];
    // Define desired order
    const order = [
      "Detected Language",
      "Language Probability",
      "Word Count",
      "Speech Rate",
      // Other metrics...
    ];

    order.forEach(label => {
      if (metricsMap.has(label)) {
        metrics.push({ label, value: metricsMap.get(label)! });
      }
    });

    // Add any other metrics found that weren't in the predefined order
    metricsMap.forEach((value, label) => {
      if (!order.includes(label)) {
        metrics.push({ label, value });
      }
    });

    return metrics;
  }, [transcriptionMetrics]);

  // If no metrics or metrics array is empty, don't render anything
  if (!transcriptionMetrics || parsedMetrics.length === 0) {
    return null;
  }

  return (
    <Card className="w-full max-w-[95vw] border border-gray-200 dark:border-gray-700 p-6 rounded-xl glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-300">
          Transcription Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Metric</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedMetrics.map((metric, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium text-sm">{metric.label}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{metric.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
