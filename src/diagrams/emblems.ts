// Small ink sketches for the empty corners of a study's sheet, one per view, after its Latin motto: the way Leonardo
// filled the margins of a page with wheels, water and moons around the drawing it was for. Each is drawn in a box from
// -50 to 50 and placed by the view (src/data). Ornament only; InkMap hides them from assistive technology.

type P = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;
const xy = (p: P) => `${r1(p[0])} ${r1(p[1])}`;
const path = (d: string, cls = '') => `<path${cls ? ` class="${cls}"` : ''} d="${d}"/>`;
const circle = (c: P, r: number, cls = '') => `<circle${cls ? ` class="${cls}"` : ''} cx="${r1(c[0])}" cy="${r1(c[1])}" r="${r1(r)}"/>`;
/** Parallel strokes from upper left to lower right, cut to a region by the caller's clip, or just laid as lines. */
function hatchLines(x0: number, y0: number, x1: number, y1: number, gap = 2.6): string {
  const out: string[] = [];
  for (let c = x0 - (y1 - y0); c < x1; c += gap) {
    const a: P = [c, y0];
    const b: P = [c + (y1 - y0) * 0.68, y1];
    out.push(`M${xy(a)}L${xy(b)}`);
  }
  return out.join('');
}

/** Hatching cut to a shape: the clip's id is made unique by the caller's prefix. */
function hatched(id: string, clip: string, box: [number, number, number, number], gap = 2.6): string {
  return `<clipPath id="${id}"><path d="${clip}"/></clipPath><path class="hatch" clip-path="url(#${id})" d="${hatchLines(...box, gap)}"/>`;
}

function wheel(c: P, r: number, teeth: number, phase = 0) {
  const pts: P[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = phase + (i / teeth) * Math.PI * 2;
    const w = (Math.PI * 2) / teeth;
    for (const [f, rr] of [[0, r], [0.13, r + 4.6], [0.44, r + 4.6], [0.57, r]] as const) pts.push([c[0] + Math.cos(a + f * w) * rr, c[1] + Math.sin(a + f * w) * rr]);
  }
  const spokes = Array.from({ length: 4 }, (_, i) => {
    const a = phase + (i * Math.PI) / 2 + 0.4;
    return `M${xy([c[0] + Math.cos(a) * 4, c[1] + Math.sin(a) * 4])}L${xy([c[0] + Math.cos(a) * (r - 4.4), c[1] + Math.sin(a) * (r - 4.4)])}`;
  }).join('');
  return path(`M${pts.map(xy).join('L')}Z`, 'paper') + circle(c, r - 4, 'fine') + path(spokes, 'fine') + circle(c, 3.2) + circle(c, 1, 'dot');
}

// The lit crescent: the outer edge of the disc on the right, the terminator a wider arc inside it.
const CRESCENT = 'M-4 -28A30 30 0 0 1 -4 32A40 40 0 0 0 -4 -28Z';

