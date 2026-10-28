// A page's words as a reader sees them, and the catalogue's measures of them. Pure.
import { WIKILINK, maskCode } from './wikilinks.mjs';

/** Markdown and MDX reduced to plain text: no code, components, link syntax or table rules. */
export function plainText(body) {
  return maskCode(String(body))
    .replace(/^import .*$/gm, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(WIKILINK, (_, target, anchor, label) => (label ?? target).trim())
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^ {0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, ' ')
    .replace(/[*_~`>#|]/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The incipit: a work's opening words, which the Pinakes recorded beside its title. */
export function incipit(body, words = 11) {
  const lede = maskCode(String(body))
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .find((b) => b && !/^(#|<|import |\||\{\/\*)/.test(b));
  const text = plainText(lede ?? body).split(' ').filter(Boolean);
  return text.slice(0, words).join(' ').replace(/[,;:.]$/, '') + (text.length > words ? '…' : '');
}

/**
 * Stichometry: Alexandrian scribes measured a work in stichoi, standard lines of about 36 letters (a hexameter's
 * worth), so a catalogue could say how long a scroll was and copyists could be paid by the line.
 */
export const stichoi = (body) => Math.max(1, Math.round(plainText(body).replace(/\s/g, '').length / 36));

export const wordCount = (body) => plainText(body).split(' ').filter(Boolean).length;
