// The agent-fleet study: six views of one fleet. Each view is a drawing of nodes and flows on an 800 × 470 sheet,
// plus a walk-through: numbered steps that light up the parts they talk about. Facts match the pages each view
// illustrates (agent-fleet, hooks, agent-messaging, handoff-chains, cc-park, shared-brain).

import type { Emblem } from '../diagrams/emblems';

export type Kind = 'box' | 'frame' | 'store' | 'dot' | 'tab';
export interface FNode {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  label: string;
  sub?: string;
  /** For dots: where the label sits relative to the dot. */
  lx?: number;
  ly?: number;
  anchor?: 'start' | 'middle' | 'end';
  dashed?: boolean;
  info?: string;
}
export interface Flow {
  id: string;
  from: string;
  to: string;
  bend?: number;
  label?: string;
  /** Moves the label off the curve's midpoint, where it would sit on another label or between two close boxes. */
  ldx?: number;
  ldy?: number;
  dashed?: boolean;
}
export interface Step {
  title: string;
  text: string;
  on: string[];
  flows?: string[];
}
export interface Scene {
  id: string;
  name: string;
  motto: string;
  intro: string;
  nodes: FNode[];
  flows: Flow[];
  steps: Step[];
  /** Hook events per dot, for the hooks view. */
  hooks?: Record<string, { name: string; does: string }[]>;
  /** Extra ink drawn under the nodes (SVG markup), and where the motto sits. */
  decor?: string;
  mottoAt?: { x: number; y: number; anchor?: 'start' | 'middle' | 'end' };
  /** A small ink sketch for an empty corner of the sheet (src/diagrams/emblems.ts). */
  emblem?: Emblem;
}

const ring = (deg: number, r = 130, cx = 400, cy = 240) => ({
  x: Math.round(cx + r * Math.sin((deg * Math.PI) / 180)),
  y: Math.round(cy - r * Math.cos((deg * Math.PI) / 180)),
});
const ev = (id: string, deg: number, label: string, info: string): FNode => {
  const p = ring(deg);
  const out = ring(deg, 156);
  const side = deg === 0 || deg === 180 ? 'middle' : deg < 180 ? 'start' : 'end';
  return { id, kind: 'dot', ...p, r: 9, label, lx: out.x - p.x, ly: out.y - p.y + 4, anchor: side, info };
};

/** The hooks view's ring, drawn as an astrolabe's dial: a degree every five, a longer mark every thirty, between two
 * rings, and an arrow struck outside it to say which way the session runs. */
