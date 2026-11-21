// The device of each table of the catalogue: a small drawing that stands for it, as a printer's or a guild's stood
// for theirs. The drawings are among the emblems (src/diagrams/emblems.ts); each has its Latin name.
import type { Emblem } from '../diagrams/emblems';

export const DEVICES: Record<string, { emblem: Emblem['name']; latin: string }> = {
  desk: { emblem: 'abacus', latin: 'abacus' },
  shell: { emblem: 'concha', latin: 'concha' },
  automata: { emblem: 'rotae', latin: 'rotae' },
  workshop: { emblem: 'circinus', latin: 'circinus' },
  works: { emblem: 'aquaeductus', latin: 'aquaeductus' },
  observatory: { emblem: 'sphaera', latin: 'sphaera' },
  atelier: { emblem: 'ala', latin: 'ala' },
  mint: { emblem: 'nummus', latin: 'nummus' },
  ledger: { emblem: 'libra', latin: 'libra' },
  library: { emblem: 'liber', latin: 'liber' },
};
