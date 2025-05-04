'use client';

import { useState } from 'react';
import MindMapTree from '@/components/MindMapTree';

export default function Page() {
    const [mindMap, setMindMap] = useState(null);
    const [loading, setLoading] = useState(false);

    const generateMindMap = async () => {
        setLoading(true);
        await fetch('/api/transcript', {
                    method: 'POST'
                });
                
        const res = await fetch('/api/mindmap', {
            method: 'POST'
        });

        const data = await res.json();
        setMindMap(data.mindMap);
        setLoading(false);
    };

    return (
        <div className="p-4">
            <button onClick={generateMindMap} className="bg-blue-600 text-white px-4 py-2 rounded">
                {loading ? 'Generating...' : 'Generate Mind Map'}
            </button>

            {mindMap && (
                <div className="mt-6">
                    <h2 className="text-xl font-bold mb-4">Generated Mind Map</h2>
                    <MindMapTree data={mindMap} />
                </div>
            )}
        </div>
    );
}