function dial(cx = 400, cy = 240) {
  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.sin(a)).toFixed(1)} ${(cy - r * Math.cos(a)).toFixed(1)}`;
  };
  const ticks = Array.from({ length: 72 }, (_, i) => `M${at(i * 5, 121.5)}L${at(i * 5, i % 6 === 0 ? 127.5 : 124.5)}`).join('');
  const head = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    const [x, y] = [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const [tx, ty] = [Math.cos(a), Math.sin(a)];
    const barb = (s: number) => `${(x - tx * 6.5 + -ty * s * 3.2).toFixed(1)} ${(y - ty * 6.5 + tx * s * 3.2).toFixed(1)}`;
    return `M${barb(1)}L${x.toFixed(1)} ${y.toFixed(1)}L${barb(-1)}`;
  };
  return (
    `<circle cx="${cx}" cy="${cy}" r="130" class="ring" /><circle cx="${cx}" cy="${cy}" r="121.5" class="ring-fine" />` +
    `<path d="${ticks}" class="ring-ticks" />` +
    `<path d="M${at(7, 146)}A146 146 0 0 1 ${at(27, 146)}${head(27, 146)}" class="ring-arrow" />`
  );
}

export const SCENES: Scene[] = [
  {
    id: 'fleet',
    name: 'The fleet',
    motto: 'de machinis',
    emblem: { name: 'rotae', x: 400, y: 148, size: 70, label: 'rotae' },
    intro: 'The machines, the agents on them, and what ties them together. Pick a view above, or step through the tour.',
    nodes: [
      { id: 'phone', kind: 'box', x: 30, y: 26, w: 170, h: 62, label: 'Phone', sub: 'Termius · Drover app · watch', info: 'Cole checks in from the phone: Termius for a shell (SSH over Tailscale, Alt bindings and all), the Drover app and watch for who is waiting.' },
      { id: 'mac', kind: 'frame', x: 20, y: 130, w: 330, h: 240, label: 'Mac mini', info: 'The desk machine: Ghostty and tmux, coordinator sessions, Xcode, and anything that needs a Mac.' },
      { id: 'mac-tmux', kind: 'box', x: 40, y: 168, w: 290, h: 62, label: 'Ghostty + tmux', sub: 'coordinators and workers, a window each', info: 'Every agent lives in a tmux window, so it survives a closed terminal and can be reached from the phone.' },
      { id: 'mac-agents', kind: 'box', x: 40, y: 262, w: 140, h: 82, label: 'Claude Code', sub: 'and Codex', info: 'Two engines: Claude Code is the workhorse, Codex an independent second opinion and a fallback when one provider has a bad hour.' },
      { id: 'mac-drover', kind: 'box', x: 194, y: 262, w: 136, h: 82, label: 'Drover', sub: 'daemon', info: 'One Drover daemon per machine: every session on every host, messages, launches, and an append-only truth file.' },
      { id: 'srv', kind: 'frame', x: 450, y: 130, w: 330, h: 240, label: 'AWS servers', info: 'Anything that should keep running when the laptop lid closes: long agent sessions, heavy test suites, production bots.' },
      { id: 'srv-agents', kind: 'box', x: 470, y: 168, w: 290, h: 62, label: 'Long agent sessions', sub: 'tmux, running for hours', info: 'Workers run here for hours, each in its own worktree and tmux window.' },
      { id: 'srv-drover', kind: 'box', x: 470, y: 262, w: 136, h: 82, label: 'Drover', sub: 'daemon', info: 'The same daemon, reachable from every other machine over SSH on the tailnet.' },
      { id: 'srv-bots', kind: 'box', x: 620, y: 262, w: 140, h: 82, label: 'Production bots', sub: 'always on', info: 'The production bots run on the servers too, under the same dotfiles and monitoring.' },
      { id: 'brain', kind: 'store', x: 300, y: 24, w: 200, h: 62, label: 'Shared brain', sub: 'one memory, over MCP', info: 'One memory that Claude Code, Codex, ChatGPT and the bots read and write from any machine.' },
      { id: 'langfuse', kind: 'store', x: 600, y: 24, w: 180, h: 62, label: 'Langfuse', sub: 'every session, a trace', info: 'Every session’s transcript lands in Langfuse as a trace, with its cost, beside the production AI traces.' },
      { id: 'truth', kind: 'store', x: 290, y: 398, w: 220, h: 58, label: 'Truth file', sub: 'append-only, synced everywhere', info: 'Drover’s truth file records features, notes, messages and launches; dotsync carries it to every machine.' },
    ],
    flows: [
      { id: 'f-phone', from: 'phone', to: 'mac-tmux', bend: -20, label: 'SSH' },
      { id: 'f-tail', from: 'mac-drover', to: 'srv-drover', bend: 0, label: 'SSH over Tailscale' },
      { id: 'f-brain-m', from: 'mac-agents', to: 'brain', bend: 20 },
      { id: 'f-brain-s', from: 'srv-agents', to: 'brain', bend: -20 },
      { id: 'f-trace', from: 'srv-agents', to: 'langfuse', bend: 10 },
      { id: 'f-truth-m', from: 'mac-drover', to: 'truth', bend: 20 },
      { id: 'f-truth-s', from: 'srv-drover', to: 'truth', bend: -30 },
    ],
    steps: [
      { title: 'The desk', text: 'Cole works at the Mac mini, in Ghostty and tmux. Coordinator sessions live here, one tmux window each.', on: ['mac', 'mac-tmux', 'mac-agents'] },
      { title: 'The phone', text: 'From the phone, Termius opens the same tmux sessions over SSH, and the Drover app shows who is waiting.', on: ['phone', 'mac-tmux'], flows: ['f-phone'] },
      { title: 'The servers', text: 'Long sessions, heavy tests and the production bots run on AWS servers, so they keep going when the laptop closes.', on: ['srv', 'srv-agents', 'srv-bots'] },
      { title: 'The control plane', text: 'A Drover daemon on every machine knows every session on every host; they talk over SSH on the tailnet.', on: ['mac-drover', 'srv-drover', 'truth'], flows: ['f-tail', 'f-truth-m', 'f-truth-s'] },
      { title: 'One memory', text: 'Every agent, on every machine, reads and writes the same shared brain over MCP.', on: ['brain', 'mac-agents', 'srv-agents'], flows: ['f-brain-m', 'f-brain-s'] },
      { title: 'Every trace', text: 'Every session ends up in Langfuse as a trace with its cost, next to the production AI traces.', on: ['langfuse', 'srv-agents'], flows: ['f-trace'] },
    ],
  },
  {
    id: 'hooks',
    name: 'Hooks',
    motto: 'de vita sessionis',
    emblem: { name: 'clepsydra', x: 62, y: 318, size: 76, label: 'clepsydra' },
    intro: 'A session’s life runs clockwise from the top. Each mark is a moment Claude Code runs Cole’s hooks; pick one to see what runs and where it writes.',
    nodes: [
      { id: 'core', kind: 'box', x: 330, y: 205, w: 140, h: 66, label: 'A session', sub: 'Claude Code, start to end', info: 'Claude Code (and Codex, which runs the same hooks) calls out at each of these moments.' },
      ev('e-start', 0, 'SessionStart', 'When a session starts, and again after /compact or /clear.'),
      ev('e-prompt', 36, 'UserPromptSubmit', 'Every prompt, before the model sees it.'),
      ev('e-pretool', 72, 'PreToolUse', 'Before a tool runs.'),
      ev('e-posttool', 104, 'PostToolUse', 'After a tool ran.'),
      ev('e-batch', 136, 'PostToolBatch', 'Before every model call that follows a batch of tool calls.'),
      ev('e-notify', 166, 'Notification', 'A permission prompt, an idle prompt, a question for a human.'),
      ev('e-sub', 196, 'SubagentStart', 'When the session starts a subagent.'),
      ev('e-stop', 228, 'Stop', 'When a turn ends.'),
      ev('e-fail', 252, 'StopFailure', 'When a turn died on an API error after Claude Code’s own retries gave up.'),
      ev('e-compact', 296, 'PreCompact', 'Just before the conversation is compacted.'),
      ev('e-end', 330, 'SessionEnd', 'When the session ends.'),
      { id: 's-memory', kind: 'store', x: 14, y: 200, w: 168, h: 62, label: 'Reflection store', sub: 'open items · learnings', info: 'Per repository: learnings, decisions and open action items, closed when done, shown to the next session.' },
      { id: 's-langfuse', kind: 'store', x: 14, y: 26, w: 168, h: 60, label: 'Langfuse', sub: 'one trace per session', info: 'The finished transcript, sent as one trace, with its cost.' },
      { id: 's-spool', kind: 'store', x: 618, y: 26, w: 168, h: 60, label: 'Prompt spool', sub: 'the exact words, by id', info: 'Every prompt as typed, with where it came from, joined later to its record id.' },
      { id: 's-tmux', kind: 'box', x: 636, y: 206, w: 150, h: 58, label: 'tmux window', sub: 'name · cwd', info: 'The window takes the session’s /rename title; a cd into another checkout is recorded for the status line.' },
      { id: 's-drover', kind: 'store', x: 618, y: 388, w: 168, h: 60, label: 'Drover', sub: 'board · phone · watch', info: 'Sessions that need a human move to “waiting on you”, with their question, and the phone buzzes.' },
      { id: 's-sub', kind: 'box', x: 14, y: 390, w: 168, h: 58, label: 'Subagents', sub: 'one shared contract', info: 'Every subagent gets the same paragraph of rules: finish the job, report concretely, say what was read and what was run.' },
    ],
    flows: [
      { id: 'h-load', from: 's-memory', to: 'e-start', bend: -50, label: 'memory, open items' },
      { id: 'h-brief', from: 's-drover', to: 'e-start', bend: 120, label: 'who is waiting', ldy: 9 },
      { id: 'h-spool', from: 'e-prompt', to: 's-spool', bend: -10, label: 'capture' },
      { id: 'h-name', from: 'e-prompt', to: 's-tmux', bend: 20, label: 'window name', ldx: 30, ldy: -16 },
      { id: 'h-advise', from: 'e-prompt', to: 's-memory', bend: 70, label: 'staged reflections', ldy: 18 },
      { id: 'h-record', from: 'e-pretool', to: 's-memory', bend: 60, label: 'handoff recorded', ldx: 9, ldy: 3 },
      { id: 'h-cwd', from: 'e-posttool', to: 's-tmux', bend: -10, label: 'cwd' },
      { id: 'h-batch', from: 'e-batch', to: 's-memory', bend: -60, label: 'reflections at 20, 40, 60, 80%', ldx: 27, ldy: -3 },
      { id: 'h-notify', from: 'e-notify', to: 's-drover', bend: 10, label: 'waiting, with its question', ldy: 27 },
      { id: 'h-sub', from: 'e-sub', to: 's-sub', bend: -10, label: 'the contract', ldy: -15 },
      { id: 'h-stop', from: 'e-stop', to: 's-tmux', bend: -80, label: 'name, timestamp', ldx: 36, ldy: 6 },
      { id: 'h-fail', from: 'e-fail', to: 'e-fail' },
      { id: 'h-compact', from: 'e-compact', to: 's-memory', bend: 10, label: 'reflect first', ldx: 3, ldy: 9 },
      { id: 'h-end-mem', from: 'e-end', to: 's-memory', bend: 30, label: 'last reflection', ldx: -9, ldy: 3 },
      { id: 'h-end-trace', from: 'e-end', to: 's-langfuse', bend: -10, label: 'one trace', ldy: -9 },
    ],
    decor: dial(),
    mottoAt: { x: 400, y: 462, anchor: 'middle' },
    hooks: {
      'e-start': [
        { name: 'load memory', does: 'Prints the repo’s session handoff, lists its memory files and shows the open items from the reflection store.' },
        { name: 'branch reopen', does: 'After /branch, reopens the original conversation in a new tmux window.' },
        { name: 'Drover brief', does: 'A few lines from the local daemon: who is waiting on Cole, who is working, which hosts are unreachable.' },
      ],
      'e-prompt': [
        { name: 'window name', does: 'Renames the tmux window to the session’s /rename title.' },
        { name: 'context advisor', does: 'Watches the context window; starts background reflections and suggests a fresh session at the right moment.' },
        { name: 'request capture', does: 'Spools the prompt, with where it came from, so its exact words can be quoted later by id.' },
        { name: 'issue focus', does: 'Remembers which issue the session is about, for the status line’s link.' },
      ],
      'e-pretool': [
        { name: 'merge gate (Bash)', does: 'Blocks gh pr merge while reviewer findings on the head commit are unanswered.' },
        { name: 'handoff record (Skill)', does: 'When a handoff runs, records it as an open item.' },
      ],
      'e-posttool': [{ name: 'track cwd (Bash)', does: 'Records a cd into another checkout, so the status line shows where work really happens.' }],
      'e-batch': [{ name: 'context advisor', does: 'Reads the exact token count from a sensor file; past 20, 40, 60 and 80% of the window it starts staged background reflections.' }],
      'e-notify': [{ name: 'event log, Drover notify', does: 'Logs the prompt and tells Drover the session is waiting, with its actual question.' }],
      'e-sub': [{ name: 'leaf-worker contract', does: 'Hands every subagent the same rules, as one injected paragraph.' }],
      'e-stop': [
        { name: 'name and timestamp', does: 'Keeps the window name current and prints when the turn ended.' },
        { name: 'nudge', does: 'Asks a small judge model whether the agent stopped early with work in hand; if so, one line nudges it on.' },
      ],
      'e-fail': [{ name: 'API error recovery', does: 'An asyncRewake hook: waits with backoff, then wakes the session to retry a turn that died on a transient error.' }],
      'e-compact': [{ name: 'reflector', does: 'Reflects the transcript into the reflection store before compaction, in about 50 ms, the work done in the background.' }],
      'e-end': [
        { name: 'reflector', does: 'A last reflection into the reflection store.' },
        { name: 'Langfuse', does: 'The finished transcript sent to Langfuse as one trace.' },
      ],
    },
    steps: [
      { title: 'It starts', text: 'SessionStart loads the repo’s handoff, memory and open items, and a brief from Drover: the session begins oriented.', on: ['e-start', 's-memory', 's-drover'], flows: ['h-load', 'h-brief'] },
      { title: 'Cole types', text: 'Every prompt is captured word for word, the window is renamed, and the context advisor checks the window’s fill.', on: ['e-prompt', 's-spool', 's-tmux'], flows: ['h-spool', 'h-name'] },
      { title: 'It works', text: 'Around tool calls: a merge gate, a handoff record, the working directory tracked, and staged reflections as the context fills.', on: ['e-pretool', 'e-posttool', 'e-batch', 's-memory', 's-tmux'], flows: ['h-record', 'h-cwd', 'h-batch'] },
      { title: 'It needs Cole', text: 'A permission or idle prompt goes to Drover, so the board, the phone and the watch show who is waiting and why.', on: ['e-notify', 's-drover'], flows: ['h-notify'] },
      { title: 'It delegates', text: 'Every subagent gets the same short contract: finish, report concretely, say what was read and what was run.', on: ['e-sub', 's-sub'], flows: ['h-sub'] },
      { title: 'The turn ends', text: 'Stop keeps the name and time current and may nudge an agent that quit early; StopFailure retries a turn lost to an API error.', on: ['e-stop', 'e-fail', 's-tmux'], flows: ['h-stop', 'h-fail'] },
      { title: 'Before compaction', text: 'PreCompact reflects the transcript into the reflection store first, so nothing important depends on the summary.', on: ['e-compact', 's-memory'], flows: ['h-compact'] },
      { title: 'It ends', text: 'SessionEnd files a last reflection and sends the transcript to Langfuse as one trace.', on: ['e-end', 's-memory', 's-langfuse'], flows: ['h-end-mem', 'h-end-trace'] },
    ],
  },
  {
    id: 'messaging',
    name: 'Messages',
    motto: 'de nuntiis',
    emblem: { name: 'epistola', x: 400, y: 58, size: 76, label: 'epistola' },
    intro: 'A message’s path from one agent to another: on one machine straight into the other session’s inbox, across machines through Drover, and into the truth file on the way.',
    nodes: [
      { id: 'm', kind: 'frame', x: 20, y: 40, w: 320, h: 320, label: 'Mac mini' },
      { id: 'm-send', kind: 'box', x: 42, y: 84, w: 276, h: 64, label: 'Coordinator session', sub: 'Claude Code in tmux', info: 'The sender. It finds targets with ListAgents and sends with SendMessage, or calls drover_send for another machine.' },
      { id: 'm-near', kind: 'box', x: 42, y: 180, w: 276, h: 58, label: 'Another session, same machine', sub: 'its own inbox socket', info: 'Each session binds an inbox socket only your user can open. Same-machine messages never leave the machine.' },
      { id: 'm-drover', kind: 'box', x: 42, y: 272, w: 276, h: 58, label: 'Drover daemon', sub: 'drover_send', info: 'Drover carries messages across machines, to Codex and to bots, and records every one.' },
      { id: 's', kind: 'frame', x: 460, y: 40, w: 320, h: 320, label: 'AWS server' },
      { id: 's-drover', kind: 'box', x: 482, y: 272, w: 276, h: 58, label: 'Drover daemon', sub: 'on the server', info: 'The remote daemon receives over SSH on the tailnet and delivers locally.' },
      { id: 's-worker', kind: 'box', x: 482, y: 84, w: 276, h: 64, label: 'Worker session', sub: 'its inbox socket', info: 'A busy session reads a message between tool calls, so a running command is never interrupted; an idle one starts a new turn.' },
      { id: 's-next', kind: 'box', x: 482, y: 180, w: 196, h: 58, label: 'Its successor', sub: 'after a handoff', dashed: true, info: 'If the worker handed off and its session is gone, the message goes to the newest live generation of its chain.' },
      { id: 'truth', kind: 'store', x: 290, y: 392, w: 220, h: 58, label: 'Truth file', sub: 'every message, sender and id', info: 'Each message is appended with who sent it; dotsync carries the file to every machine.' },
    ],
    flows: [
      { id: 'g-near', from: 'm-send', to: 'm-near', bend: 0, label: 'SendMessage', ldy: 6 },
      { id: 'g-ask', from: 'm-send', to: 'm-drover', bend: -110, label: 'drover_send', ldy: -30 },
      { id: 'g-ssh', from: 'm-drover', to: 's-drover', bend: 0, label: 'SSH over Tailscale' },
      { id: 'g-deliver', from: 's-drover', to: 's-worker', bend: 150 },
      { id: 'g-follow', from: 's-drover', to: 's-next', bend: 0, label: 'gone? follow the chain', dashed: true, ldy: 6 },
      { id: 'g-record', from: 'm-drover', to: 'truth', bend: 20, label: 'recorded' },
    ],
    steps: [
      { title: 'Same machine', text: 'A session finds another with ListAgents and sends with SendMessage: straight into the target’s inbox socket, never off the machine.', on: ['m-send', 'm-near'], flows: ['g-near'] },
      { title: 'Another machine', text: 'For a session elsewhere, the agent calls drover_send and the local Drover daemon takes it.', on: ['m-send', 'm-drover'], flows: ['g-ask'] },
      { title: 'Across the tailnet', text: 'The daemon reaches the server’s daemon over SSH on the Tailscale network: no open ports.', on: ['m-drover', 's-drover'], flows: ['g-ssh'] },
      { title: 'Delivered', text: 'The server’s daemon puts it in the worker’s inbox, where it arrives like typed input, read between tool calls.', on: ['s-drover', 's-worker'], flows: ['g-deliver'] },
      { title: 'Recorded', text: 'Every message lands in the truth file with its sender, and dotsync carries the file to every machine.', on: ['m-drover', 'truth'], flows: ['g-record'] },
      { title: 'Followed', text: 'If the worker handed off and is gone, Drover follows its handoff chain to the newest live generation.', on: ['s-drover', 's-next'], flows: ['g-follow'] },
      { title: 'Information, never permission', text: 'A message can never approve anything or run a slash command. A session that needs a yes asks Cole.', on: ['m-send', 's-worker', 'm-near'] },
    ],
  },
  {
    id: 'handoff',
    name: 'Handoff',
    motto: 'de successione',
    emblem: { name: 'fax', x: 412, y: 60, size: 80, label: 'fax' },
    intro: 'One handoff: the passer writes its brief, the successor’s window opens beside it, the history is echoed into the new window, the successor replies, and the passer’s window closes once nothing holds it open.',
    nodes: [
      { id: 'tab-1', kind: 'tab', x: 40, y: 28, w: 140, h: 30, label: '3:worker ⤳', info: 'The passer’s window, flagged with the handoff badge while its successor starts.' },
      { id: 'tab-2', kind: 'tab', x: 186, y: 28, w: 160, h: 30, label: '4:worker (gen 2)', dashed: true, info: 'The successor’s window opens right after the passer’s.' },
      { id: 'pass', kind: 'box', x: 30, y: 100, w: 230, h: 150, label: 'Generation 1', sub: 'the passer, near its budget', info: 'The context advisor saw it at 85% of its advisory budget, at a natural stopping point, and told it to hand off.' },
      { id: 'brief', kind: 'store', x: 300, y: 132, w: 200, h: 86, label: 'The brief', sub: 'ids, paths, jobs, the exact asks', info: 'cc-handoff init fills every live fact (ids, paths, git state, background jobs, the first prompt); the agent writes the rest. launch refuses a brief with a placeholder left.' },
      { id: 'next', kind: 'box', x: 540, y: 100, w: 230, h: 150, label: 'Generation 2', sub: 'the successor, fresh context', dashed: true, info: 'A fresh session id and a short inline prompt; it reads the brief and continues the open work.' },
      { id: 'hist', kind: 'box', x: 300, y: 284, w: 200, h: 70, label: 'History echoed', sub: 'briefs 1..n-1, the transcript', info: 'The new window prints the chain’s history and the passer’s rendered transcript, and copies the transcript to the clipboard.' },
      { id: 'watch', kind: 'box', x: 30, y: 292, w: 230, h: 62, label: 'The watcher', sub: 'a child of the tmux server', info: 'It outlives the passer’s window and closes it once the successor has replied and adopted any background jobs.' },
      { id: 'chain', kind: 'store', x: 540, y: 292, w: 230, h: 62, label: 'The chain', sub: 'every brief and transcript', info: 'Any later generation can hand off again, on this machine or another. Messages to an old name reach the newest live one.' },
    ],
    flows: [
      { id: 'k-fill', from: 'pass', to: 'brief', bend: -20, label: 'init, fill', ldx: 6, ldy: -27 },
      { id: 'k-launch', from: 'brief', to: 'next', bend: -20, label: 'launch', ldx: -6, ldy: -27 },
      { id: 'k-tab', from: 'tab-1', to: 'tab-2', bend: -12 },
      { id: 'k-echo', from: 'hist', to: 'next', bend: 20, label: 'echoed in', ldy: 6 },
      { id: 'k-reply', from: 'next', to: 'pass', bend: 70, label: 'first reply', dashed: true },
      { id: 'k-close', from: 'watch', to: 'pass', bend: -30, label: 'closes it', ldy: 12 },
      { id: 'k-keep', from: 'next', to: 'chain', bend: 20, label: 'kept', ldy: 12 },
    ],
    steps: [
      { title: 'Time to pass it on', text: 'At 70% and 85% of its advisory budget the context advisor asks a judge whether this is a natural stopping point; at one, the session hands off without being asked.', on: ['pass'] },
      { title: 'The brief', text: 'cc-handoff init writes the brief’s skeleton with every live fact filled in; the agent writes what only it knows.', on: ['pass', 'brief'], flows: ['k-fill'] },
      { title: 'A window beside it', text: 'launch gives the successor a fresh session id and opens its tmux window right after the passer’s.', on: ['brief', 'next', 'tab-1', 'tab-2'], flows: ['k-launch', 'k-tab'] },
      { title: 'The history, echoed', text: 'The new window prints the chain’s history and the passer’s transcript, then starts Claude Code with its prompt as an argument; nothing is typed into the pane.', on: ['hist', 'next'], flows: ['k-echo'] },
      { title: 'Reply, then close', text: 'The successor replies; the watcher closes the passer’s window once nothing holds it open.', on: ['next', 'watch', 'pass'], flows: ['k-reply', 'k-close'] },
      { title: 'The chain goes on', text: 'Every generation’s brief and transcript are kept; any later one can hand off again, here or on another machine.', on: ['chain', 'next'], flows: ['k-keep'] },
    ],
  },
  {
    id: 'parking',
    name: 'Parking',
    motto: 'de quiete',
    emblem: { name: 'luna', x: 96, y: 356, size: 112, label: 'luna' },
    intro: 'Two outcomes for an idle session: parked in place with its last screen and resume command, or, when it had finished, parked with its window closed and the way back kept in the ledger.',
    nodes: [
      { id: 'idle', kind: 'box', x: 24, y: 150, w: 220, h: 120, label: 'A session idle 6 h', sub: 'still holding its memory', info: 'Claude Code (about 300 MB), its MCP servers (about 260 MB) and any language server it started (up to gigabytes) stay resident until the session exits.' },
      { id: 'park', kind: 'box', x: 300, y: 178, w: 170, h: 64, label: 'cc-park', sub: 'every 30 min, on the Mac', info: 'A scheduled job runs it for anything idle six hours or more, skipping kept panes and the pane you are looking at.' },
      { id: 'kept', kind: 'box', x: 540, y: 40, w: 236, h: 150, label: 'Parked in place', sub: 'last screen, resume command typed', info: 'It captures the conversation, sends /exit, and writes the last screen back with the exact resume command typed (not run) at the prompt.' },
      { id: 'enter', kind: 'tab', x: 600, y: 210, w: 116, h: 30, label: 'Enter ⏎', info: 'One key brings the conversation back, in the same window, under the same name.' },
      { id: 'closed', kind: 'box', x: 540, y: 262, w: 236, h: 86, label: 'Finished: window closed', sub: 'nothing left to ask', info: 'When the last reply asks nothing and Drover agrees, the window closes instead of waiting.' },
      { id: 'ledger', kind: 'store', x: 300, y: 372, w: 220, h: 62, label: 'cc-park status', sub: 'the way back, kept', info: 'Every parked and closed session with its resume command, and which were resumed.' },
    ],
    flows: [
      { id: 'p-find', from: 'idle', to: 'park', bend: 0, label: 'idle 6 h+', ldx: 3 },
      { id: 'p-keep', from: 'park', to: 'kept', bend: -20, label: 'may be needed', ldx: -3 },
      { id: 'p-close', from: 'park', to: 'closed', bend: 20, label: 'finished' },
      { id: 'p-enter', from: 'enter', to: 'kept', bend: -40, label: 'resume', ldx: -42, ldy: 27 },
      { id: 'p-ledger', from: 'closed', to: 'ledger', bend: 20, label: 'resume command', ldx: -21 },
    ],
    steps: [
      { title: 'Idle is not free', text: 'An idle session keeps Claude Code, its MCP servers and any language server in memory; dozens of them held tens of gigabytes.', on: ['idle'] },
      { title: 'The sweep', text: 'Every 30 minutes on the Mac, cc-park finds sessions idle six hours or more.', on: ['idle', 'park'], flows: ['p-find'] },
      { title: 'Parked in place', text: 'It captures the screen, sends /exit, and writes the last screen back with the resume command waiting at the prompt.', on: ['park', 'kept'], flows: ['p-keep'] },
      { title: 'One key back', text: 'Press Enter and the conversation returns in the same window, with the same name.', on: ['enter', 'kept'], flows: ['p-enter'] },
      { title: 'Or closed', text: 'A session that had finished gets its window closed, and its resume command goes to cc-park status.', on: ['park', 'closed', 'ledger'], flows: ['p-close', 'p-ledger'] },
    ],
  },
  {
    id: 'brain',
    name: 'The brain',
    motto: 'de memoria communi',
    emblem: { name: 'nodus', x: 96, y: 212, size: 108, label: 'nodus' },
    intro: 'Memory at three levels: each machine’s sessions keep notes per repository; dotsync carries the reflection store and curated memory between machines; and the brain is the one place every agent, everywhere, sees the same facts.',
    nodes: [
      { id: 'b-core', kind: 'store', x: 250, y: 30, w: 300, h: 96, label: 'The shared brain', sub: 'hybrid search · facts that keep their history', info: 'Every entry stored as written, labeled with who wrote it, when it became true, and how far to trust it. Open source as badland-brain.' },
      { id: 'b-ctx', kind: 'tab', x: 40, y: 50, w: 170, h: 30, label: 'brain_context', info: 'Once at session start: the standing facts and the latest decisions.' },
      { id: 'b-search', kind: 'tab', x: 40, y: 96, w: 170, h: 30, label: 'brain_search', info: 'Before asserting a fact about Cole’s systems.' },
      { id: 'b-note', kind: 'tab', x: 590, y: 50, w: 170, h: 30, label: 'brain_note', info: 'At a handoff, and for anything Cole would be disappointed to lose.' },
      { id: 'b-super', kind: 'tab', x: 590, y: 96, w: 170, h: 30, label: 'brain_supersede', info: 'When a saved fact changed: a new version, not a second note.' },
      { id: 'b-sync', kind: 'box', x: 222, y: 356, w: 168, h: 62, label: 'dotsync', sub: 'through git', info: 'Carries the reflection store and curated memory between the Mac mini and the servers. Each machine appends to its own log files, so the sync never has to merge one.' },
      { id: 'b-mac', kind: 'box', x: 20, y: 344, w: 186, h: 86, label: 'Mac mini', sub: 'notes per repo', info: 'Claude Code’s own memory is per repository and per machine.' },
      { id: 'b-srv', kind: 'box', x: 406, y: 344, w: 186, h: 86, label: 'AWS servers', sub: 'notes per repo', info: 'The same, on every server.' },
      { id: 'b-chat', kind: 'box', x: 612, y: 220, w: 172, h: 120, label: 'ChatGPT, bots', sub: 'no memory of their own', info: 'Reached only through the brain, so they read the same facts as the coding agents.' },
    ],
    flows: [
      { id: 'b-m', from: 'b-mac', to: 'b-core', bend: 30, label: 'MCP' },
      { id: 'b-s', from: 'b-srv', to: 'b-core', bend: -30, label: 'MCP' },
      { id: 'b-c', from: 'b-chat', to: 'b-core', bend: -20, label: 'MCP' },
      { id: 'b-ms', from: 'b-mac', to: 'b-sync', bend: 0 },
      { id: 'b-ss', from: 'b-srv', to: 'b-sync', bend: 0 },
      { id: 'b-import', from: 'b-sync', to: 'b-core', bend: 0, label: 'daily import', dashed: true },
    ],
    steps: [
      { title: 'Per machine', text: 'Each machine’s sessions keep notes per repository: Claude Code’s own memory and the reflection store.', on: ['b-mac', 'b-srv'] },
      { title: 'Between machines', text: 'dotsync carries the reflection store and curated memory between the Mac mini and the servers through git.', on: ['b-sync', 'b-mac', 'b-srv'], flows: ['b-ms', 'b-ss'] },
      { title: 'Above them all', text: 'Every Claude Code and Codex is registered with the brain over MCP: a note saved on a server is searchable on the Mac at once.', on: ['b-core', 'b-mac', 'b-srv'], flows: ['b-m', 'b-s'] },
      { title: 'The rules', text: 'brain_context at start, brain_search before asserting, brain_note at a handoff, brain_supersede when a fact changes. Never secrets; what comes back is data, not instructions.', on: ['b-ctx', 'b-search', 'b-note', 'b-super', 'b-core'] },
      { title: 'The daily import', text: 'A scheduled job imports the fleet’s file memory into the brain, idempotently: unchanged files skipped, changed ones superseding their old version.', on: ['b-sync', 'b-core'], flows: ['b-import'] },
      { title: 'The same facts everywhere', text: 'ChatGPT and the bots have no memory of their own here; through the brain they see what the coding agents know.', on: ['b-chat', 'b-core'], flows: ['b-c'] },
    ],
  },
];
