# Color-cue audit — issue #53 (colorblind support)

Accessibility audit of every roster game (plus the core musical-chairs scene)
for **color dependence**. Each surface is classified as one of:

- **Mechanic** — perceiving/matching color *is* the task. Not made hue-free
  (either impossible without destroying the game, or already hue-independent
  because it turns on *lightness*, which colorblind players perceive).
- **Incidental** — color is only a labeling choice. Needs a redundant
  non-color cue (shape, texture, number, or label) so the game is playable
  without hue discrimination.
- **Decorative** — a single neon-theme accent per element; color never
  distinguishes options the player must tell apart. No cue required.

No scoring or seed logic is touched by this issue. Cues are additive client
render changes, asserted in `test/color-cues.test.js`.

## Classification

| Game (key) | Category | Color use | Class | Redundant cue |
|---|---|---|---|---|
| RGB Color Match (`rgb`) | perceptual | Match a target color via CIEDE2000 | **Mechanic** | **Excluded** (non-goal): the game *is* hue matching (`shared/ciede2000.js`). |
| Odd One Out (`oddoneout`) | perceptual | Odd tile is a lighter **shade** of the shared hue (`hsl(H 65% L%)`, same hue+sat, odd tile brighter — `public/js/games.js` L194–202) | **Mechanic** | None needed: the discriminated step is **lightness**, which colorblindness does not affect. Already hue-independent. |
| Grid Flash (`gridflash`) | memory | Lit vs unlit cells (brightness) | **Mechanic** | None needed: brightness, not hue. |
| Vanishing Tray (`tray`) | memory | Glyph identity | **Decorative** | Glyphs are shapes, not colors. |
| Stroop Rush (`stroop`) | attention | Pick the **ink color** of a word | **Incidental** | **Already present + load-bearing:** every answer button carries the color **NAME** text and `assertLabelParity` guarantees unique names+hexes (`shared/stroop.js`). Preserved; asserted. |
| Proportion Sense (`area`) | perceptual | BIG shape cyan, SMALL shape pink | **Incidental** | **Already present:** each shape is labeled with `BIG`/`SMALL` text and fixed left/right position (`public/js/games.js` L307). Asserted. |
| Trace the Shape (`trace`) | perceptual | Target outline pink (8px), player trace green (3px) — a red/green confusion pair | **Incidental** | **Added:** the player's trace is drawn with a **dashed** line (texture cue) and a text legend names each line, so target vs trace is distinguishable without hue. Width difference alone was too weak. |
| Follow the Cup (`cups`) | attention | Cup edge tint | **Decorative** | Cups already carry **numbers** + fixed home positions (`public/js/games.js` "Numbered slots: the verdict names a cup"). |
| Musical Chairs avatars (`chairs.js`) | core scene | Per-player avatar hue (`colorFor`) | **Incidental** | **Already present:** each avatar shows the player's **initial** + name label (`drawAvatar`, `public/js/chairs.js` L44). |
| bisect, dots, stopclock, metronome, slingshot, balance, spacemash, typing, anagram, wordhunt, fractions, readroom, caption, icebreaker | various | Single neon accent per element | **Decorative** | Color never distinguishes choosable options; no cue required. |

## Change set (bounded)

1. **`trace`** — add a dashed-line texture cue to the player's own trace plus a
   short text legend distinguishing "outline to follow" from "your trace".
   Render-only; no effect on the deviation/coverage metric or the seed.
2. **`area`** — no render change; its existing `BIG`/`SMALL` text labels are the
   redundant cue and are now asserted.
3. **`stroop`** — unchanged; existing label parity preserved and cross-asserted.
4. **`test/color-cues.test.js`** — a named issue-#53 regression suite that
   scans the client source for each incidental game's redundant cue and asserts
   that no seed/scoring behavior changed.

## Non-goals honored

- **RGB Color Match** stays excluded — hue matching is the game.
- No full high-contrast theme.
- No scoring changes, no seed changes.
