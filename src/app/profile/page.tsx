"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import tempImage from './temp/temp.png';
import { FaFileAudio, FaFileVideo, FaTimes } from 'react-icons/fa';
// Correct the import path to point to the WaveSurfer component file
import WaveformPlayer from '@/components/WaveSurfer'; // Changed import path

// Update structure for history items
interface HistoryItem {
  id: string;
  name: string;
  type: 'audio' | 'video';
  thumbnailUrl?: string;
  sourceUrl?: string; // Add source URL for playback
  date: string;
  dummyTranscription: string;
}

const ProfilePage = () => {
  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  // Placeholder data
  const username = "ExampleUser";
  const email = "user@example.com";

  // Dummy User History Data with corrected source URLs
  const userHistory: HistoryItem[] = [
    // Corrected path to point to the public directory
    { id: '1', name: 'audio1.mp3', type: 'audio', date: '2024-07-28', sourceUrl: '/audio/abhijna.wav', dummyTranscription: 'This is a dummy transcription for audio1.mp3. It contains some sample text.' },
    { id: '2', name: 'video1.mp4', type: 'video', thumbnailUrl: '/path/to/video1-thumb.jpg', date: '2024-07-27', dummyTranscription: 'Dummy transcription for video1.mp4. This video talks about technology trends.' },
    // Assuming dummy_audio2.wav is also moved to public/audio
    { id: '3', name: 'audio2.wav', type: 'audio', date: '2024-07-26', sourceUrl: '/audio/dummy_audio2.wav', dummyTranscription: 'Transcription for audio2.wav. Discusses project updates and next steps.' },
    { id: '4', name: 'video2.webm', type: 'video', thumbnailUrl: '/path/to/video2-thumb.jpg', date: '2024-07-25', dummyTranscription: 'Video2.webm transcription: A tutorial on using the new software features.' },
  ];

  // Function to handle opening the modal
  const handleItemClick = (item: HistoryItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  // Function to handle closing the modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  return (
    // Added px-8 for horizontal padding
    <div className="flex flex-grow p-4 px-8 gap-4 relative"> 
      {/* Left Column (Inline Sidebar) */}
      <div className="w-64 flex-shrink-0 bg-neutral-800 backdrop-blur-lg bg-white/10 rounded-lg p-4 flex flex-col items-center">
        {/* Avatar */}
        <div className="mb-6 mt-4">
          <Image
            src={tempImage}
            alt="User Avatar"
            width={150}
            height={150}
            className="rounded-full object-cover border-2 border-neutral-600"
          />
        </div>

        {/* Navigation Links */}
        <nav className="w-full flex flex-col gap-2">
          <Link href="/" passHref>
            <span className="block w-full text-left px-4 py-2 rounded hover:bg-neutral-700 cursor-pointer">
              Home
            </span>
          </Link>
          <Link href="/profile" passHref>
            <span className="block w-full text-left px-4 py-2 rounded bg-neutral-600 cursor-pointer">
              Profile
            </span>
          </Link>
          <Link href="/home" passHref>
            <span className="block w-full text-left px-4 py-2 rounded hover:bg-neutral-700 cursor-pointer">
              Audio Analysis
            </span>
          </Link>
        </nav>
      </div>

      {/* Right Column (Main Content) */}
      <div className="flex-grow p-6 md:p-10 bg-neutral-800 backdrop-blur-lg bg-white/10 rounded-lg overflow-y-auto">
        {/* User Info Section */}
        <div className="mb-8">
          <p className="text-2xl font-semibold">{username}</p>
          <p className="text-neutral-400">{email}</p>
        </div>

        {/* User History Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4 border-b border-neutral-700 pb-2">User History</h2>
          <ul className="space-y-4">
            {userHistory.length > 0 ? (
              userHistory.map((item) => (
                <li
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="flex items-center gap-4 p-3 bg-neutral-700/50 rounded-md hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  {item.type === 'video' ? (
                    <div className="w-16 h-10 rounded flex-shrink-0 overflow-hidden">
                      <Image
                        src={tempImage}
                        alt={`${item.name} thumbnail`}
                        width={64}
                        height={40}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-10 flex items-center justify-center flex-shrink-0">
                      <FaFileAudio className="text-neutral-400 text-3xl" />
                    </div>
                  )}
                  <div className="flex-grow overflow-hidden">
                    <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                    <p className="text-xs text-neutral-400">{item.date}</p>
                  </div>
                </li>
              ))
            ) : (
              <p className="text-neutral-500">No history found.</p>
            )}
          </ul>
        </div>
      </div>

      {/* Modal for Transcription and Playback */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-neutral-700">
              <h3 className="text-lg font-semibold truncate" title={selectedItem.name}>{selectedItem.name}</h3>
              <button onClick={closeModal} className="text-neutral-400 hover:text-white">
                <FaTimes size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex flex-col min-h-0"> {/* Ensure flex-col and min-h-0 for flex-grow */}
              {/* Conditionally render WaveformPlayer for audio files */}
              {selectedItem.type === 'audio' && selectedItem.sourceUrl && (
                <div className="flex-grow p-4 border border-neutral-700 rounded-lg bg-neutral-850 flex flex-col min-h-[200px]"> {/* Added min-height */}
                  <h2 className="text-xl font-semibold mb-4 flex-shrink-0 text-neutral-300">Playback</h2>
                  <div className="flex-grow min-h-0">
                    {/* Pass the sourceUrl to the audioSource prop */}
                    <WaveformPlayer
                      audioSource={selectedItem.sourceUrl}
                      // Add any other necessary props expected by WaveformPlayer from WaveSurfer.tsx
                      // For example, if onReady or onTimeUpdate are needed:
                      // onReady={(instance) => console.log("Player ready:", instance)}
                      // onTimeUpdate={(time) => console.log("Current time:", time)}
                    />
                  </div>
                </div>
              )}

              {/* Transcription */}
              <div className="flex-shrink-0"> {/* Prevent transcription from growing excessively if player is present */}
                <h4 className="text-md font-medium mb-2 text-neutral-300">Transcription:</h4>
                <p className="text-neutral-200 whitespace-pre-wrap">
                  {selectedItem.dummyTranscription}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-700 text-right">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