const EMBLEMS = {
  // Two toothed wheels in mesh.
  rotae: () => wheel([-11, 9], 23, 13, 0.1) + wheel([25.6, -21.6], 12.4, 7, 0.5) + path('M-46 44H40M-40 47.5H30', 'fine'),
  // An hourglass: its sand half run down.
  clepsydra: () =>
    path('M-27 -46H27V-40H-27ZM-27 40H27V46H-27Z', 'paper') +
    path('M-22 -40V40M22 -40V40', 'fine') +
    path('M-17 -40C-17 -15 -3 -6 -3 0C-3 6 -17 15 -17 40H17C17 15 3 6 3 0C3 -6 17 -15 17 -40Z', 'paper') +
    path('M-11.4 -17Q0 -11 11.4 -17L2.6 -3.6Q0 -1.8 -2.6 -3.6Z', 'sand') +
    path('M-15.6 38.6Q0 17 15.6 38.6Z', 'sand') +
    path('M0 -2V31', 'fine') +
    path('M13 -38C13 -20 4 -8 2.4 -3M13 38C13 22 5 9 2.6 4', 'shine'),
  // A folded letter under its seal, and the quill that wrote it.
  epistola: (id) =>
    path('M42 -46C30 -40 6 -16 -40 40M42 -46C40 -34 26 -16 2 -2M42 -46C36 -38 16 -26 -8 -12', 'fine') +
    path(Array.from({ length: 9 }, (_, i) => { const t = 0.15 + i * 0.07; const p: P = [42 - 82 * t, -46 + 86 * t]; return `M${xy(p)}l${r1(6 - i * 0.4)} ${r1(3 - i * 0.2)}`; }).join(''), 'fine') +
    path('M-34 -20H34V24H-34Z', 'paper') +
    path('M-34 -20L0 6L34 -20M-34 24L-8 2M34 24L8 2', 'fine') +
    hatched(`${id}-flap`, 'M-34 24L0 4L34 24Z', [-34, 4, 34, 24], 2.6) +
    circle([0, 6], 7.6, 'seal') +
    path('M-3 4L0 9L3 4M0 1V9', 'seal-mark'),
  // A torch for the relay, as the Greeks ran it: a bound staff, a basket of pitch, the flame streaming back.
  fax: () =>
    path('M-3.6 46L-5.4 4H5.4L3.6 46Z', 'paper') +
    path('M-5.2 8L5.2 13M-5 15L5 20M-4.7 22L4.8 27M-4.5 29L4.5 34M-4.2 36L4.3 41', 'fine') +
    path('M-12 4L-9 -8H9L12 4Z', 'paper') +
    path('M-10.6 -2H10.6M-9.6 -6L-6 4M-3 -8L-1 4M3 -8L1 4M9.6 -6L6 4', 'fine') +
    path('M0 -9C-14 -14 -16 -26 -8 -40C-6 -32 -2 -30 -1 -36C0 -42 4 -46 3 -50C12 -40 10 -30 6 -26C10 -27 13 -30 14 -34C18 -24 12 -12 0 -9Z', 'flame') +
    path('M0 -11C-6 -15 -7 -21 -3 -28C-1 -24 1 -24 1 -28C5 -23 5 -16 0 -11Z', 'flame') +
    path('M-12 -44l-1.6 -3M15 -40l1.8 -2.6M8 -52l0.4 -3', 'flame'),
  // The moon, with the ashen light Leonardo explained: the dark part lit by the earth.
  luna: (id) =>
    circle([-4, 2], 30, 'ashen') +
    path(CRESCENT, 'paper') +
    hatched(`${id}-moon`, CRESCENT, [-6, -30, 28, 34], 2.2) +
    path('M32 -36l0 8M28 -32h8M40 4l0 6M37 7h6M20 34l0 6M17 37h6M-38 -40l0 5M-40.5 -37.5h5', 'fine'),
  // Leonardo's knot: one cord, three loops, passing over and under itself.
  nodus: () => {
    const pt = (t: number): P => [13 * (Math.sin(t) + 2 * Math.sin(2 * t)), 13 * (Math.cos(t) - 2 * Math.cos(2 * t)) + 2];
    const seg = (a: number, b: number) => {
      const pts = Array.from({ length: 25 }, (_, i) => pt(a + ((b - a) * i) / 24));
      return `M${pts.map(xy).join('L')}`;
    };
    const parts = [0, 1, 2, 3, 4, 5].map((k) => seg((k * Math.PI) / 3 - 0.02, ((k + 1) * Math.PI) / 3 + 0.02));
    return [0, 2, 4, 1, 3, 5].map((k) => path(parts[k], 'cord') + path(parts[k], 'cord-in')).join('') + circle([0, 2], 46, 'fine');
  },
  // A gate in its arch, the portcullis half raised.
  porta: () =>
    path('M-40 46V-6A40 40 0 0 1 40 -6V46', 'paper') +
    path('M-28 46V-6A28 28 0 0 1 28 -6V46', 'fine') +
    path(Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i + 0.5) * (Math.PI / 9); return `M${xy([Math.cos(a) * 28, -6 + Math.sin(a) * 28])}L${xy([Math.cos(a) * 40, -6 + Math.sin(a) * 40])}`; }).join(''), 'fine') +
    path('M-18 -26V18M-6 -33V18M6 -33V18M18 -26V18M-26 -10H26M-28 4H28M-28 18H28', 'grille') +
    path('M-18 18l-2 6M-6 18l-2 6M6 18l-2 6M18 18l-2 6', 'fine') +
    path('M-48 46H48', ''),
  // A shield, banded and riveted.
  scutum: (id) =>
    path('M-28 -38H28V-8C28 16 14 32 0 44C-14 32 -28 16 -28 -8Z', 'paper') +
    path('M-23 -33H23V-8C23 13 11 27 0 38C-11 27 -23 13 -23 -8Z', 'fine') +
    path('M-23 -18L23 22M-23 -6L16 30', 'fine') +
    hatched(`${id}-band`, 'M-23 -18L23 22L23 30L16 30L-23 -6Z', [-24, -20, 24, 32], 2.4) +
    circle([-18, -28], 1.4, 'dot') + circle([18, -28], 1.4, 'dot') + circle([0, 36], 1.4, 'dot'),
  // The short road: two edges running to the horizon, and a milestone.
  via: () =>
    path('M-50 18H50', 'fine') +
    path('M-46 48L-3 18M46 48L3 18', '') +
    path('M0 44V38M0 32V28M0 24V21', 'fine') +
    path('M24 40V20C24 14 36 14 36 20V40Z', 'paper') +
    path('M30 24V34', '') +
    path('M-50 30L-36 22M-50 38L-26 26M-44 46L-18 30', 'fine') +
    path('M14 18C18 10 24 8 30 10M34 18C36 12 42 10 48 12', 'fine'),
  // A wing, from his studies of flight: the bones of the leading edge, the long primaries fanned from the hand, the
  // secondaries under the forearm, the coverts laid over their roots.
  ala: () => {
    const feather = (base: P, deg: number, L: number, w: number) => {
      const a = (deg * Math.PI) / 180;
      const v: P = [Math.cos(a), Math.sin(a)];
      const n: P = [-v[1], v[0]];
      const q = (u: number, k: number): P => [base[0] + v[0] * u * L + n[0] * k * w, base[1] + v[1] * u * L + n[1] * k * w];
      return { outline: `M${xy(q(0, 0))}C${xy(q(0.25, 1))} ${xy(q(0.8, 1))} ${xy(q(1, 0.25))}C${xy(q(0.96, -0.5))} ${xy(q(0.5, -0.75))} ${xy(q(0, 0))}Z`, shaft: `M${xy(q(0.03, 0))}L${xy(q(0.95, 0.15))}` };
    };
    const shoulder: P = [-46, -6];
    const elbow: P = [-14, -24];
    const wrist: P = [12, -30];
    const tip: P = [28, -28];
    const lerp = (p: P, q: P, t: number): P => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const parts: { outline: string; shaft: string }[] = [];
    // Secondaries, from the forearm, short and hanging back.
    for (let i = 0; i < 7; i++) parts.push(feather(lerp(elbow, wrist, i / 7 - 0.05), 104 - i * 4, 30 + i * 1.2, 5.6));
    // Primaries, from the hand, longer toward the tip and swept back.
    for (let i = 0; i < 7; i++) parts.push(feather(lerp(wrist, tip, i / 6), 86 - i * 7, 36 + i * 2.6, 5));
    // Tertials near the body.
    for (let i = 0; i < 4; i++) parts.push(feather(lerp(shoulder, elbow, 0.35 + i * 0.18), 112 - i * 3, 22 + i * 2, 5.8));
    const coverts = Array.from({ length: 12 }, (_, i) => {
      const p = i < 6 ? lerp(shoulder, wrist, 0.18 + i * 0.15) : lerp(wrist, tip, (i - 6) / 6);
      return `M${xy(p)}q${r1(1.2 + i * 0.1)} 6.4 ${r1(5.6 - i * 0.2)} 8.4`;
    }).join('');
    const bones = `M${xy(shoulder)}Q${xy([-30, -20])} ${xy(elbow)}L${xy(wrist)}L${xy(tip)}`;
    return '<g transform="translate(-4 4) rotate(-8) scale(0.84)">' + parts.reverse().map((f) => path(f.outline, 'paper') + path(f.shaft, 'fine')).join('') + path(bones, '') + path(coverts, 'fine') + '</g>';
  },
  // Dividers, opened, and the arc they have just struck.
  circinus: (id) => {
    const hinge: P = [0, -36];
    const leg = (tip: P, side: 1 | -1) => {
      const d: P = [tip[0] - hinge[0], tip[1] - hinge[1]];
      const l = Math.hypot(d[0], d[1]);
      const n: P = [(-d[1] / l) * side, (d[0] / l) * side];
      const at = (t: number, w: number): P => [hinge[0] + d[0] * t + n[0] * w, hinge[1] + d[1] * t + n[1] * w];
      return `M${xy(at(0, 4))}L${xy(at(0.84, 2))}L${xy(tip)}L${xy(at(0.84, -2))}L${xy(at(0, -4))}Z`;
    };
    const a = leg([-26, 44], 1);
    const b = leg([26, 44], -1);
    return (
      path('M-27 47A82 82 0 0 0 27 47', 'chalk') +
      path(a, 'paper') +
      path(b, 'paper') +
      hatched(`${id}-leg`, b, [-2, -40, 30, 46], 2.2) +
      path('M0 -42V-50M-4 -50H4', '') +
      circle(hinge, 6.4, 'paper') +
      circle(hinge, 1.8, 'dot')
    );
  },
  // His aerial screw: a sail wound round a mast, to bore into the air.
  cochlea: () => {
    const turn = (t: number): P => {
      const a = t * Math.PI * 3.2;
      const R = 38 - t * 12;
      return [Math.cos(a) * R, -2 - t * 40 + Math.sin(a) * R * 0.22];
    };
    const edge = Array.from({ length: 90 }, (_, i) => turn(i / 89));
    const ribs = Array.from({ length: 13 }, (_, i) => {
      const p = turn(i / 12);
      return `M0 ${r1(p[1] + 3)}L${xy(p)}`;
    }).join('');
    return (
      path(ribs, 'fine') +
      path(`M${edge.map(xy).join('L')}`, '') +
      path('M0 -48V30', '') +
      path('M-30 30A30 7 0 1 0 30 30A30 7 0 1 0 -30 30Z', 'paper') +
      path('M-24 34L-28 46M24 34L28 46M0 37V48M-8 30V24H8V30', 'fine')
    );
  },
  // Water turning on itself, as he drew it falling into a pool.
  vortex: () => {
    const spiral = Array.from({ length: 80 }, (_, i) => {
      const t = i / 79;
      const a = t * Math.PI * 5;
      const r = 3 + t * 26;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.8] as P;
    });
    return (
      path(`M${spiral.map(xy).join('L')}`, '') +
      path('M-46 -30C-30 -38 -6 -40 14 -30M-48 -18C-30 -26 -10 -28 6 -22M-46 40C-26 34 0 34 24 24M-30 46C-12 42 8 40 30 30', 'fine')
    );
  },
  // A key, as a Roman smith cut it: the ring it hangs by, the shank, the bit and its ward.
  clavis: (id) => {
    const bit = 'M17 21.2L28.4 32.6L19.2 41.8L15.6 38.2L18.6 35.2L15 31.6L12 34.6L7.8 30.4Z';
    return (
      path('M-14.6 -10.4L-10.4 -14.6L36 31.8L31.8 36Z', 'paper') +
      path(bit, 'paper') +
      hatched(`${id}-bit`, bit, [6, 20, 30, 43], 2.3) +
      circle([-24, -24], 15, 'paper') +
      circle([-24, -24], 8.4, 'fine') +
      path('M-9.6 -5.4L-5.4 -9.6M-6 -1.8L-1.8 -6', 'fine') +
      path('M-36 -30C-37 -22 -33 -14 -26 -11', 'shine')
    );
  },
  // A tree: one trunk and three boughs, each with its own crown.
  arbor: () =>
    path('M-5 46C-4 30 -3.4 20 -3 8L3 8C3.4 20 4 30 5 46Z', 'paper') +
    path('M-3 9C-6 -4 -16 -12 -27 -17M0 8C0 -6 0 -18 1 -29M3 9C7 -3 17 -10 28 -14', '') +
    path('M-14 -9C-18 -8 -22 -4 -23 0M10 -4C15 -4 19 -1 21 3M0.6 -14C4 -16 7 -19 8 -23', 'fine') +
    circle([-30, -24], 11, 'paper') +
    circle([1, -38], 11.5, 'paper') +
    circle([31, -20], 10.5, 'paper') +
    path('M-36 -26C-33 -30 -28 -30 -25 -27M-34 -20C-30 -23 -27 -22 -25 -19M-4 -41C-1 -45 4 -45 7 -41M-3 -34C0 -37 4 -36 6 -33M26 -23C29 -27 34 -26 36 -22M27 -16C30 -19 34 -18 35 -15', 'fine') +
    path('M-22 46H22M-14 49.5H14M-1.6 40C-1.4 30 -1.2 22 -1 14', 'fine'),
  // A balance: what is spent in one pan, what it buys in the other.
  libra: () =>
    path('M-3 44L-1.4 -30H1.4L3 44Z', 'paper') +
    path('M-16 44H16M-11 47.5H11', '') +
    path('M-36 -27L36 -39', '') +
    circle([0, -33], 3.4, 'paper') +
    path('M-36 -27L-46 4M-36 -27L-26 4M36 -39L26 -10M36 -39L46 -10', 'fine') +
    path('M-48 4H-24C-24 13 -29 17 -36 17C-43 17 -48 13 -48 4Z', 'paper') +
    path('M24 -10H48C48 -1 43 3 36 3C29 3 24 -1 24 -10Z', 'paper') +
    circle([-39.4, 0.4], 3, 'sand') +
    circle([-32.8, 0.4], 3, 'sand') +
    circle([-36, -4.6], 3, 'sand'),
  // The devices of the tables that had none among the studies' emblems. Each table of the catalogue has a device, as
  // a printer or a guild had (src/data/devices.ts says which).
  // A counting frame: the machine on a Roman desk.
  abacus: () => {
    const rods = [-28, -14, 0, 14, 28];
    // What the frame reads, rod by rod: beads pushed to the beam count, the rest wait at the rail.
    const fives = [1, 0, 0, 1, 0];
    const ones = [2, 3, 1, 4, 0];
    const beads = rods
      .map((x, i) => {
        const upper = circle([x, fives[i] ? -16.6 : -28.4], 4.2, 'sand');
        const lower = [0, 1, 2, 3].map((k) => circle([x, k < ones[i] ? -5.4 + k * 8.4 : 29.4 - (3 - k) * 8.4], 4.2, 'sand')).join('');
        return upper + lower;
      })
      .join('');
    return (
      path('M-40 -34H40V34H-40Z', 'paper') +
      path(rods.map((x) => `M${x} -34V34`).join(''), 'fine') +
      path('M-40 -12H40M-40 -10.4H40') +
      beads +
      path('M-34 34V40M34 34V40M-46 40H46', 'fine')
    );
  },
  // A scallop: the shell.
  concha: () => {
    const hinge: P = [0, 32];
    const ribs = 9;
    const at = (i: number, r: number): P => {
      const a = ((-160 + (i * 140) / ribs) * Math.PI) / 180;
      return [hinge[0] + r * Math.cos(a), hinge[1] + r * Math.sin(a)];
    };
    let rim = `M${xy(at(0, 62))}`;
    for (let i = 0; i < ribs; i++) rim += `Q${xy(at(i + 0.5, 69))} ${xy(at(i + 1, 62))}`;
    const lines = Array.from({ length: ribs + 1 }, (_, i) => `M${xy(at(i, 9))}L${xy(at(i, 61))}`).join('');
    const growth = [27, 44].map((r) => `M${xy(at(0.2, r))}${Array.from({ length: ribs }, (_, i) => `Q${xy(at(i + 0.5, r + 3.2))} ${xy(at(Math.min(ribs - 0.2, i + 1), r))}`).join('')}`).join('');
    return (
      path(`${rim}L${xy(hinge)}Z`, 'paper') +
      path(lines, 'fine') +
      path(growth, 'fine') +
      path('M-15 30H15V37H-15Z', 'paper') +
      path('M-9 30V37M-3 30V37M3 30V37M9 30V37', 'fine')
    );
  },
  // An aqueduct: the works that carry everything else.
  aquaeductus: () => {
    const lower = [-39, -11, 17].map((x) => `M${x} 36V15A11 11 0 0 1 ${x + 22} 15V36Z`).join('');
    const upper = [-41, -27, -13, 1, 15, 29].map((x) => `M${x} 4V-9A5 5 0 0 1 ${x + 10} -9V4Z`).join('');
    return (
      `<path class="paper" fill-rule="evenodd" d="M-45 -18H45V36H-45Z${lower}${upper}"/>` +
      path('M-45 4H45', 'fine') +
      path('M-48 -24H48V-18H-48Z', 'paper') +
      path('M-44 -21q3 -2 6 0t6 0t6 0t6 0t6 0t6 0t6 0t6 0t6 0t6 0t6 0t6 0t6 0t6 0', 'fine') +
      path('M-50 36H50M-42 40H30', 'fine')
    );
  },
  // An armillary sphere: the heavens in rings, for watching them.
  sphaera: () =>
    path('M0 -44V26', 'fine') +
    circle([0, -8], 30) +
    path('M-30 -8A30 9 0 1 0 30 -8A30 9 0 1 0 -30 -8', 'fine') +
    path('M0 -38A11 30 0 1 0 0 22A11 30 0 1 0 0 -38', 'fine') +
    path('M-27.6 3.7A30 9.5 -23 1 0 27.6 -19.7A30 9.5 -23 1 0 -27.6 3.7') +
    circle([0, -8], 4.6, 'sand') +
    circle([0, -44], 1.8, 'dot') +
    path('M0 22V34M-16 44Q0 28 16 44M-21 44H21') +
    path('M-12 44H12', 'fine'),
  // Two coins, the upper one struck with the sign of Bitcoin: a B with two strokes through it, above and below.
  nummus: () =>
    circle([6, 7], 33, 'paper') +
    circle([-3, -3], 33, 'paper') +
    circle([-3, -3], 27, 'fine') +
    Array.from({ length: 28 }, (_, i) => circle([-3 + 30 * Math.cos((i / 28) * Math.PI * 2), -3 + 30 * Math.sin((i / 28) * Math.PI * 2)], 0.8, 'dot')).join('') +
    path('M-11 -18V12M-11 -18H0C7 -18 9 -13 9 -10C9 -6 6 -3 0 -3H-11M0 -3C8 -3 11 1 11 5C11 9 7 12 0 12H-11') +
    path('M-6 -22V-18M0 -22V-18M-6 12V16M0 12V16') +
    path('M31 22A33 33 0 0 1 14 39', 'fine'),
  // An open book, with its ribbon.
  liber: () => {
    const lines = [-15, -7, 1, 9].map((y) => `M-38 ${y + 2}Q-22 ${y - 3} -7 ${y + 2}M38 ${y + 2}Q22 ${y - 3} 7 ${y + 2}`).join('');
    return (
      path('M-47 -19V29C-30 23 -12 24 0 32C12 24 30 23 47 29V-19', 'fine') +
      path('M0 -22C-12 -30 -30 -30 -44 -24V24C-30 18 -12 18 0 26Z', 'paper') +
      path('M0 -22C12 -30 30 -30 44 -24V24C30 18 12 18 0 26Z', 'paper') +
      path(lines, 'fine') +
      path('M3 25V42L0 38L-3 42V26', 'seal')
    );
  },
} satisfies Record<string, (id: string) => string>;

export interface Emblem {
  name: keyof typeof EMBLEMS;
  /** Its centre on the 800 × 470 sheet, and the width of its box. */
  x: number;
  y: number;
  size: number;
  /** Its name, in the same Latin, under it. */
  label?: string;
}
export function emblem(e: Emblem, uid: string): string {
  const draw = EMBLEMS[e.name];
  if (!draw) throw new Error(`no emblem called ${e.name}`);
  return draw(`${uid}-${e.name}`);
}
