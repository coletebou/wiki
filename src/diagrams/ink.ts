// The hand every study is drawn in, shared so that each sheet is ruled, measured and shaded the same way.

/** Hatching runs from upper left to lower right, as Leonardo's left hand drew it: a pattern turned this far. */
export const HATCH_TURN = -34;

/** A box's corners as a draughtsman rules them: each edge runs a little past the corner. */
export function overshoot(x: number, y: number, w: number, h: number, o = 4.5, k = 6): string {
  return [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ]
    .map(([cx, cy, sx, sy]) => `M${cx + sx * o} ${cy}h${-sx * (o + k)}M${cx} ${cy + sy * o}v${-sy * (o + k)}`)
    .join('');
}

/** A measured plate: a tick every 20 units along each edge, a longer one every 100, and a cross at each corner. */
export function plate(W: number, H: number) {
  const along = (n: number) => Array.from({ length: Math.floor((n - 1) / 20) }, (_, i) => 20 + i * 20);
  const ticks = [
    ...along(W).map((x) => `M${x} 3v${x % 100 === 0 ? 5 : 2.5}M${x} ${H - 3}v${x % 100 === 0 ? -5 : -2.5}`),
    ...along(H).map((y) => `M3 ${y}h${y % 100 === 0 ? 5 : 2.5}M${W - 3} ${y}h${y % 100 === 0 ? -5 : -2.5}`),
  ].join('');
  const corners = [
    [7, 7],
    [W - 7, 7],
    [7, H - 7],
    [W - 7, H - 7],
  ]
    .map(([x, y]) => `M${x - 4} ${y}h8M${x} ${y - 4}v8M${x + 2.4} ${y}a2.4 2.4 0 1 0 -4.8 0a2.4 2.4 0 1 0 4.8 0`)
    .join('');
  return { ticks, corners };
}
