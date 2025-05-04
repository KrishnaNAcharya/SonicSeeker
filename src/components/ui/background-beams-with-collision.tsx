"use client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import React, { useRef, useState, useEffect } from "react";

export const BackgroundBeamsWithCollision = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Define beam configurations
  const beams = [
    { initialX: 10, translateX: 10, duration: 7, repeatDelay: 3, delay: 2 },
    { initialX: 600, translateX: 600, duration: 3, repeatDelay: 3, delay: 4 },
    { initialX: 100, translateX: 100, duration: 7, repeatDelay: 7, className: "h-6" },
    { initialX: 400, translateX: 400, duration: 5, repeatDelay: 14, delay: 4 },
    { initialX: 800, translateX: 800, duration: 11, repeatDelay: 2, className: "h-20" },
    { initialX: 1000, translateX: 1000, duration: 4, repeatDelay: 2, className: "h-12" },
    { initialX: 1200, translateX: 1200, duration: 6, repeatDelay: 4, delay: 2, className: "h-6" },
    { initialX: 300, translateX: 300, duration: 8, repeatDelay: 5, delay: 1, className: "h-10" },
    { initialX: 700, translateX: 700, duration: 9, repeatDelay: 4, delay: 3, className: "h-16" },
    { initialX: 200, translateX: 200, duration: 6, repeatDelay: 8, delay: 2.5, className: "h-8" },
    { initialX: 900, translateX: 900, duration: 10, repeatDelay: 6, delay: 1.5, className: "h-14" },
    { initialX: 500, translateX: 500, duration: 4.5, repeatDelay: 3.5, delay: 3.2, className: "h-18" },
    { initialX: 1100, translateX: 1100, duration: 7.2, repeatDelay: 4.8, delay: 0.8, className: "h-5" },
    { initialX: 1300, translateX: 1300, duration: 5.5, repeatDelay: 3.3, delay: 2.2, className: "h-9" },
  ];

  return (
    // Main container for the beams effect
    <div
      ref={parentRef}
      className={cn(
        "absolute inset-0 flex items-center w-full justify-center overflow-hidden", // Position absolutely to cover parent
        className
      )}
    >
      {/* Render each beam with its collision mechanism */}
      {beams.map((beam, index) => (
        <CollisionMechanism
          key={`${beam.initialX}-${index}-beam`} // Use a more unique key
          beamOptions={beam}
          containerRef={containerRef}
          parentRef={parentRef}
        />
      ))}

      {/* Optional children can be rendered here if needed */}
      {children}

      {/* Collision surface at the bottom */}
      <div
        ref={containerRef}
        className="absolute bottom-0 h-1 bg-neutral-100 dark:bg-neutral-800 w-full inset-x-0 pointer-events-none" // Adjusted height and color
        style={{
          // Simplified shadow for better performance/appearance
          boxShadow: "0 -10px 30px 10px rgba(0, 0, 0, 0.3)",
        }}
      ></div>
    </div>
  );
};

// Component responsible for a single beam and its collision detection/effect
const CollisionMechanism = React.forwardRef<
  HTMLDivElement,
  {
    containerRef: React.RefObject<HTMLDivElement>;
    parentRef: React.RefObject<HTMLDivElement>;
    beamOptions?: {
      initialX?: number;
      translateX?: number;
      initialY?: number;
      translateY?: number;
      rotate?: number;
      className?: string;
      duration?: number;
      delay?: number;
      repeatDelay?: number;
    };
  }
