<<<<<<< HEAD
export default function Footer() {
  return (
    // glass-card should now default to dark theme style
    <footer className="z-50 glass-card py-4 px-6 mt-auto"> {/* Added mt-auto */}
      {/* Ensure text is light/muted */}
      <p className="text-sm text-muted-foreground">&copy; 2025 Sonic Seeker</p>
=======

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-900 p-4">
      {/* ...existing or additional footer elements... */}
      <p className="text-sm">&copy; 2025 My App</p>
>>>>>>> 441d1ad2e6f7aa065c38bf9ca9c46dfad7683d47
    </footer>
  );
}