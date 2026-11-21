// A page's words as a reader sees them, and the catalogue's measures of them. Pure.
import { WIKILINK, maskFences } from './wikilinks.mjs';

const INLINE_CODE = /(`+)((?:(?!\n[ \t]*\n)[\s\S])*?[^`])\1(?!`)/g;

/** The body without fenced code blocks or MDX comments. Inline code stays: its words are words the reader reads. */
const prose = (body) => maskFences(String(body)).replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

/**
 * Markdown and MDX reduced to plain text: no code blocks, components, link syntax or table rules. Inline code keeps
 * its words, set aside first so that nothing inside it is read as a link or as markup.
 */
export function plainText(body) {
  const spans = [];
  return prose(body)
    .replace(INLINE_CODE, (_, _ticks, code) => `\u0000${spans.push(code.trim()) - 1}\u0000`)
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
    .replace(/\u0000(\d+)\u0000/g, (_, i) => spans[Number(i)])
    .replace(/\s+/g, ' ')
    .trim();
}

/** The incipit: a work's opening words, which the Pinakes recorded beside its title. */
export function incipit(body, words = 11) {
  const lede = prose(body)
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
