"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type MindMapNode = {
    id: string;
    title: string;
    children?: MindMapNode[];
    };

    export default function MindMap() {
    const [mindMapData, setMindMapData] = useState<MindMapNode[]>([]);
    const [loading, setLoading] = useState(false);

    // ✅ THIS MUST BE INSIDE THE COMPONENT FUNCTION
    const generateMindMap = async () => {
        setLoading(true);
        const res = await fetch("/api/mindmap");
        const data = await res.json();
        setMindMapData(data);
        setLoading(false);
    };

    return (
        <div className="mt-8">
        <Button onClick={generateMindMap} disabled={loading}>
            {loading ? "Generating..." : "Generate Mind Map"}
        </Button>

        {mindMapData.length > 0 && (
            <div className="mt-6 space-y-4">
            {mindMapData.map((node) => (
                <MindMapNodeComponent key={node.id} node={node} />
            ))}
            </div>
        )}
        </div>
    );
    }

    function MindMapNodeComponent({ node }: { node: MindMapNode }) {
    return (
        <div className="border-l-4 border-blue-500 pl-4">
        <h2 className="font-semibold text-blue-700 text-lg">{node.title}</h2>
        <ul className="list-disc ml-4 text-sm text-gray-700 dark:text-gray-300">
            {node.children?.map((child) => (
            <li key={child.id}>{child.title}</li>
            ))}
        </ul>
        </div>
    );
    }
