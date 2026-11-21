// Illumination: which letter opens a folio, for the initial drawn there (src/components/Initial.astro draws it, in
// Pacioli's constructed capitals). Pure.

/** The first letter of a folio's text, if the folio opens on a letter (not on code, a key or a mark). */
export function initialOf(body) {
  const text = String(body).replace(/^\s+/, '');
  // A wiki link prints its page's title, which is not the letter typed here: such a folio opens plain. So does one
  // that opens on a line of MDX, which prints nothing.
  if (text.startsWith('[[') || /^(import|export)\s/.test(text)) return null;
  const m = /^(?:\*\*|__|\*|_|\[)?([A-Za-z])/.exec(text);
  return m ? m[1].toUpperCase() : null;
}
