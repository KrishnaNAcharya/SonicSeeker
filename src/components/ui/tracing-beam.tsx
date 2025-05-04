"use client";
import React, { useEffect, useRef, useState } from "react";
// Ensure motion/react is installed or change import if using framer-motion
import {
  motion,
  useTransform,
  useScroll,
  useSpring,
} from "framer-motion"; // Assuming framer-motion is used based on other files
import { cn } from "@/lib/utils";

export const TracingBeam = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);

  useEffect(() => {
    // Function to update SVG height
    const updateSvgHeight = () => {
      if (contentRef.current) {
        setSvgHeight(contentRef.current.offsetHeight);
      }
    };

    // Initial height calculation
    updateSvgHeight();

    // Optional: Recalculate on resize if content height might change
    window.addEventListener('resize', updateSvgHeight);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('resize', updateSvgHeight);
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  // UseSpring for smooth animation of the gradient path
  const y1 = useSpring(
    useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]), // Map scroll progress to gradient start point
    {
      stiffness: 500,
      damping: 90,
    },
  );
  const y2 = useSpring(
    useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]), // Map scroll progress to gradient end point
    {
      stiffness: 500,
      damping: 90,
    },
  );

  return (
    <motion.div
      ref={ref}
      className={cn("relative mx-auto h-full w-full max-w-4xl", className)} // Container for the beam and content
    >
      {/* Left-side beam and SVG container */}
      <div className="absolute top-3 -left-4 md:-left-20"> {/* Positioning */}
        {/* Top circle indicator */}
        <motion.div
          transition={{
            duration: 0.2,
            delay: 0.5,
          }}
          animate={{
            boxShadow:
              scrollYProgress.get() > 0 // Change shadow based on scroll position
                ? "none"
                : "rgba(0, 0, 0, 0.24) 0px 3px 8px",
          }}
          className="border-neutral-200 dark:border-neutral-700 ml-[27px] flex h-4 w-4 items-center justify-center rounded-full border shadow-sm" // Style the outer circle
        >
          {/* Inner circle indicator */}
          <motion.div
            transition={{
              duration: 0.2,
              delay: 0.5,
            }}
            animate={{
              backgroundColor: scrollYProgress.get() > 0 ? "white" : "#10b981", // Change color based on scroll
              borderColor: scrollYProgress.get() > 0 ? "white" : "#059669", // Change border color
            }}
            className="h-2 w-2 rounded-full border border-neutral-300 dark:border-neutral-600 bg-white" // Style the inner circle
          />
        </motion.div>
        {/* SVG container for the beam */}
        <svg
          viewBox={`0 0 20 ${svgHeight}`} // Dynamic viewBox based on content height
          width="20"
          height={svgHeight} // Set the SVG height dynamically
          className="ml-4 block"
          aria-hidden="true"
        >
          {/* Background path (static) */}
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`} // Path definition, scales with svgHeight
            fill="none"
            stroke="#9091A0" // Use a neutral color for the background path
            strokeOpacity="0.16"
            transition={{
              duration: 10, // Not really needed for static path
            }}
          ></motion.path>
          {/* Foreground gradient path (animated) */}
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`} // Same path definition
            fill="none"
            stroke="url(#gradient)" // Apply the gradient defined below
            strokeWidth="1.25"
            className="motion-reduce:hidden" // Hide on reduced motion preference
            transition={{
              duration: 10, // Not really needed for path shape
            }}
          ></motion.path>
          {/* Gradient Definition */}
          <defs>
            <motion.linearGradient
              id="gradient"
              gradientUnits="userSpaceOnUse"
              x1="0" // Vertical gradient
              x2="0"
              y1={y1} // Animated start point
              y2={y2} // Animated end point
            >
              {/* Gradient stops defining the color transition */}
              <stop stopColor="#18CCFC" stopOpacity="0"></stop>
              <stop stopColor="#18CCFC"></stop>
              <stop offset="0.325" stopColor="#6344F5"></stop>
              <stop offset="1" stopColor="#AE48FF" stopOpacity="0"></stop>
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
      {/* Content container */}
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
};
