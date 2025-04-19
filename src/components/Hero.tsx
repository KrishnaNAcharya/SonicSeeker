"use client";

import React, { useRef } from "react";
// Ensure BackgroundBeamsWithCollision is correctly imported if used, or remove if replaced by Vortex
// import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";
import { motion, useScroll, useTransform } from "framer-motion";
// Assuming NavbarButton is correctly imported from resizable-navbar
import { NavbarButton } from "@/components/ui/resizable-navbar";
import { Vortex } from "@/components/ui/vortex"; // Import Vortex

export const Hero = () => {
  const targetRef = useRef<HTMLDivElement>(null);
  // Keep scroll animations if desired
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"], // Adjust offset if needed
  });

  // Increase the transform range for a more visible parallax effect
  const yLeft = useTransform(scrollYProgress, [0, 1], [-200, 200]); // Increased range
  const yRight = useTransform(scrollYProgress, [0, 1], [-200, 200]); // Increased range

  return (
    // Use Vortex as the main background container
    <section ref={targetRef} className="relative flex w-full flex-col items-center overflow-hidden px-4 py-12 md:py-24 border-none h-screen bg-neutral-950"> {/* Adjusted padding */}
      {/* Vortex Component */}
      <Vortex
        backgroundColor="black" // Or "transparent" if you want the section bg-neutral-950 to show through
        rangeY={800} // Example adjustment
        particleCount={500} // Example adjustment
        baseHue={220} // Example adjustment
        className="absolute inset-0 z-0 w-full h-full" // Ensure it covers the section
      />

      {/* Optional: Keep BackgroundBeams if you want both effects */}
      {/* <BackgroundBeamsWithCollision className="absolute inset-0 z-1" /> */}

      {/* Content container */}
      <div className="relative z-10 flex w-full flex-col items-center text-center pt-8 md:pt-12 h-full"> {/* Slightly reduced top padding */}
        {/* Title and Subtitle */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.2 }}
          className="mb-6 md:mb-8" // Adjusted margin bottom
        >
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl"> {/* Adjusted size */}
            Sonic-Seeker
          </h1>
          <p className="mb-4 max-w-2xl text-lg text-neutral-300 md:text-xl"> {/* Adjusted size */}
            Your all in one audio tool
          </p>
          {/* Call to Action Button */}
          <NavbarButton href="/Authentication" variant="gradient" className="mt-6 px-6 py-3 text-lg"> {/* Use Authentication link and gradient */}
            Get Started
          </NavbarButton>
        </motion.div>

        {/* Feature Cards Container */}
        {/* Move container higher (reduced mt), push cards further apart (increased max-w, adjusted padding) */}
        <div className="w-full flex-1 flex justify-center mx-auto mt-2 md:mt-4" style={{ height: "auto" }}> {/* Reduced top margin significantly */}
          {/* Increased max-width, ensure justify-between */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full max-w-6xl gap-8 md:gap-16 px-2 md:px-6"> {/* Increased max-w, reduced padding slightly */}
            {/* Left Card */}
            <motion.div
              className="w-full md:w-80 h-auto md:h-60 bg-neutral-900/80 backdrop-blur-md rounded-lg p-6 border border-neutral-700 shadow-lg shadow-blue-500/30 flex flex-col justify-center"
              style={{ y: yLeft }} // Apply increased transform
              whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(59, 130, 246, 0.5)" }} // Enhanced hover effect
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <h3 className="text-xl font-bold text-white mb-2">
                Long recordings? No problem.
              </h3>
              <p className="text-neutral-300 text-sm">
                Cut through the noise with instant AI summaries, speaker insights, and topic extraction — get straight to what matters.
              </p>
            </motion.div>

            {/* Right Card */}
            <motion.div
              className="w-full md:w-80 h-auto md:h-60 bg-neutral-900/80 backdrop-blur-md rounded-lg p-6 border border-neutral-700 shadow-lg shadow-purple-500/30 flex flex-col justify-center"
              style={{ y: yRight }} // Apply increased transform
              whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(168, 85, 247, 0.5)" }} // Enhanced hover effect
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
