import Image from "next/image";
import AudioDrop from "@/components/AudioDrop";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex items-start justify-center min-h-[calc(100vh-7rem)] bg-gradient-to-r from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-900 p-8">
      <Card className="w-full max-w-[95vw] border border-gray-200 dark:border-gray-700 p-6 rounded-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-4xl font-bold text-gray-800 dark:text-gray-200">
            sonicseeka
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <AudioDrop />
        </CardContent>
      </Card>
    </div>
  );
}
