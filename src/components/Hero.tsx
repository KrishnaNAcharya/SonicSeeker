"use client";

// Add useState to imports
import React, { useEffect, useRef, useState } from "react"; 
// Correct the import path
import { BackgroundBeamsWithCollision } from "@/components/ui/backgroundbeams"; 
import { motion, useScroll, useTransform } from "framer-motion";

// ... (Keep JSX.IntrinsicElements declaration) ...
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        url: string;
        background?: string;
        zoom?: string;
        'enable-zoom'?: string; // Use string for boolean attributes
        'scroll-behavior'?: string;
        logo?: string; // Use string for boolean attributes
        eventstarget?: string;
      };
    }
  }
}


export const Hero = () => {
  // ... (Keep isSplineReady state and useEffect for script loading, although Spline is removed, the code doesn't hurt) ...
  const [isSplineReady, setIsSplineReady] = useState(false); 

  useEffect(() => {
    // Load the Spline viewer script dynamically
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@splinetool/viewer@1.9.82/build/spline-viewer.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      // Check if script exists before removing
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []); // Run only once on mount

  const targetRef = useRef<HTMLDivElement>(null);
  // Remove scroll-related hooks as they are no longer used for card animations
  // const { scrollYProgress } = useScroll({ ... });
  // const yLeft = useTransform(scrollYProgress, [0, 1], [-200, 200]);
  // const yRight = useTransform(scrollYProgress, [0, 1], [200, -200]);

  return (
    // Adjust padding/height and flex properties to center content
    <section ref={targetRef} className="relative flex w-full flex-col items-center justify-center overflow-hidden px-4 py-24 border-none h-screen">
      {/* Ensure BackgroundBeams covers the entire section */}
      <BackgroundBeamsWithCollision className="absolute inset-0 z-0 h-full w-full" />

      {/* Center the text content vertically and horizontally */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center text-center h-full">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.2 }}
        >
          <h1
            className="mb-6 text-5xl font-bold tracking-tight text-white md:text-7xl lg:text-8xl" // Optionally increase text size
          >
            Sonic-Seeker
          </h1>
          <p
            className="mb-4 max-w-2xl text-lg text-neutral-300 md:text-xl" // Optionally increase text size
          >
            Your all in one audio tool
          </p>
        </motion.div>
        
        {/* REMOVED: Container for Spline and Cards */}
        {/* <div className="w-full flex-1 flex items-center justify-center mx-auto mt-8" style={{ height: "calc(100% - 150px)" }}> 
          <div className="flex items-center justify-around w-full max-w-6xl"> */}
            
            {/* REMOVED: Left Card */}
            {/* <motion.div ... > ... </motion.div> */}

            {/* REMOVED: Spline 3D component */}
            {/* <div className="flex-shrink-0 mx-4" style={{ width: "400px", height: "400px" }}> ... </div> */}

            {/* REMOVED: Right Card */}
            {/* <motion.div ... > ... </motion.div> */}

          {/* </div>
        </div> */}
      </div>
    </section>
  );
};

export default Hero;
