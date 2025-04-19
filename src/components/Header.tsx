"use client";
import React, { useState, useEffect } from "react"; // Import React and hooks
import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
  useScroll, // Import useScroll
  useMotionValueEvent // Import useMotionValueEvent
} from "framer-motion";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
  }[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
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

export const Navbar = ({ children, className, visible }: NavbarProps) => {
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

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        // Fix: Use rgba with opacity 0 instead of "transparent" for smooth animation
        backgroundColor: visible ? "rgba(10, 10, 10, 0.8)" : "rgba(10, 10, 10, 0)",
        backdropFilter: visible ? "blur(10px)" : "none",
        width: visible ? "40%" : "100%",
        y: visible ? 20 : 0,
        boxShadow: visible
          ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
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
        visible ? "rounded-full" : "rounded-none",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-2 text-sm font-medium text-zinc-600 transition duration-200 hover:text-zinc-800 lg:flex lg:space-x-2",
        className,
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => setHovered(idx)}
          onClick={onItemClick}
          className="relative px-4 py-2 text-neutral-600 dark:text-neutral-300"
          key={`link-${idx}`}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div
              layoutId="hovered"
              className="absolute inset-0 h-full w-full rounded-full bg-gray-100 dark:bg-neutral-800"
            />
          )}
          <span className="relative z-20">{item.name}</span>
        </a>
      ))}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        // Fix: Use rgba with opacity 0 instead of "transparent" for smooth animation
        backgroundColor: visible ? "rgba(10, 10, 10, 0.8)" : "rgba(10, 10, 10, 0)",
        backdropFilter: visible ? "blur(10px)" : "none",
        width: visible ? "90%" : "100%",
        y: visible ? 20 : 0,
        borderRadius: visible ? "0.5rem" : "0rem",
        boxShadow: visible
          ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
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

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn(
            "w-full flex flex-col items-start justify-start gap-4 px-4 py-8 overflow-hidden",
            "bg-white dark:bg-neutral-950 shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.3)]",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: MobileNavToggleProps) => {
  return isOpen ? (
    <IconX className="text-black dark:text-white" onClick={onClick} />
  ) : (
    <IconMenu2 className="text-black dark:text-white" onClick={onClick} />
  );
};

export const NavbarLogo = () => {
  return (
    <a
      href="/"
      className="relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-black"
    >
      <span className="font-medium text-black dark:text-white">Sonic Seeker</span>
    </a>
  );
};

export const NavbarButton = ({
  href,
  as: Tag = "a",
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
} & (
  | React.ComponentPropsWithoutRef<"a">
  | React.ComponentPropsWithoutRef<"button">
)) => {
  const baseStyles =
    "px-4 py-2 rounded-md bg-white button bg-white text-black text-sm font-bold relative cursor-pointer hover:-translate-y-0.5 transition duration-200 inline-block text-center";

  const variantStyles = {
    primary:
      "shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
    secondary: "bg-transparent shadow-none dark:text-white",
    dark: "bg-black text-white shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
    gradient:
      "bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]",
    outline: "bg-transparent border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white focus:ring-neutral-700 shadow-none",
  };

  const effectiveVariant = variantStyles[variant] ? variant : 'primary';

  return (
    <Tag
      href={href || undefined}
      className={cn(baseStyles, variantStyles[effectiveVariant], className)}
      {...props}
    >
      {children}
    </Tag>
  );
};

// Define the main Header component
export default function Header() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(true); // Start visible
  const [isOpen, setIsOpen] = useState(false); // State for mobile menu

  // Handle scroll visibility
  useMotionValueEvent(scrollY, "change", (current) => {
    // Check if current is not undefined and is a number
    if (typeof current === "number") {
      let direction = current! - scrollY.getPrevious()!;

      if (scrollY.get() < 50) { // Always visible near the top
        setVisible(true);
      } else {
        if (direction < 0) { // Scrolling up
          setVisible(true);
        } else { // Scrolling down
          setVisible(false);
        }
      }
    }
  });

  // Define navigation items
  const navItems = [
    { name: "Home", link: "/" },
    // Add other navigation items here if needed
    // { name: "About", link: "/about" },
    // { name: "Contact", link: "/contact" },
  ];

  return (
    <Navbar className="top-2" visible={visible}>
      {/* Desktop Navigation */}
      <NavBody visible={visible}>
        <NavbarLogo />
        <NavItems items={navItems} />
        {/* Add desktop buttons if needed */}
        {/* <NavbarButton href="/signup" variant="primary">Sign Up</NavbarButton> */}
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav visible={visible}>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
        </MobileNavHeader>
        <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
           {/* Render mobile nav items */}
           {navItems.map((item, idx) => (
             <a
               key={`mobile-link-${idx}`}
               href={item.link}
               onClick={() => setIsOpen(false)} // Close menu on click
               className="block px-4 py-2 text-lg text-neutral-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-md w-full text-left"
             >
               {item.name}
             </a>
           ))}
           {/* Add mobile buttons if needed */}
           {/* <NavbarButton href="/signup" variant="primary" className="w-full mt-4">Sign Up</NavbarButton> */}
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}