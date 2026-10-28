// Every binding in Cole's tmux.conf (github.com/coletebou/dx, base/tmux.conf), by layer, for the keymap study.
// `key` is the physical key (KeyboardEvent.code without the "Key"/"Digit" prefix, lowercased); `shift` marks the
// shifted binding on that key.

export type Layer = 'alt' | 'prefix' | 'root' | 'mouse';
export interface Binding {
  layer: Layer;
  key: string;
  shift?: boolean;
  ctrl?: boolean;
  chord: string[];
  action: string;
  why: string;
  conf: string;
  stock?: boolean;
}

const alt = (key: string, action: string, why: string, conf: string, shift = false): Binding => ({
  layer: 'alt',
  key,
  shift,
  chord: ['Alt', ...(shift ? ['Shift'] : []), key.toUpperCase()],
  action,
  why,
  conf,
});
const pre = (key: string, action: string, why: string, conf: string, o: { shift?: boolean; ctrl?: boolean; label?: string; stock?: boolean } = {}): Binding => ({
  layer: 'prefix',
  key,
  shift: o.shift,
  ctrl: o.ctrl,
  chord: ['Ctrl', 'B', '→', ...(o.ctrl ? ['Ctrl'] : []), ...(o.shift ? ['Shift'] : []), o.label ?? key.toUpperCase()],
  action,
  why,
  conf,
  stock: o.stock,
});

const windows = Array.from({ length: 9 }, (_, i) =>
  alt(String(i + 1), `Window ${i + 1}`, 'Jump straight to a window by number. Windows count from 1 (base-index 1) and renumber themselves when one closes, so the numbers stay contiguous.', `bind -n M-${i + 1} select-window -t ${i + 1}`),
);

