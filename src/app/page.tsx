import Image from "next/image";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-gradient-to-r from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-900">
      <div className="glass-card p-12 rounded-xl border border-gray-200 dark:border-gray-700">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">Hello World</h1>
      </div>
    </div>
  );
}
