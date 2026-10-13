// How a design card names its size and age.

import type { DesignSize } from '../protocol.js';

const A_SIZES: Array<[string, number, number]> = [
  ['A3', 297, 420],
  ['A4', 210, 297],
  ['A5', 148, 210],
  ['A6', 105, 148]
];

const round = (n: number) => Math.round(n * 10) / 10;

export function sizeLabel({ width, height, unit }: DesignSize): string {
  if (unit === 'Millimeter') {
    for (const [name, short, long] of A_SIZES) {
      const near = (a: number, b: number) => Math.abs(a - b) < 1;
      if (near(width, short) && near(height, long)) return name;
      if (near(width, long) && near(height, short)) return `${name} landscape`;
    }
    return `${round(width)} × ${round(height)} mm`;
  }
  if (unit === 'Inch') return `${round(width)} × ${round(height)} in`;
  return `${Math.round(width)} × ${Math.round(height)}`;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

/** How long ago, in words: "just now", "2 minutes ago". */
export function ago(at: number, now = Date.now()): string {
  const seconds = (now - at) / 1000;
  if (seconds < 45) return 'just now';
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    seconds < 3600
      ? [Math.round(seconds / 60), 'minute']
      : seconds < 86_400
        ? [Math.round(seconds / 3600), 'hour']
        : [Math.round(seconds / 86_400), 'day'];
  return relative.format(-value, unit);
}
