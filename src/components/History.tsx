"use client";

import { useEffect, useState } from "react";
import { Transcription } from "@/lib/models/Transcription";

export default function History() {
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'audio' | 'video'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            setError(null);

            try {
                const token = localStorage.getItem("token");
                if (!token) throw new Error("User not logged in");

                const payload = JSON.parse(atob(token.split('.')[1]));
                const userId = payload.userId;

                const response = await fetch("/api/phistory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId }),
                });

                const result = await response.json();
                if (response.ok) {
                    setTranscriptions(result.history || []);
                } else {
                    throw new Error(result.error || result.message);
                }
            } catch (err: any) {
                console.error("Error loading history:", err);
                setError(err.message || "Something went wrong");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedItems(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const filteredTranscriptions = transcriptions
        .filter(item => activeTab === 'all' || item.fileType === activeTab)
        .filter(item => {
            if (!searchTerm) return true;

            // Search in filename
            if (item.fileName.toLowerCase().includes(searchTerm.toLowerCase())) return true;

            // Search in transcript text
            if (item.transcript && item.transcript.some(seg =>
                seg.text.toLowerCase().includes(searchTerm.toLowerCase()))) return true;

            return false;
        });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto p-6 text-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="text-red-800 font-semibold">Error</h3>
                    <p className="text-red-600">{error}</p>
                    <button
                        className="mt-3 bg-red-100 text-red-800 px-4 py-2 rounded-md hover:bg-red-200 transition"
                        onClick={() => window.location.reload()}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold">Transcription History</h1>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search transcriptions..."
                            className="pl-10 pr-4 py-2 border rounded-lg w-full sm:w-64 bg-black"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <svg
                            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <div className="flex rounded-lg overflow-hidden border text-white">
                        <button
                            className={`px-4 py-2 text-sm ${activeTab === 'all' ? 'bg-blue-500 text-black' : 'bg-black hover:bg-gray-500'}`}
                            onClick={() => setActiveTab('all')}
                        >
                            All
                        </button>
                        <button
                            className={`px-4 py-2 text-sm border-l ${activeTab === 'audio' ? 'bg-blue-500 text-black' : 'bg-black hover:bg-gray-500'}`}
                            onClick={() => setActiveTab('audio')}
                        >
                            Audio
                        </button>
                        <button
                            className={`px-4 py-2 text-sm border-l ${activeTab === 'video' ? 'bg-blue-500 text-black' : 'bg-black hover:bg-gray-500'}`}
                            onClick={() => setActiveTab('video')}
                        >
                            Video
                        </button>
                    </div>
                </div>
            </div>

            {filteredTranscriptions.length === 0 ? (
                <div className="text-center py-16 bg-gray-500 rounded-xl">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="mt-2 text-lg font-medium text-gray-900">No transcriptions found</h3>
                    <p className="mt-1 text-gray-500">
                        {searchTerm ? "Try adjusting your search terms." : "Upload your first audio or video file to get started."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTranscriptions.map(entry => {
                        const mimeType =
                            entry.fileType === "video"
                                ? "video/mp4"
                                : entry.fileType === "audio"
                                    ? "audio/mpeg"
                                    : "application/octet-stream";

                        const mediaUrl = `data:${mimeType};base64,${entry.mediaBase64}`;
                        const isExpanded = expandedItems[entry._id] || false;

                        return (
                            <div key={entry._id} className="border rounded-xl shadow-sm bg-gray-300 overflow-hidden">
                                <div className="p-4 sm:p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                        <div>
                                            <h2 className="font-semibold text-lg text-gray-900">{entry.fileName}</h2>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                <span>{new Date(entry.uploadDate).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span className="capitalize">{entry.fileType}</span>
                                            </div>
                                        </div>

                                        <div className="mt-3 sm:mt-0">
                                            <button
                                                onClick={() => toggleExpand(entry._id)}
                                                className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                            >
                                                {isExpanded ? 'Hide transcript' : 'Show transcript'}
                                                <svg
                                                    className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                >
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        {entry.fileType === "video" ? (
                                            <video controls className="w-full rounded-md">
                                                <source src={mediaUrl} />
                                            </video>
                                        ) : (
                                            <audio controls className="w-full">
                                                <source src={mediaUrl} />
                                            </audio>
                                        )}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t bg-black ">
                                        <div className="p-4 sm:p-5">
                                            <h3 className="font-medium mb-3">Transcript</h3>
                                            {entry.transcript?.length > 0 ? (
                                                <div className="space-y-2">
                                                    {entry.transcript.map((seg, i) => {
                                                        // Highlight text that matches search term
                                                        let textContent = seg.text;
                                                        if (searchTerm) {
                                                            const regex = new RegExp(`(${searchTerm})`, 'gi');
                                                            textContent = seg.text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
                                                        }

                                                        return (
                                                            <div key={i} className="flex">
                                                                <div className="w-16 flex-shrink-0 text-sm text-gray-500">
                                                                    {formatDuration(seg.start)}
                                                                </div>
                                                                <div
                                                                    className="flex-1"
                                                                    dangerouslySetInnerHTML={{ __html: textContent }}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-gray-500 italic">No transcript available for this recording.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

