"use client";

import React, { useState, useEffect } from "react";
import {
  Navbar,
  NavBody,
  NavItems,
  NavbarLogo,
  NavbarButton,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
} from "@/components/ui/resizable-navbar"; // Corrected import path

// Renamed MainLayout to Header and made it the default export
export default function Header() {
  const [visible, setVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // State for mobile menu toggle

  // Effect to handle scroll visibility
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.pageYOffset;
      // Make navbar visible slightly earlier or adjust as needed
      setVisible(currentScrollPos > 10);
    };
    window.addEventListener("scroll", handleScroll);
    // Cleanup listener on component unmount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // Define navigation items
  const navItems = [
    { name: "Home", link: "/" }, // Link to home page
    { name: "Features", link: "/#features" },
    { name: "About", link: "/#about" },
    // { name: "Analyse", link: "/audio-fetch" }, // Example link, adjust as needed
  ];

  return (
    // Navbar container using the Navbar component
    <Navbar visible={visible}>
      {/* Desktop Navigation Body */}
      <NavBody visible={visible}>
        <NavbarLogo />
        <NavItems items={navItems} />
        {/* Example Button - Link to Authentication page */}
        <NavbarButton href="/Authentication" variant="gradient">
          Login / Sign Up
        </NavbarButton>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav visible={visible}>
        <MobileNavHeader>
          <NavbarLogo />
          {/* Toggle button for mobile menu */}
          <MobileNavToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
        </MobileNavHeader>
        {/* Mobile Menu Content */}
        <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
          {/* Render NavItems specifically for mobile */}
          <NavItems
            items={navItems}
            onItemClick={() => setIsOpen(false)} // Close menu on item click
            // Override default NavItems styles for mobile layout
            className="!relative !flex !flex-col !items-start !space-x-0 !space-y-4 !inset-auto !text-base"
          />
          {/* Example Button in mobile menu */}
          <NavbarButton href="/Authentication" variant="gradient" className="w-full mt-4">
            Login / Sign Up
          </NavbarButton>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
    // Removed the main content and footer part, as Header should only be the navbar
  );
}