export const BINDINGS: Binding[] = [
  alt('h', 'Previous window', 'One chord, no prefix: built to be easy from a phone keyboard in Termius as much as from the desk.', 'bind -n M-h previous-window'),
  alt('l', 'Next window', 'The partner of Alt+h. h and l are left and right, as in vi.', 'bind -n M-l next-window'),
  alt('s', 'Next session', 'Cycles through every tmux session and wraps around.', 'bind -n M-s switch-client -n'),
  alt('s', 'Previous session', 'The same cycle, backwards.', 'bind -n M-S switch-client -p', true),
  ...windows,
  alt(
    'a',
    'New agent window',
    'Opens a window named "yolo" right after this one, in this directory, running Claude Code with permission prompts skipped. It runs through a login shell (zsh -lic) so the agent picks up fresh credentials instead of the tmux server’s frozen environment.',
    'bind -n M-a new-window -a -n yolo -c "#{pane_current_path}" \'exec zsh -lic "claude --dangerously-skip-permissions"\'',
  ),
  alt('y', 'Kill window', 'Closes the window in one chord, easier than the stock prefix & (and its confirmation).', 'bind -n M-y kill-window'),
  alt('c', 'Capture scrollback', 'Copies the pane’s entire scrollback into tmux’s paste buffer; paste it with prefix ].', "bind -n M-c capture-pane -S - -E - \\; display-message 'captured scrollback to tmux buffer'"),
  alt('c', 'Capture to the clipboard', 'The same capture, sent on to the local clipboard with OSC 52, so it works even when the pane is a session on a server over SSH.', 'bind -n M-C run-shell -E "~/.dotfiles/base/tmux-copy-buffer.sh"', true),
  {
    layer: 'root',
    key: 'k',
    ctrl: true,
    chord: ['Ctrl', 'K'],
    action: 'Clear scrollback',
    why: 'Wipes the pane’s history. Note that this takes Ctrl+K away from the shell’s kill-to-end-of-line.',
    conf: 'bind -n C-k clear-history',
  },
  pre('c', 'New window, same host', 'If the pane is SSH’d somewhere, the new window opens already connected to that host, in the same remote directory. Otherwise it is a plain new window in this directory, inserted after the current one.', 'bind c run-shell "~/.dotfiles/base/tmux-ssh-inherit.sh window #{pane_id}"'),
  pre('c', 'New local window', 'The escape hatch: always a window on this machine, even from an SSH’d pane. “c, but don’t be clever.”', 'bind C-c new-window -a -c "#{pane_current_path}"', { ctrl: true }),
  pre('backslash', 'Split side by side', 'A vertical divider, panes left and right. SSH-aware like prefix c: the new pane opens on the same host.', 'bind | run-shell "~/.dotfiles/base/tmux-ssh-inherit.sh hsplit #{pane_id}"', { shift: true, label: '|' }),
  pre('minus', 'Split top and bottom', 'A horizontal divider. Also SSH-aware.', 'bind - run-shell "~/.dotfiles/base/tmux-ssh-inherit.sh vsplit #{pane_id}"', { label: '-' }),
  pre('a', 'New agent window', 'The same "yolo" Claude Code window as Alt+a.', 'bind a new-window -a -n yolo -c "#{pane_current_path}" \'exec zsh -lic "claude --dangerously-skip-permissions"\''),
  pre('a', 'New Claude window that says hi', 'A window named "claude" that starts Claude Code, with prompts, and sends it "hi".', 'bind A new-window -a -n claude -c "#{pane_current_path}" \'exec zsh -lic "claude \\"hi\\""\'', { shift: true }),
  pre('k', 'Send Ctrl+C', 'Interrupt the program in the pane. Phone keyboards make Ctrl awkward; prefix k does not need it twice.', 'bind k send-keys C-c'),
  pre('q', 'Send Ctrl+D', 'End of input: exits a shell or a REPL.', 'bind q send-keys C-d'),
  pre('z', 'Send Ctrl+Z', 'Suspend the foreground program. This replaces tmux’s stock prefix z (zoom pane).', 'bind z send-keys C-z'),
  pre('l', 'Send Ctrl+L', 'Clear the screen. This replaces the stock prefix l (last window); Alt+h and Alt+l cover window moves.', 'bind l send-keys C-l'),
  pre('r', 'Reload the config', 'Re-reads ~/.tmux.conf in every session.', 'bind r source-file ~/.tmux.conf \\; display-message "Config reloaded"'),
  pre('m', 'Toggle the mouse', 'Mouse is on by default; switch it off when you want the terminal itself to own selection and scrollback.', 'bind M set -g mouse \\; display-message "mouse: #{?mouse,on,off}"', { shift: true }),
  pre('s', 'Session tree', 'Every session, window and pane in a tree, colored by recency like the status bar, with handoff badges.', "bind s set -gF @chooser-session '#{session_id}' \\; choose-tree -Zs -F '#{E:@tree-fmt}'"),
  pre('w', 'Window tree', 'The same tree opened at the windows.', "bind w set -gF @chooser-session '#{session_id}' \\; choose-tree -Zw -F '#{E:@tree-fmt}'"),
  pre('b', 'Toggle the status bar', 'Hides the status bar, or brings it back with both rows.', 'bind b if -F "#{==:#{status},off}" "set -g status 2" "set -g status off"'),
  pre('b', 'Toggle the sessions row', 'Switches the status bar between one row (windows) and two (windows, then every session).', 'bind B if -F "#{==:#{status},2}" "set -g status on" "set -g status 2"', { shift: true }),
  pre('s', 'Save the layout', 'tmux-resurrect saves every session, window and pane (and the Claude sessions in them); tmux-continuum also saves every 15 minutes.', "set -g @plugin 'tmux-plugins/tmux-resurrect'", { ctrl: true }),
  pre('r', 'Restore the layout', 'Brings a saved layout back after a reboot. Restore is manual on purpose (continuum auto-restore is off).', "set -g @continuum-restore 'off'", { ctrl: true }),
  pre('d', 'Detach', 'Leave tmux running and drop back to the shell; reattach later with tm.', '(tmux default)', { stock: true }),
  pre('x', 'Kill pane', 'Closes the current pane after a confirmation.', '(tmux default)', { stock: true }),
  pre('lbracket', 'Copy mode', 'Scroll and select with the keyboard. The mouse wheel enters it too.', '(tmux default)', { label: '[', stock: true }),
  pre('rbracket', 'Paste the buffer', 'Pastes what Alt+c captured or copy mode copied.', '(tmux default)', { label: ']', stock: true }),
];

export const MOUSE = [
  { action: 'Scroll', how: 'Wheel', why: 'Scrolls five lines a notch; scrolling up enters copy mode on its own.', conf: 'bind-key -T copy-mode WheelUpPane select-pane \\; send-keys -X -N 5 scroll-down' },
  { action: 'Copy a selection', how: 'Drag, release', why: 'Copies and stays in copy mode at the same place, instead of snapping back to the bottom.', conf: 'bind -T copy-mode MouseDragEnd1Pane send-keys -X copy-selection' },
  { action: 'Switch window or session', how: 'Click the status bar', why: 'The first row lists windows, the second every session; clicking either switches to it.', conf: 'bind -n MouseDown1Status switch-client -t=' },
];

export const LAYERS: { id: Layer; label: string; note: string }[] = [
  { id: 'alt', label: 'Alt, no prefix', note: 'Hold Alt (Option on a Mac) and press the key. One chord, nothing first.' },
  { id: 'prefix', label: 'Ctrl+b, then…', note: 'Press Ctrl+b, let go, then press the key. The stock tmux prefix, kept as it is.' },
  { id: 'root', label: 'Ctrl, no prefix', note: 'A Ctrl chord tmux takes for itself before the program in the pane sees it.' },
  { id: 'mouse', label: 'Mouse', note: 'Mouse mode is on: the wheel, a drag and the status bar all do something.' },
];
