"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import tempImage from './temp/temp.png';
import History from "@/components/History";
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

  return (
    <div className="flex flex-grow p-4 gap-4 relative">
      {/* Left Column (Inline Sidebar) */}
      <div className="w-64 flex-shrink-0 bg-neutral-800 rounded-lg p-4 flex flex-col items-center">
        {/* Avatar */}
        <div className="mb-6 mt-4">
          <Image
            src={tempImage}
            alt="User Avatar"
            width={128}
            height={128}
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
          <Link href="/audio-fetch" passHref>
            <span className="block w-full text-left px-4 py-2 rounded hover:bg-neutral-700 cursor-pointer">
              Audio Fetch
            </span>
          </Link>
        </nav>
      </div>

      {/* Right Column (Main Content) */}
      <div className="flex-grow p-6 md:p-10 bg-neutral-800 rounded-lg overflow-y-auto">
        {/* User Info Section */}
        <div className="mb-8">
          <p className="text-2xl font-semibold">{username}</p>
          <p className="text-neutral-400">{email}</p>
        </div>

        {/* User History Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4 border-b border-neutral-700 pb-2">User History</h2>
            <History/>
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
