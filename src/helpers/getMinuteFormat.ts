/**
 * Converts seconds to a HH:MM:SS formatted string.
 * @param seconds - The total number of seconds.
 * @returns A string formatted as HH:MM:SS.
 */
export default function toHHMMSS(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return "00:00:00";
  }
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const hDisplay = String(h).padStart(2, '0');
  const mDisplay = String(m).padStart(2, '0');
  const sDisplay = String(s).padStart(2, '0');
  
  return `${hDisplay}:${mDisplay}:${sDisplay}`; // Fix: Use mDisplay for minutes
}
