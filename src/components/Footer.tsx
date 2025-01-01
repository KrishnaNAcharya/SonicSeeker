const Footer = () => {
  return (
    <footer className="w-full h-16 flex items-center justify-center glass-card border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-gray-800 dark:text-gray-200">&copy; {new Date().getFullYear()} SonicSeeker. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
