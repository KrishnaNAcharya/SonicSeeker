export default function Footer() {
  return (
    // glass-card should now default to dark theme style
    <footer className="z-50 glass-card py-4 px-6 mt-auto"> {/* Added mt-auto */}
      {/* Ensure text is light/muted */}
      <p className="text-sm text-muted-foreground">&copy; 2025 Sonic Seeker</p>
    </footer>
  );
}