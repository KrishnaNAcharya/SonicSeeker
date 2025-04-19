"use client";

import React, { useRef, useState, useEffect } from "react"; // Import useState and useEffect
import { useRouter } from 'next/navigation'; // Import useRouter
import { motion, useScroll, useTransform } from "framer-motion";
import { NavbarButton } from "@/components/ui/resizable-navbar";
import { Vortex } from "@/components/ui/vortex"; // Import Vortex
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision"; // Import the new component

export const Hero = () => {
  const targetRef = useRef<HTMLDivElement>(null);
  const router = useRouter(); // Initialize router
  const [getStartedUrl, setGetStartedUrl] = useState("/Authentication"); // Default URL
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // State to manage auth check loading

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"], // Adjust offset if needed
  });
  const yLeft = useTransform(scrollYProgress, [0, 1], [-200, 200]); // Increased range
  const yRight = useTransform(scrollYProgress, [0, 1], [-200, 200]); // Increased range

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      console.log("Hero: Token from localStorage:", token);

      if (!token) {
        console.warn("Hero: No token found, defaulting to /Authentication");
        setGetStartedUrl("/Authentication");
        setIsLoadingAuth(false);
        return;
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.userId;
        console.log("Hero: User ID from token:", userId);

        // Check if token is expired (if it has exp field)
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < currentTime) {
          console.warn("Hero: Token expired, defaulting to /Authentication");
          localStorage.removeItem("token"); // Clean up expired token
          setGetStartedUrl("/Authentication");
        } else {
          // User is authenticated
          console.log("Hero: User authenticated, setting URL to /Home");
          setGetStartedUrl("/home"); // Redirect authenticated users to /Home
        }
      } catch (err) {
        console.error("Hero: Invalid token:", err);
        localStorage.removeItem("token"); // Clean up invalid token
        setGetStartedUrl("/Authentication"); // Default to auth page on error
      } finally {
        setIsLoadingAuth(false); // Auth check finished
      }
    };

    checkAuth();
  }, []); // Run only once on mount

  return (
    <section ref={targetRef} className="relative flex w-full flex-col items-center overflow-hidden px-4 py-24 border-none h-screen bg-transparent">
      <Vortex
        backgroundColor="transparent"
        className="absolute inset-0 z-0 w-full h-full"
      />

      <BackgroundBeamsWithCollision className="absolute inset-0 z-1" />

      <div className="relative z-10 flex w-full flex-col items-center text-center pt-12 h-full">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.2 }}
          className="mb-12"
        >
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-white md:text-6xl">
            Sonic-Seeker
          </h1>
          <p className="mb-4 max-w-2xl text-lg text-neutral-300">
            Your all in one audio tool
          </p>
          <NavbarButton
            href={getStartedUrl} // Use state variable for href
            variant="primary"
            className="mt-6 px-6 py- text-sm"
            disabled={isLoadingAuth} // Optionally disable button while checking auth
          >
            {isLoadingAuth ? "Loading..." : "Get Started"}
          </NavbarButton>
        </motion.div>

        <div className="w-full flex justify-center mx-auto" style={{ height: "auto" }}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full max-w-6xl gap-10 md:gap-16 px-2 md:px-6">
            <motion.div
              className="w-80 h-60 bg-neutral-900/80 backdrop-blur-sm rounded-lg p-6 border border-neutral-700 shadow-lg shadow-blue-500/30 flex flex-col justify-center"
              style={{ y: yLeft }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <h3 className="text-xl font-bold text-white mb-2">
                Long recordings? No problem.
              </h3>
              <p className="text-neutral-300 text-sm">
                Cut through the noise with instant AI summaries, speaker insights, and topic extraction — get straight to what matters.
              </p>
            </motion.div>

            <motion.div
              className="w-80 h-60 bg-neutral-900/80 backdrop-blur-sm rounded-lg p-6 border border-neutral-700 shadow-lg shadow-purple-500/30 flex flex-col justify-center"
              style={{ y: yRight }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <h3 className="text-xl font-bold text-white mb-2">
                Experience audio like never before.
              </h3>
              <p className="text-neutral-300 text-sm">
                Dive into conversations with interactive timelines, multilingual support, and visual mind maps that bring structure to your sound.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
