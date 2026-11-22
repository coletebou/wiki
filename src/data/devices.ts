// The device of each table of the catalogue: a small drawing that stands for it, as a printer's or a guild's stood
// for theirs. Each was drawn by an image model in the manner of Leonardo's pen, then traced into vector ink
// (scripts/gen-devices.sh says how); each keeps its Latin name.
import abacus from '../assets/devices/desk.svg?url';
import concha from '../assets/devices/shell.svg?url';
import rotae from '../assets/devices/automata.svg?url';
import circinus from '../assets/devices/workshop.svg?url';
import aquaeductus from '../assets/devices/works.svg?url';
import sphaera from '../assets/devices/observatory.svg?url';
import ala from '../assets/devices/atelier.svg?url';
import nummus from '../assets/devices/mint.svg?url';
import libra from '../assets/devices/ledger.svg?url';
import liber from '../assets/devices/library.svg?url';

export const DEVICES: Record<string, { src: string; latin: string }> = {
  desk: { src: abacus, latin: 'abacus' },
  shell: { src: concha, latin: 'concha' },
  automata: { src: rotae, latin: 'rotae' },
  workshop: { src: circinus, latin: 'circinus' },
  works: { src: aquaeductus, latin: 'aquaeductus' },
  observatory: { src: sphaera, latin: 'sphaera' },
  atelier: { src: ala, latin: 'ala' },
  mint: { src: nummus, latin: 'nummus' },
  ledger: { src: libra, latin: 'libra' },
  library: { src: liber, latin: 'liber' },
};
