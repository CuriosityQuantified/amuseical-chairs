// Moderation for player-authored text. Everything here is what stands between
// an untrusted string and a projector in a work meeting.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanEntryText, isUsableEntry, ENTRY_MAX_CHARS } from '../shared/textclean.js';

test('collapses whitespace and trims', () => {
  assert.equal(cleanEntryText('  hello   there  '), 'hello there');
});

test('newlines and tabs become spaces, never fused words', () => {
  assert.equal(cleanEntryText('one\ntwo\tthree\r\nfour'), 'one two three four');
  assert.equal(cleanEntryText('a b cd'), 'a b c d');
});

test('strips control and format characters, including bidi overrides', () => {
  // A right-to-left override renders text in an order it was not typed in —
  // on a projector that is a spoofing tool, not a formatting choice.
  assert.equal(cleanEntryText('safe‮txet‬'), 'safetxet');
  assert.equal(cleanEntryText('zero​width‍join'), 'zerowidthjoin');
  assert.equal(cleanEntryText('bellchar'), 'bellchar');
});

test('caps a Zalgo mark stack without eating real accents', () => {
  assert.equal(cleanEntryText('café résumé'), 'café résumé');
  const zalgo = 'h' + '́'.repeat(40) + 'i';
  assert.equal(cleanEntryText(zalgo), 'h́́i');
});

test('caps length by code point and never splits an emoji', () => {
  const long = 'x'.repeat(ENTRY_MAX_CHARS + 40);
  assert.equal([...cleanEntryText(long)].length, ENTRY_MAX_CHARS);
  const emoji = '🎵'.repeat(ENTRY_MAX_CHARS + 5);
  const cut = cleanEntryText(emoji);
  assert.equal([...cut].length, ENTRY_MAX_CHARS);
  assert.ok(!/[\uD800-\uDFFF]/.test(cut.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')),
    'no lone surrogate survives the cut');
});

test('honours a caller-supplied shorter cap', () => {
  assert.equal(cleanEntryText('abcdefghij', 4), 'abcd');
});

test('junk in, empty string out — never null, never a throw', () => {
  for (const junk of [undefined, null, '', '   ', '\n\n', {}, [], 42, true]) {
    const out = cleanEntryText(junk);
    assert.equal(typeof out, 'string', `${JSON.stringify(junk)} still yields a string`);
  }
  assert.equal(cleanEntryText('​​'), '');
  assert.equal(isUsableEntry(cleanEntryText('   ')), false);
  assert.equal(isUsableEntry(cleanEntryText('ok')), true);
});
