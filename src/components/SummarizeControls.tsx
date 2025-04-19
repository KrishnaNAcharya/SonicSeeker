"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SummarizeControlsProps {
    transcriptText: string; // joined text, not raw JSON
}

export default function SummarizeControls({ transcriptText }: SummarizeControlsProps) {
    const [summary, setSummary] = useState("");
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setSummary("");
    }, [transcriptText]);

    const handleSummarize = async () => {
        if (!transcriptText.trim()) {
            toast.error("No transcript text to summarize.");
            return;
        }

        setIsSummarizing(true);
        setError(null);

        try {
            console.log("Sending transcript to summarizer...");
            
            await fetch("/api/save-transcript", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: transcriptText }),
            });

            const res = await fetch("/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transcript: transcriptText }),
            });

            const data = await res.json();

            if (!res.ok || !data.summary) {
                throw new Error(data.error || "Summary not available.");
            }

            setSummary(data.summary);
            toast.success("Summary generated!");
        } catch (err) {
            console.error("Summarization error:", err);
            const message = err instanceof Error ? err.message : "Unknown error";
            setError(message);
            toast.error(Summarization failed: ${message});
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Summarization</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Button
                        onClick={handleSummarize}
                        disabled={isSummarizing || !transcriptText.trim()}
                    >
                        {isSummarizing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Summarizing...
                            </>
                        ) : (
                            "Summarize"
                        )}
                    </Button>

                    {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div className="border rounded-md p-3 min-h-[150px] max-h-[400px] overflow-y-auto">
                        {summary ? (
                            <div className="whitespace-pre-wrap">{summary}</div>
                        ) : (
                            <div className="text-gray-500 dark:text-gray-400 italic">
                                {isSummarizing ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Summarizing content...
                                    </div>
                                ) : (
                                    "Click Summarize to get a condensed summary of your transcript."
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}