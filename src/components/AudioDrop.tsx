"use client";
import { useDrop } from 'react-dnd';
import { useState } from 'react';
import Waveform from './WaveSurfer';
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function AudioDrop() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'audio/*',
    drop: (item: any, monitor) => {
      const droppedFiles = monitor.getItem()?.files;
      if (droppedFiles?.[0]) {
        setSelectedFile(droppedFiles[0]);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-8">
      <Card 
        ref={drop}
        className={`transition-colors w-64
          ${isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-500'}
          ${canDrop ? 'border-green-500' : ''}`}
      >
        <CardHeader className="p-4">
          <p className="text-sm">Drag and drop audio file here</p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="text-sm w-full"
          />
        </CardContent>
      </Card>
      {selectedFile && <Waveform audioFile={selectedFile} />}
    </div>
  );
}