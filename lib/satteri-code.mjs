// Sätteri mdast plugin: inline code short enough to fit on any line is kept whole. A browser breaks a line after any
// hyphen, so `./install.sh --with tmux` could split into a lone dash and a "-with" that copies wrong; a short span
// is marked to stay on one line (codex.css), and only a long one, a path or a whole command, may still wrap.
export const SHORT = 30;

export function shortCode() {
  return () => ({
    name: 'short-code',
    inlineCode(node, ctx) {
      if (node.value.length > SHORT || node.data?.hProperties?.className) return;
      ctx.replaceNode(node, { ...node, data: { ...node.data, hProperties: { ...node.data?.hProperties, className: ['nobr'] } } });
    },
  });
}
