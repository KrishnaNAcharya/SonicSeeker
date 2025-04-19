'use client';

import { useState } from 'react';
import { paragraphToMindMap, cleanMindMap } from '@/app/utils/nlp';
import { mindMapToPlantUML } from '@/app/utils/plantuml';
import plantumlEncoder from 'plantuml-encoder';

export default function MindMapGenerator() {
    const [plantuml, setPlantuml] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleGenerate = async () => {
        setIsProcessing(true);

        try {
            // 1. Process transcript (assuming it's already at src/whisper/transcripts/transcript.json)
            await fetch('/api/transcript', {
                method: 'POST'
            });

            // 2. Get generated paragraph
            const paragraphRes = await fetch('/transcripts/paragraph.txt');
            const paragraph = await paragraphRes.text();

            // 3. Generate mind map
            const rawMindMap = paragraphToMindMap(paragraph);
            const cleanedMindMap = cleanMindMap(rawMindMap);
            const umlCode = mindMapToPlantUML(cleanedMindMap);

            const encoded = plantumlEncoder.encode(umlCode);
            setPlantuml(umlCode);
            setImageUrl(`https://www.plantuml.com/plantuml/svg/${encoded}`);

        } catch (error) {
            console.error('Processing error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold text-center">Transcript to Mind Map</h1>

            <button
                onClick={handleGenerate}
                disabled={isProcessing}
                className={`w-full py-3 px-6 rounded-lg transition
          ${isProcessing
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
                {isProcessing ? 'Generating...' : 'Generate from Transcript'}
            </button>

            {plantuml && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Generated Mind Map</h2>
                    {imageUrl && (
                        <div className="border rounded-lg p-4 bg-gray-50">
                            <img
                                src={imageUrl}
                                alt="Generated Mind Map"
                                className="mx-auto max-h-[600px]"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
