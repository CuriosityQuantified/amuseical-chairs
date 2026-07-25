// Moderation for player-authored text that reaches a projected host screen.
// There is no undo on a room full of people reading something, so every
// player string is normalized here BEFORE it is pooled — on the server, which
// is authoritative. The client imports the same module only to show an honest
// live character counter.
//
// What this stops: newlines and tabs that would blow up a projected layout,
// control and format characters (including the bidi overrides that let text
// render in an order it wasn't typed in), zero-width padding, Zalgo mark
// stacks that overflow their line, and unbounded length.

// Captions are read aloud off a projector by a room of 20 — long enough for a
// joke, short enough to scan.
export const ENTRY_MAX_CHARS = 80;

// Newline-ish separators become spaces (so words don't fuse) before the rest
// of the control/format classes are dropped outright.
const LINE_BREAKS = /[\r\n\t\v\f\u0085\u2028\u2029]/g;
// Cc/Cf/Co/Cs only — NOT Cn: an emoji still unassigned in an older Node's
// Unicode tables is a perfectly good caption on the player's phone.
const CONTROL = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu;
// A base character plus two combining marks is a legitimate accent; a stack of
// twenty is a projector-wrecker.
const MARK_STACK = /(\p{M}\p{M})\p{M}+/gu;

// Normalize one player-authored string for pooling. Always returns a string —
// '' means "nothing usable was submitted".
export function cleanEntryText(raw, maxChars = ENTRY_MAX_CHARS) {
  let t = String(raw ?? '')
    .replace(LINE_BREAKS, ' ')
    .replace(CONTROL, '')
    .replace(MARK_STACK, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  // Slice by code point, never by UTF-16 unit — a raw slice can cut an emoji
  // in half and leave a lone surrogate on the projector.
  const cp = [...t];
  if (cp.length > maxChars) t = cp.slice(0, maxChars).join('').trim();
  return t;
}

// True when a cleaned string is worth pooling at all.
export function isUsableEntry(text) {
  return typeof text === 'string' && text.length > 0;
}