>(({ parentRef, containerRef, beamOptions = {} }, ref) => {
  const beamRef = useRef<HTMLDivElement>(null);
  const [collision, setCollision] = useState<{
    detected: boolean;
    coordinates: { x: number; y: number } | null;
  }>({
    detected: false,
    coordinates: null,
  });
  const [beamKey, setBeamKey] = useState(0); // Key to reset animation
  const [cycleCollisionDetected, setCycleCollisionDetected] = useState(false); // Track collision per cycle

  // Effect to check for collision
  useEffect(() => {
    const checkCollision = () => {
      if (
        beamRef.current &&
        containerRef.current &&
        parentRef.current &&
        !cycleCollisionDetected // Only check if collision hasn't been detected in this cycle
      ) {
        const beamRect = beamRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = parentRef.current.getBoundingClientRect();

        // Check if the bottom of the beam hits or goes below the top of the container
        if (beamRect.bottom >= containerRect.top) {
          // Calculate relative coordinates for the explosion
          const relativeX =
            beamRect.left - parentRect.left + beamRect.width / 2;
          const relativeY = beamRect.bottom - parentRect.top;

          setCollision({
            detected: true,
            coordinates: {
              x: relativeX,
              y: relativeY,
            },
          });
          setCycleCollisionDetected(true); // Mark collision as detected for this cycle
        }
      }
    };

    // Check collision frequently during animation
    const animationInterval = setInterval(checkCollision, 50);

    // Cleanup interval on unmount or dependency change
    return () => clearInterval(animationInterval);
  }, [cycleCollisionDetected, containerRef, parentRef]); // Rerun if cycleCollisionDetected changes

  // Effect to handle post-collision behavior (resetting)
  useEffect(() => {
    if (collision.detected && collision.coordinates) {
      // Delay before resetting the collision state and allowing detection again
      const resetTimeout = setTimeout(() => {
        setCollision({ detected: false, coordinates: null });
        setCycleCollisionDetected(false); // Allow detection in the next cycle
      }, 2000); // Duration of explosion effect + buffer

      // Delay before resetting the beam animation key (forces remount/restart)
      const remountTimeout = setTimeout(() => {
        setBeamKey((prevKey) => prevKey + 1);
      }, 2000); // Should match or be slightly after resetTimeout

      // Cleanup timeouts on unmount or if collision state changes again
      return () => {
        clearTimeout(resetTimeout);
        clearTimeout(remountTimeout);
      };
    }
  }, [collision]); // Rerun only when collision state changes

  return (
    <>
      {/* The moving beam */}
      <motion.div
        key={beamKey} // Use key to force remount and restart animation after collision
        ref={beamRef}
        initial={{
          translateY: beamOptions.initialY || "-200px", // Start above the screen
          translateX: beamOptions.initialX || "0px",
          rotate: beamOptions.rotate || 0,
        }}
        animate={{
          translateY: beamOptions.translateY || "1800px", // End far below the screen
          translateX: beamOptions.translateX || "0px",
          rotate: beamOptions.rotate || 0,
        }}
        transition={{
          duration: beamOptions.duration || 8,
          repeat: Infinity,
          repeatType: "loop", // Loop the animation
          ease: "linear", // Constant speed
          delay: beamOptions.delay || 0,
          repeatDelay: beamOptions.repeatDelay || 0,
        }}
        className={cn(
          "absolute left-0 top-0 m-auto h-14 w-px rounded-full bg-gradient-to-t from-indigo-500 via-purple-500 to-transparent", // Beam styling
          beamOptions.className
        )}
      />
      {/* Explosion effect on collision */}
      <AnimatePresence>
        {collision.detected && collision.coordinates && (
          <Explosion
            key={`explosion-${collision.coordinates.x}-${collision.coordinates.y}`} // Unique key for explosion instance
            className=""
            style={{
              position: 'absolute', // Ensure absolute positioning within the parent
              left: `${collision.coordinates.x}px`,
              top: `${collision.coordinates.y}px`,
              transform: "translate(-50%, -50%)", // Center the explosion
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
});

CollisionMechanism.displayName = "CollisionMechanism"; // For React DevTools

// Component for the explosion visual effect
const Explosion = ({ ...props }: React.HTMLProps<HTMLDivElement>) => {
  // Generate random directions for particles
  const spans = Array.from({ length: 20 }, (_, index) => ({
    id: index,
    initialX: 0,
    initialY: 0,
    directionX: Math.floor(Math.random() * 80 - 40), // Random horizontal spread
    directionY: Math.floor(Math.random() * -50 - 10), // Random upward vertical spread
  }));

  return (
    <div {...props} className={cn("absolute z-50 h-2 w-2", props.className)}>
      {/* Horizontal glow effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }} // Faster fade-in/out for glow
        className="absolute -inset-x-10 top-0 m-auto h-2 w-10 rounded-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent blur-sm"
      ></motion.div>
      {/* Individual particles */}
      {spans.map((span) => (
        <motion.span
          key={span.id}
          initial={{ x: span.initialX, y: span.initialY, opacity: 1 }}
          animate={{
            x: span.directionX,
            y: span.directionY,
            opacity: 0,
          }}
          transition={{
            duration: Math.random() * 1.0 + 0.3, // Shorter particle lifespan
            ease: "easeOut",
          }}
          className="absolute h-1 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500" // Particle styling
        />
      ))}
    </div>
  );
};
