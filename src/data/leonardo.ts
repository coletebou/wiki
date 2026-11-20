// Lines from Leonardo's notebooks, as the outer margin carries them in his mirror hand. `en` is Jean Paul Richter's
// English (The Literary Works of Leonardo da Vinci, 1883, now in the public domain), word for word, with his section
// number in `richter`; "…" marks words of his left out. The one line he did not translate has a plain rendering and
// no number.
export interface Line {
  it: string;
  en: string;
  richter?: number;
}

export const LINES: Line[] = [
  { it: 'Chi poco pensa, molto erra', en: 'He who thinks little, errs much.', richter: 1192 },
  { it: 'Ogni nostra cognizione prencipia da sentimenti', en: 'All our knowledge has its origin in our perceptions.', richter: 1147 },
  { it: 'La sapienza è figliola della sperienza', en: 'Wisdom is the daughter of experience.', richter: 1150 },
  { it: 'Ostinato rigore', en: 'Stubborn rigour.', richter: 681 },
  { it: 'Di mi se mai fu fatta alcuna cosa', en: 'Tell me if anything was ever done.', richter: 1365 },
  { it: 'O tempo, consumatore delle cose', en: 'O Time! consumer of all things …', richter: 1163 },
  { it: 'Ogni impedimento è distrutto dal rigore', en: 'Every obstacle yields to stern resolve', richter: 682 },
  { it: 'Studia prima la scienza, e poi seguita la pratica', en: 'Study the science first, and then follow the practice.' },
  { it: 'Il ferro s’arrugginisce sanza esercizio', en: 'Just as iron rusts unless it is used … so our intellect spoils unless it is kept in use.', richter: 1177 },
  { it: 'L’acqua che tocchi de’ fiumi è l’ultima di quella che andò', en: 'The water you touch in a river is the last of that which has passed, and the first of that which is coming.', richter: 1174 },
];
