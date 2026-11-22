// A frame round every code block, built with the page: the block scrolls sideways inside it when a line is long,
// while its language label (and the copy button folio.ts adds) stay put on the frame instead of scrolling away with
// the text.
/** @returns {import('shiki').ShikiTransformer} */
export function codeFrame() {
  return {
    name: 'codex-code-frame',
    root(root) {
      const lang = this.options.lang;
      root.children = [
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['code-frame'], ...(lang && lang !== 'plaintext' ? { dataLanguage: lang } : { dataLanguage: 'text' }) },
          children: root.children,
        },
      ];
    },
  };
}
