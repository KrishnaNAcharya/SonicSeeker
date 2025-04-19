"use client";
import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion"; // Ensure framer-motion is installed
import React, { useState, useEffect, useRef } from "react"; // Added useEffect, useRef
import Link from "next/link"; // Added Link for internal navigation

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean; // Added visible prop
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean; // Added visible prop
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
    icon?: React.ReactNode;
  }[];
  className?: string;
  onItemClick?: () => void; // Added onItemClick prop
  LinkComponent?: React.ComponentType<any>;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean; // Added visible prop
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface MobileNavToggleProps {
  isOpen: boolean;
  onClick: () => void;
}

// Navbar Component
export const Navbar = ({ children, className, visible }: NavbarProps) => {
  // Ensure Navbar itself doesn't have conflicting background
  return (
    <div className={cn("sticky inset-x-0 top-0 z-40 w-full", className)}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </div>
  );
};

// NavBody Component (Desktop)
export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        // Use dark background with opacity
        backgroundColor: visible ? "rgba(10, 10, 10, 0.85)" : "transparent", // Darker background
        backdropFilter: visible ? "blur(12px)" : "none", // Slightly more blur
        width: visible ? "40%" : "100%",
        y: visible ? 20 : 0,
        boxShadow: visible
          ? "0 0 24px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 16px 68px rgba(0, 0, 0, 0.3)" // Adjusted shadow for dark
          : "none",
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 30,
      }}
      style={{
        minWidth: visible ? "800px" : "auto",
      }}
      className={cn(
        "relative z-[60] mx-auto hidden flex-row items-center justify-between self-start px-4 py-2 lg:flex",
        visible ? "rounded-full" : "rounded-none", // Keep rounding logic
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

// NavItems Component (Desktop & Mobile)
export const NavItems = ({
  items,
  LinkComponent = Link, // Default to next/link
  onItemClick,
  className,
}: NavItemsProps) => {
  return (
    <div
      className={cn(
        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center space-x-8",
        className,
      )}
    >
      {items.map((item, idx) => {
        // Extract key prop separately
        const key = `nav-item-${idx}`;
        // Prepare other props for spreading
        const linkProps = {
          href: item.link,
          onMouseEnter: () => {}, // Placeholder or actual logic
          onClick: onItemClick,
          className: "text-sm font-medium text-neutral-400 hover:text-white",
        };

        return (
          // Pass key directly, spread other props
          <LinkComponent key={key} {...linkProps}>
            {item.icon && <span className="mr-2">{item.icon}</span>}
            {item.name}
          </LinkComponent>
        );
      })}
    </div>
  );
};

// MobileNav Component
export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        // Use dark background with opacity
        backgroundColor: visible ? "rgba(10, 10, 10, 0.85)" : "transparent", // Darker background
        backdropFilter: visible ? "blur(12px)" : "none", // Slightly more blur
        width: visible ? "90%" : "100%",
        y: visible ? 20 : 0,
        borderRadius: visible ? "0.5rem" : "0rem",
        boxShadow: visible
          ? "0 0 24px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 16px 68px rgba(0, 0, 0, 0.3)" // Adjusted shadow for dark
          : "none",
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 30,
      }}
      className={cn(
        "relative z-50 mx-auto flex flex-col items-center justify-between px-3 py-2 lg:hidden",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

// MobileNavHeader Component
export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

// MobileNavMenu Component
export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose, // onClose is used implicitly by AnimatePresence exit
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn(
            "w-full flex flex-col items-start justify-start gap-4 px-4 py-8 overflow-hidden",
            // Use dark background/shadow
            "bg-neutral-950 shadow-[0_8px_16px_rgba(0,0,0,0.3)]", // Dark background and shadow
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// MobileNavToggle Component - Ensure icons are white
export const MobileNavToggle = ({
  isOpen,
  onClick,
}: MobileNavToggleProps) => {
  return isOpen ? (
    <IconX className="text-white cursor-pointer" onClick={onClick} /> // Ensure white
  ) : (
    <IconMenu2 className="text-white cursor-pointer" onClick={onClick} /> // Ensure white
  );
};

// NavbarLogo Component - Ensure text is white
export const NavbarLogo = () => {
  return (
    // Use Link for internal navigation
    <Link
      href="/"
      // Ensure text color is white
      className="relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-white" // Changed text-black to text-white
    >
      {/* Ensure text color is white */}
      <span className="font-medium text-white">Sonic Seeker</span> {/* Changed text-black to text-white */}
    </Link>
  );
};

// NavbarButton Component - Adjust variants for dark theme
export const NavbarButton = ({
  href,
  as: Tag = "button", // Default to button if no href
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient" | "outline";
} & ( // Ensure props match the Tag type
  | React.ComponentPropsWithoutRef<"a">
  | React.ComponentPropsWithoutRef<"button">
)) => {
  // Determine the tag based on href presence
  const Component = href ? "a" : Tag;

  const baseStyles =
    "px-4 py-2 rounded-md text-sm font-bold relative cursor-pointer hover:-translate-y-0.5 transition duration-200 inline-block text-center";

  // Dark theme aware variant styles
  const variantStyles = {
    primary: // Light button on dark background
      "bg-gray-200 text-black shadow-[0_0_24px_rgba(0,0,0,0.1),_0_1px_1px_rgba(0,0,0,0.05),_0_0_0_1px_rgba(255,255,255,0.1)]",
    secondary: // Transparent button, light text
      "bg-transparent shadow-none text-neutral-300 hover:text-white",
    dark: // Dark button, light text
      "bg-neutral-900 text-white shadow-[0_0_24px_rgba(0,0,0,0.2),_0_1px_1px_rgba(0,0,0,0.1),_0_0_0_1px_rgba(255,255,255,0.08)]",
    gradient: // Keep gradient, ensure text is readable
      "bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]",
    outline: // Outline with light text/border
      "bg-transparent border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white focus:ring-neutral-700 shadow-none",
  };

  const effectiveVariant = variantStyles[variant] ? variant : "primary";

  return (
    <Component
      href={href} // Pass href only if it exists
      className={cn(baseStyles, variantStyles[effectiveVariant], className)}
      {...props} // Spread remaining props
    >
      {children}
    </Component>
  );
};