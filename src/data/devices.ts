// The device of each table of the catalogue: a small drawing that stands for it, as a printer's or a guild's stood
// for theirs. Each was drawn by an image model in the manner of Leonardo's pen, then traced into vector ink
// (scripts/gen-devices.sh says how): once with the pen's own line, for the head of a table in the catalogue, and once
// with a broader nib, for the small device before a table's name, where a fine line would fade. Each keeps its
// Latin name.
import abacus from '../assets/devices/desk.svg?url';
import abacusSmall from '../assets/devices/small/desk.svg?url';
import concha from '../assets/devices/shell.svg?url';
import conchaSmall from '../assets/devices/small/shell.svg?url';
import rotae from '../assets/devices/automata.svg?url';
import rotaeSmall from '../assets/devices/small/automata.svg?url';
import circinus from '../assets/devices/workshop.svg?url';
import circinusSmall from '../assets/devices/small/workshop.svg?url';
import aquaeductus from '../assets/devices/works.svg?url';
import aquaeductusSmall from '../assets/devices/small/works.svg?url';
import sphaera from '../assets/devices/observatory.svg?url';
import sphaeraSmall from '../assets/devices/small/observatory.svg?url';
import ala from '../assets/devices/atelier.svg?url';
import alaSmall from '../assets/devices/small/atelier.svg?url';
import nummus from '../assets/devices/mint.svg?url';
import nummusSmall from '../assets/devices/small/mint.svg?url';
import libra from '../assets/devices/ledger.svg?url';
import libraSmall from '../assets/devices/small/ledger.svg?url';
import liber from '../assets/devices/library.svg?url';
import liberSmall from '../assets/devices/small/library.svg?url';

export const DEVICES: Record<string, { src: string; small: string; latin: string }> = {
  desk: { src: abacus, small: abacusSmall, latin: 'abacus' },
  shell: { src: concha, small: conchaSmall, latin: 'concha' },
  automata: { src: rotae, small: rotaeSmall, latin: 'rotae' },
  workshop: { src: circinus, small: circinusSmall, latin: 'circinus' },
  works: { src: aquaeductus, small: aquaeductusSmall, latin: 'aquaeductus' },
  observatory: { src: sphaera, small: sphaeraSmall, latin: 'sphaera' },
  atelier: { src: ala, small: alaSmall, latin: 'ala' },
  mint: { src: nummus, small: nummusSmall, latin: 'nummus' },
  ledger: { src: libra, small: libraSmall, latin: 'libra' },
  library: { src: liber, small: liberSmall, latin: 'liber' },
};
