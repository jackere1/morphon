/**
 * Parse a duration string like "1s", "500ms", or a number (seconds) to seconds.
 */
export function parseDuration(dur?: string | number): number {
  if (dur === undefined || dur === null) return 0;
  if (typeof dur === 'number') return dur;
  const match = String(dur).match(/^([\d.]+)\s*(s|ms)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  return match[2] === 'ms' ? val / 1000 : val;
}
