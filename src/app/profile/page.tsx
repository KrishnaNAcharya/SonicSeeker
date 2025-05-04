"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import tempImage from './temp/temp.png';
import History from "@/components/History";
import { FaFileAudio, FaFileVideo, FaTimes, FaSignOutAlt, FaSpinner } from 'react-icons/fa';
import WaveformPlayer from '@/components/WaveSurfer';
import { useRouter } from 'next/navigation';

// Update structure for history items
interface HistoryItem {
  id: string;
  name: string;
  type: 'audio' | 'video';
  thumbnailUrl?: string;
  sourceUrl?: string;
  date: string;
  dummyTranscription: string;
}

const ProfilePage = () => {
  const router = useRouter();
  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  // State for user data
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get token from localStorage
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Not logged in");
          setIsLoading(false);
          router.push('/Authentication'); // Redirect to login page
          return;
        }

        // Parse the token to get user ID
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.userId;
        
        if (!userId) {
          setError("User ID not found in token");
          setIsLoading(false);
          return;
        }

        // Fetch user data from API
        const response = await fetch(`/api/user/${userId}`);
        
        if (!response.ok) {
          throw new Error(`Error fetching user data: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update state with user data
        setUsername(data.user.username || "User");
        setEmail(data.user.email || "No email found");
        
      } catch (err: any) {
        console.error("Error fetching user data:", err);
        setError(err.message || "Failed to load user data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  // Function to handle logout
  const handleLogout = () => {
    // Remove the JWT token from localStorage
    localStorage.removeItem('token');
    
    // You can also clear any other user-related data from localStorage
    localStorage.removeItem('user_data');
    
    // Redirect to login page
    router.push('/');
  };

  // Function to close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  return (
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
          
          {/* Logout Button - Added right after Audio Analysis */}
          <button 
            onClick={handleLogout}
            className="flex items-center w-full gap-2 px-4 py-2 text-left rounded hover:bg-red-700 text-red-400 hover:text-white transition-colors mt-2"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </nav>
      </div>

      {/* Right Column (Main Content) */}
      <div className="flex-grow p-6 md:p-10 bg-neutral-800 backdrop-blur-lg bg-white/10 rounded-lg overflow-y-auto">
        {/* User Info Section */}
        <div className="mb-8">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <FaSpinner className="animate-spin text-neutral-400" />
              <span className="text-neutral-400">Loading user information...</span>
            </div>
          ) : error ? (
            <div className="text-red-400">
              <p>Error: {error}</p>
            </div>
          ) : (
            <>
              <p className="text-2xl font-semibold">{username}</p>
              <p className="text-neutral-400">{email}</p>
            </>
          )}
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
            <div className="p-6 overflow-y-auto space-y-6 flex flex-col min-h-0">
              {/* Conditionally render WaveformPlayer for audio files */}
              {selectedItem.type === 'audio' && selectedItem.sourceUrl && (
                <div className="flex-grow p-4 border border-neutral-700 rounded-lg bg-neutral-850 flex flex-col min-h-[200px]">
                  <h2 className="text-xl font-semibold mb-4 flex-shrink-0 text-neutral-300">Playback</h2>
                  <div className="flex-grow min-h-0">
                    <WaveformPlayer
                      audioSource={selectedItem.sourceUrl}
                    />
                  </div>
                </div>
              )}

              {/* Transcription */}
              <div className="flex-shrink-0">
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