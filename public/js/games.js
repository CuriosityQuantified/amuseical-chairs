// Client-side minigame implementations. Contract:
//   GameClients[key].start(root, ctx) -> { collect?, update? }
// ctx: { data, duration, deadline, submit(payload), rng, stage, totalStages }
//   - data: server-built round data (identical for every player, seeded)
//   - submit: call once with the payload; the shell locks the UI after
//   - collect: shell calls it at the deadline to auto-submit partial progress
//   - update: shell calls it when the server revises the round data mid-stage
//     (host moderation pulling a pooled entry); optional
//
// Multi-stage games instead expose:
//   GameClients[key].startStage(stage, root, ctx) -> same handle
// Every stage is played by every player at once; `collect` semantics are
// per-stage. `intro` may be a function of the stage number. How many stages
// there are may depend on what the room submitted to stage one (Icebreaker
// runs one guessing stage per fun fact), so a client must never assume.
//
// All randomness in game content comes from the server data or the seeded
// rng — Math.random() only ever drives decoration, never scoring or physics.

import { seededRng } from '/shared/rng.js';
import { createPressCounter } from '/shared/presscounter.js';
import { cleanEntryText } from '/shared/textclean.js';
import { cupsLevel } from '/shared/cups.js';
import { trayLevel, traySwapped } from '/shared/tray.js';
import {
  balanceSchedule,
  balanceStep,
  balanceControl,
  balanceState,
  BALANCE_MAX_ANGLE,
  BALANCE_TARGET_RANGE,
  BALANCE_DT,
} from '/shared/balance.js';
import { FRACTIONS_PENALTY, parseValue } from '/shared/fractions.js';
import {
  bisectFeedback,
  areaFeedback,
  dotsFeedback,
  stopclockFeedback,
  gridflashFeedback,
  fractionsFeedback,
  anagramFeedback,
} from '/shared/feedback.js';

// ---- tiny DOM helpers ------------------------------------------------------

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids) {
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// Vertical space left for a game below `root`'s top edge, so everything fits
// in the viewport without scrolling. `reserve` = room kept for the game's own
// notes/buttons around the play area.
function availHeight(root, reserve = 0) {
  const top = root.getBoundingClientRect().top || 0;
  return Math.max(160, Math.floor(window.innerHeight - top - reserve - 16));
}

function makeCanvas(root, height = 360, reserve = 90) {
  const c = h('canvas', { class: 'game' });
  root.append(c);
  const w = Math.min(root.clientWidth || 680, 680);
  const hgt = Math.min(height, availHeight(root, reserve));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = w * dpr;
  c.height = hgt * dpr;
  // Explicit CSS size (not width:100%) so pointer coordinates always match
  // the logical drawing coordinates.
  c.style.width = `${w}px`;
  c.style.maxWidth = '100%';
  c.style.height = `${hgt}px`;
  c.style.margin = '0 auto';
  const ctx2d = c.getContext('2d');
  ctx2d.scale(dpr, dpr);
  return { canvas: c, ctx: ctx2d, w, hgt };
}

function canvasPos(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Per-turn answer feedback (issue #48). After a turn is committed, show the
// player their own answer, the correct answer, and whether they got it, then
// wait for them to continue before the next turn is drawn. This is player-local
// UI: it runs entirely on this device and blocks nothing on any other player.
//
// `fb` is a record from shared/feedback.js: { your, correct, ok, answered }.
// `onContinue` is called exactly once, when the player taps Next or the
// readable delay elapses — whichever comes first (the `done` guard makes the
// second path a no-op). The next turn must never be drawn before this panel is
// visible, so callers draw the next turn only from inside `onContinue`. A
// deadline auto-collect that clears the game root simply detaches the panel;
// its pending timer then fires harmlessly (remove() on a detached node is a
// no-op and submit() is idempotent).
function turnFeedback(root, fb, onContinue, { progress = '', autoMs = 2200 } = {}) {
  const stateText = fb.ok ? '✓ Correct' : (fb.answered ? '✗ Not quite' : '✗ No answer');
  const panel = h('div', {
    class: `turn-feedback ${fb.ok ? 'fb-ok' : 'fb-bad'}`,
    'data-testid': 'turn-feedback',
    role: 'status',
    'aria-live': 'polite',
  },
    h('div', { class: 'fb-state' }, stateText),
    h('div', { class: 'fb-row' }, h('span', { class: 'fb-label' }, 'Your answer'), h('strong', { class: 'fb-your' }, fb.your)),
    h('div', { class: 'fb-row' }, h('span', { class: 'fb-label' }, 'Correct answer'), h('strong', { class: 'fb-correct' }, fb.correct)),
    progress ? h('div', { class: 'fb-progress muted' }, progress) : document.createTextNode(''),
  );
  const next = h('button', { class: 'big', type: 'button', 'data-testid': 'feedback-next' }, 'Next');
  panel.append(next);
  root.append(panel);
  let done = false;
  let timer = null;
  const go = () => {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    panel.remove();
    onContinue();
  };
  next.addEventListener('click', go);
  timer = setTimeout(go, autoMs);
}

export const GameClients = {};

// ---- 1. RGB Color Match ----------------------------------------------------

GameClients.rgb = {
  intro: 'Mix the sliders to match the target color, then lock it in.',
  start(root, ctx) {
    const t = ctx.data.target;
    const cur = { r: 128, g: 128, b: 128 };
    const target = h('div', { class: 'swatch', style: { background: `rgb(${t.r},${t.g},${t.b})` } });
    const preview = h('div', { class: 'swatch' });
    const sliders = {};
    const paint = () => { preview.style.background = `rgb(${cur.r},${cur.g},${cur.b})`; };
    const sliderRow = (chan, color) => {
      const s = h('input', {
        type: 'range', min: 0, max: 255, value: cur[chan],
        oninput: (e) => { cur[chan] = Number(e.target.value); paint(); },
        style: { accentColor: color },
      });
      sliders[chan] = s;
      return h('div', {}, h('label', { class: 'muted' }, chan.toUpperCase()), s);
    };
    paint();
    root.append(
      h('p', {}, 'Target:'), target,
      h('p', {}, 'Yours:'), preview,
      sliderRow('r', '#ff5470'), sliderRow('g', '#3dff9e'), sliderRow('b', '#00e5ff'),
      h('div', { style: { marginTop: '12px' } },
        h('button', { class: 'big', onclick: () => ctx.submit({ ...cur }) }, 'Lock it in'))
    );
    return { collect: () => ({ ...cur }) };
  },
};

// ---- 2. Odd One Out --------------------------------------------------------

GameClients.oddoneout = {
  intro: 'One tile is a different shade. Tap it. Wrong tap = 1s freeze.',
  start(root, ctx) {
    const rng = seededRng(ctx.data.seed);
    let cleared = 0;
    let level = 0;
    let frozen = false;
    const score = h('div', { class: 'mash-count' }, '0');
    const gridEl = h('div', { class: 'oddgrid' });
    root.append(score, gridEl);
    // Square grid sized to fit the viewport below the score — never scroll.
    const side = Math.min(root.clientWidth || 680, 480, availHeight(root, 100));
    gridEl.style.width = `${side}px`;
    gridEl.style.margin = '0 auto';

    function next() {
      level++;
      const size = Math.min(2 + Math.ceil(level / 2), 8);
      const delta = Math.max(5, Math.round(42 * Math.pow(0.86, level)));
      const hue = Math.floor(rng() * 360);
      const light = 45 + Math.floor(rng() * 20);
      const oddIdx = Math.floor(rng() * size * size);
      gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      gridEl.replaceChildren();
      for (let i = 0; i < size * size; i++) {
        const l = i === oddIdx ? light + delta / 2.5 : light;
        gridEl.append(h('button', {
          class: 'tile',
          style: { background: `hsl(${hue} 65% ${l}%)` },
          onclick: () => {
            if (frozen) return;
            if (i === oddIdx) {
              cleared++;
              score.textContent = String(cleared);
              next();
            } else {
              frozen = true;
              gridEl.style.opacity = '0.3';
              setTimeout(() => { frozen = false; gridEl.style.opacity = '1'; }, 1000);
            }
          },
        }));
      }
    }
    next();
    return { collect: () => ({ cleared }) };
  },
};

// ---- 3. Bisect the Line ----------------------------------------------------

GameClients.bisect = {
  intro: 'Tap the line at exactly the percentage asked. Each tap shows your answer and the target before the next line.',
  start(root, ctx) {
    const targets = ctx.data.targets;
    const guesses = [];
    let reviewing = false;
    const prompt = h('h2', { class: 'center' });
    const note = h('p', { class: 'trial-note center' });
    const { canvas, ctx: g, w } = makeCanvas(root, 140);
    root.prepend(prompt);
    root.append(note);
    const pad = 24;

    function draw() {
      g.clearRect(0, 0, w, 140);
      g.shadowColor = '#00e5ff';
      g.shadowBlur = 12;
      g.strokeStyle = '#00e5ff';
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(pad, 70); g.lineTo(w - pad, 70); g.stroke();
      for (const x of [pad, w - pad]) {
        g.beginPath(); g.moveTo(x, 50); g.lineTo(x, 90); g.stroke();
      }
      g.shadowBlur = 0;
      g.fillStyle = '#3d5a6b';
      g.font = '14px system-ui';
      g.fillText('0%', pad - 8, 110);
      g.fillText('100%', w - pad - 18, 110);
    }
    function show() {
      if (guesses.length >= targets.length) return ctx.submit({ guesses });
      prompt.textContent = `Tap at ${targets[guesses.length]}%`;
      note.textContent = `${guesses.length + 1} of ${targets.length}`;
      draw();
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (reviewing || guesses.length >= targets.length) return;
      const { x } = canvasPos(canvas, e);
      const i = guesses.length;
      guesses.push(clamp(((x - pad) / (w - 2 * pad)) * 100, 0, 100));
      reviewing = true;
      turnFeedback(root, bisectFeedback(targets[i], guesses[i]),
        () => { reviewing = false; show(); },
        { progress: `${i + 1} of ${targets.length}` });
    });
    show();
    return { collect: () => (guesses.length ? { guesses } : null) };
  },
};

// ---- 4. Proportion Sense ---------------------------------------------------

GameClients.area = {
  intro: 'Estimate the small shape as a percentage of the big one. Four rounds; each shows your answer and the true area after you confirm.',
  start(root, ctx) {
    const trials = ctx.data.trials;
    const guesses = [];
    let reviewing = false;
    const prompt = h('h2', { class: 'center' }, 'What percent of the big shape is the small one?');
    const note = h('p', { class: 'trial-note center' });
    const value = h('strong', {}, '50%');
    const slider = h('input', { type: 'range', min: 0, max: 100, value: 50 });
    const confirm = h('button', { class: 'big', type: 'button' }, 'Confirm');
    const controls = h('div', { class: 'center' }, slider, value, confirm);
    const { ctx: g, w } = makeCanvas(root, 290, 150);
    root.prepend(prompt);
    root.append(note, controls);

    function shape(shape, x, y, size, color) {
      g.fillStyle = color;
      if (shape === 'circle') {
        g.beginPath(); g.arc(x, y, size / 2, 0, Math.PI * 2); g.fill();
      } else if (shape === 'rect') {
        g.fillRect(x - size / 2, y - size * 0.3, size, size * 0.6);
      } else {
        const hgt = size * 0.87;
        g.beginPath(); g.moveTo(x, y - hgt / 2); g.lineTo(x - size / 2, y + hgt / 2);
        g.lineTo(x + size / 2, y + hgt / 2); g.closePath(); g.fill();
      }
    }
    function draw(trial) {
      g.clearRect(0, 0, w, 290);
      g.fillStyle = '#3d5a6b'; g.font = 'bold 14px system-ui'; g.textAlign = 'center';
      g.fillText('BIG', w * 0.27, 42); g.fillText('SMALL', w * 0.73, 42);
      shape(trial.shape, w * 0.27, 158, trial.bigSize, '#00e5ff');
      shape(trial.shape, w * 0.73, 158, trial.smallSize, '#ff2d95');
      g.fillStyle = '#8ea8b5'; g.font = '14px system-ui';
      g.fillText('Compare area, not width', w / 2, 262);
    }
    function show() {
      if (guesses.length >= trials.length) return ctx.submit({ guesses });
      note.textContent = `${guesses.length + 1} of ${trials.length}`;
      slider.value = '50'; value.textContent = '50%';
      draw(trials[guesses.length]);
    }
    slider.addEventListener('input', () => { value.textContent = `${slider.value}%`; });
    confirm.addEventListener('click', () => {
      if (reviewing || guesses.length >= trials.length) return;
      const i = guesses.length;
      guesses.push(Number(slider.value));
      reviewing = true;
      turnFeedback(root, areaFeedback(trials[i], guesses[i]),
        () => { reviewing = false; show(); },
        { progress: `${i + 1} of ${trials.length}` });
    });
    show();
    return { collect: () => (guesses.length ? { guesses } : null) };
  },
};

// ---- 5. Trace the Shape ----------------------------------------------------

GameClients.trace = {
  intro: 'Trace the outline with your finger or cursor. Cover the whole shape.',
  start(root, ctx) {
    const { canvas, ctx: g, w, hgt } = makeCanvas(root, 360);
    const path = shapePath(ctx.data.shape, w, hgt);
    const diag = Math.hypot(w, hgt);
    const strokes = [];
    let drawing = false;

    function drawBase() {
      g.clearRect(0, 0, w, hgt);
      g.shadowColor = '#ff2d95';
      g.shadowBlur = 16;
      g.strokeStyle = 'rgba(255,45,149,0.85)';
      g.lineWidth = 8;
      g.lineJoin = g.lineCap = 'round';
      g.beginPath();
      path.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.shadowColor = '#3dff9e';
      g.shadowBlur = 10;
      g.strokeStyle = '#3dff9e';
      g.lineWidth = 3;
      g.beginPath();
      let started = false;
      for (const p of strokes) {
        if (p === null) { started = false; continue; }
        if (!started) { g.moveTo(p.x, p.y); started = true; }
        else g.lineTo(p.x, p.y);
      }
      g.stroke();
    }
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      strokes.push(null, canvasPos(canvas, e));
      drawBase();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      strokes.push(canvasPos(canvas, e));
      drawBase();
    });
    canvas.addEventListener('pointerup', () => { drawing = false; });
    drawBase();

    function result() {
      const pts = strokes.filter(Boolean);
      if (pts.length < 5) return null;
      // Mean distance from each drawn point to the path, normalized by the
      // shape's bounding-box diagonal so screen size doesn't matter.
      const xs = path.map((p) => p.x);
      const ys = path.map((p) => p.y);
      const bbDiag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      let sum = 0;
      for (const p of pts) sum += nearestDist(p, path);
      const deviation = sum / pts.length / bbDiag;
      const covThresh = diag * 0.04;
      let covered = 0;
      for (const q of path) if (nearestDist(q, pts) <= covThresh) covered++;
      return { deviation, coverage: covered / path.length };
    }
    root.append(h('button', {
      // Sticky: on short viewports (landscape phones) the canvas's 160px
      // height floor can overflow the fold, and the canvas swallows touch
      // scrolling — without this the button is unreachable and the round
      // can only time out.
      class: 'big', style: { marginTop: '10px', position: 'sticky', bottom: '10px' },
      onclick: () => { const r = result(); if (r) ctx.submit(r); },
    }, 'Done tracing'));
    return { collect: result };
  },
};

function nearestDist(p, pts) {
  let best = Infinity;
  for (const q of pts) {
    const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// Interpolate a closed polygon (corners in normalized [-1,1] coords) into a
// dense polyline centered at (cx, cy) with scale s.
function polygonPath(corners, cx, cy, s) {
  const pts = [];
  const closed = [...corners, corners[0]];
  // ~200 samples total regardless of corner count, so the deviation metric
  // is equally fine-grained on a triangle and a 12-corner cross.
  const per = Math.max(8, Math.ceil(200 / corners.length));
  for (let i = 0; i < closed.length - 1; i++) {
    for (let k = 0; k < per; k++) {
      const t = k / per;
      pts.push({
        x: cx + s * (closed[i][0] + (closed[i + 1][0] - closed[i][0]) * t),
        y: cy + s * (closed[i][1] + (closed[i + 1][1] - closed[i][1]) * t),
      });
    }
  }
  pts.push({ x: cx + s * corners[0][0], y: cy + s * corners[0][1] });
  return pts;
}

// Normalized corner lists ([-1,1] box, y down) for the polygon shapes.
const SHAPE_CORNERS = {
  triangle: [[0, -1], [1, 0.8], [-1, 0.8]],
  square: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  diamond: [[0, -1], [1, 0], [0, 1], [-1, 0]],
  hourglass: [[-0.8, -1], [0.8, -1], [-0.8, 1], [0.8, 1]],
  hexagon: [...Array(6)].map((_, i) => {
    const th = -Math.PI / 2 + (i * Math.PI) / 3;
    return [Math.cos(th), Math.sin(th)];
  }),
  bolt: [[0.35, -1], [-0.35, 0.05], [0.05, 0.05], [-0.35, 1], [0.35, -0.05], [-0.05, -0.05]],
  arrow: [[-1, -0.35], [0.2, -0.35], [0.2, -0.75], [1, 0], [0.2, 0.75], [0.2, 0.35], [-1, 0.35]],
  cross: [
    [-0.33, -1], [0.33, -1], [0.33, -0.33], [1, -0.33], [1, 0.33], [0.33, 0.33],
    [0.33, 1], [-0.33, 1], [-0.33, 0.33], [-1, 0.33], [-1, -0.33], [-0.33, -0.33],
  ],
};

function shapePath(shape, w, hgt) {
  const cx = w / 2;
  const cy = hgt / 2;
  const pts = [];
  if (SHAPE_CORNERS[shape]) {
    return polygonPath(SHAPE_CORNERS[shape], cx, cy, Math.min(w, hgt) / 2 - 30);
  }
  if (shape === 'heart') {
    // Classic parametric heart, then uniformly scaled + centered to fit.
    const raw = [];
    for (let i = 0; i <= 260; i++) {
      const t = (i / 260) * Math.PI * 2;
      raw.push({
        x: 16 * Math.sin(t) ** 3,
        y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
      });
    }
    const xs = raw.map((p) => p.x);
    const ys = raw.map((p) => p.y);
    const bw = Math.max(...xs) - Math.min(...xs);
    const bh = Math.max(...ys) - Math.min(...ys);
    const s = Math.min((w - 60) / bw, (hgt - 60) / bh);
    const mx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const my = (Math.max(...ys) + Math.min(...ys)) / 2;
    return raw.map((p) => ({ x: cx + (p.x - mx) * s, y: cy + (p.y - my) * s }));
  }
  if (shape === 'circle') {
    const R = Math.min(w, hgt) / 2 - 30;
    for (let i = 0; i <= 240; i++) {
      const th = -Math.PI / 2 + (i / 240) * Math.PI * 2;
      pts.push({ x: cx + R * Math.cos(th), y: cy + R * Math.sin(th) });
    }
    return pts;
  }
  if (shape === 'spiral') {
    for (let i = 0; i <= 260; i++) {
      const th = (i / 260) * 3.5 * Math.PI;
      const r = 12 + th * (Math.min(w, hgt) / 2 - 30) / (3.5 * Math.PI);
      pts.push({ x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) });
    }
  } else if (shape === 'star') {
    const R = Math.min(w, hgt) / 2 - 25;
    const r = R * 0.45;
    const corners = [];
    for (let i = 0; i <= 10; i++) {
      const th = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? R : r;
      corners.push({ x: cx + rad * Math.cos(th), y: cy + rad * Math.sin(th) });
    }
    for (let i = 0; i < corners.length - 1; i++) {
      for (let s = 0; s < 24; s++) {
        const t = s / 24;
        pts.push({
          x: corners[i].x + (corners[i + 1].x - corners[i].x) * t,
          y: corners[i].y + (corners[i + 1].y - corners[i].y) * t,
        });
      }
    }
  } else if (shape === 'zigzag') {
    const peaks = 5;
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * peaks;
      const x = 30 + (i / 240) * (w - 60);
      const tri = 2 * Math.abs(t - Math.floor(t + 0.5)); // triangle wave 0..1
      pts.push({ x, y: cy + (tri - 0.5) * (hgt - 90) });
    }
  } else if (shape === 'infinity') {
    // Lemniscate of Bernoulli, scaled to the canvas.
    const a = Math.min(w, hgt * 1.6) / 2 - 30;
    for (let i = 0; i <= 260; i++) {
      const th = (i / 260) * Math.PI * 2;
      const d = 1 + Math.sin(th) * Math.sin(th);
      pts.push({ x: cx + (a * Math.cos(th)) / d, y: cy + (a * 0.9 * Math.sin(th) * Math.cos(th)) / d });
    }
  } else {
    for (let i = 0; i <= 240; i++) {
      const x = 30 + (i / 240) * (w - 60);
      pts.push({ x, y: cy + Math.sin((i / 240) * Math.PI * 3) * (hgt / 2 - 50) });
    }
  }
  return pts;
}

// ---- 6. Dots in the Jar ----------------------------------------------------

GameClients.dots = {
  intro: 'Dots flash for 4 seconds. Estimate how many. Three jars — each shows your estimate and the real count.',
  start(root, ctx) {
    const rng = seededRng(ctx.data.seed);
    const counts = ctx.data.counts;
    const guesses = [];
    let reviewing = false;
    const note = h('p', { class: 'trial-note center' });
    const { canvas, ctx: g, w, hgt } = makeCanvas(root, 300);
    const input = h('input', { type: 'number', placeholder: 'How many dots?', min: 0, inputmode: 'numeric' });
    const btn = h('button', { class: 'big', onclick: confirm, disabled: true }, 'Guess');
    // Sticky for the same reason as Trace's Done button: on short viewports
    // the canvas's height floor can push these controls below the fold.
    root.append(note, h('div', { style: { position: 'sticky', bottom: '10px' } },
      input, h('div', { style: { marginTop: '8px' } }, btn)));

    // Pre-generate all dot positions from the shared seed so every player
    // sees the identical jars.
    const layouts = counts.map((n) => [...Array(n)].map(() => ({ x: 15 + rng() * (w - 30), y: 15 + rng() * (hgt - 30) })));

    function show() {
      if (guesses.length >= counts.length) return ctx.submit({ guesses });
      note.textContent = `Jar ${guesses.length + 1} of ${counts.length} — memorize!`;
      btn.disabled = true;
      input.value = '';
      const pts = layouts[guesses.length];
      g.clearRect(0, 0, w, hgt);
      g.shadowColor = '#ffd23d';
      g.shadowBlur = 8;
      g.fillStyle = '#ffd23d';
      for (const p of pts) {
        g.beginPath();
        g.arc(p.x, p.y, 4, 0, Math.PI * 2);
        g.fill();
      }
      g.shadowBlur = 0;
      setTimeout(() => {
        g.clearRect(0, 0, w, hgt);
        g.fillStyle = '#7fb8cc';
        g.font = '22px system-ui';
        g.fillText('How many did you see?', w / 2 - 110, hgt / 2);
        note.textContent = `Jar ${guesses.length + 1} of ${counts.length} — your estimate?`;
        btn.disabled = false;
        input.focus();
      }, 4000);
    }
    function confirm() {
      if (reviewing) return;
      const v = Number(input.value);
      if (!Number.isFinite(v) || v < 0) return;
      const i = guesses.length;
      guesses.push(v);
      btn.disabled = true;
      reviewing = true;
      turnFeedback(root, dotsFeedback(counts[i], guesses[i]),
        () => { reviewing = false; show(); },
        { progress: `Jar ${i + 1} of ${counts.length}` });
    }
    show();
    return { collect: () => (guesses.length ? { guesses } : null) };
  },
};

// ---- 8. Stop the Clock -----------------------------------------------------

GameClients.stopclock = {
  intro: 'Stop the timer at exactly the target time shown. It disappears after 3 seconds. Two tries, best counts — each shows your time and the target.',
  start(root, ctx) {
    const { targetMs, visibleMs, attempts } = ctx.data;
    const errors = [];
    let reviewing = false;
    const display = h('div', { class: 'mash-count' }, '0.000');
    const note = h('p', { class: 'trial-note center' }, `Attempt 1 of ${attempts} — stop at ${(targetMs / 1000).toFixed(3)}s`);
    const btn = h('button', { class: 'big' }, 'START');
    root.append(display, note, btn);
    let startTs = null;
    let raf = null;

    function tick() {
      const el = performance.now() - startTs;
      display.textContent = el <= visibleMs ? (el / 1000).toFixed(3) : '· · ·';
      raf = requestAnimationFrame(tick);
    }
    btn.addEventListener('click', () => {
      if (reviewing) return;
      if (startTs == null) {
        startTs = performance.now();
        btn.textContent = 'STOP';
        tick();
      } else {
        const el = performance.now() - startTs;
        cancelAnimationFrame(raf);
        startTs = null;
        errors.push(Math.abs(el - targetMs));
        display.textContent = (el / 1000).toFixed(3);
        const attemptNo = errors.length;
        reviewing = true;
        turnFeedback(root, stopclockFeedback(targetMs, el),
          () => {
            reviewing = false;
            if (attemptNo >= attempts) {
              ctx.submit({ best: Math.min(...errors) });
            } else {
              note.textContent = `Attempt ${attemptNo + 1} of ${attempts} — stop at ${(targetMs / 1000).toFixed(3)}s`;
              btn.textContent = 'START';
            }
          },
          { progress: `Attempt ${attemptNo} of ${attempts}` });
      }
    });
    return { collect: () => (errors.length ? { best: Math.min(...errors) } : null) };
  },
};

// ---- 8b. Metronome Blackout -------------------------------------------------
//
// Four beats play, then the room goes dark and you keep the beat for eight
// more. Everything measured here is LOCAL to this device: the beat grid is
// scheduled from one performance.now() reading taken on this client, and every
// tap is a delta against that same clock. No sync offset, no network latency,
// nothing the finale's NTP-style estimation has to fight with — which is the
// main reason this game is worth having.
//
// Audio is an enhancement, never the game. The click is built on the START
// gesture (so autoplay policy never suspends it) inside a try/catch, and every
// beat flashes whether or not a sound came out — a muted phone is not a
// handicap.

GameClients.metronome = {
  intro: 'Four beats play. Then silence — keep tapping where the next 8 beats would land. Tap the pad or press SPACE.',
  start(root, ctx) {
    const { intervalMs, leadInBeats, silentBeats } = ctx.data;
    const offsets = [];
    let reference = null;   // scheduled time of the LAST lead-in beat
    let phase = 'idle';     // idle → leadin → blackout → done
    let beatTimer = null;
    let flashTimer = null;
    let audio = null;

    const note = h('p', { class: 'trial-note center' }, 'Listen to the count-in, then keep the beat.');
    const count = h('div', { class: 'mash-count' }, `0 / ${silentBeats}`);
    const label = h('span', { class: 'beat-pad-label' }, 'START');
    const pad = h('div', { class: 'beat-pad' }, label);
    root.append(count, pad, note);

    // A short click, scheduled on the audio clock so it lands with the flash.
    function tick() {
      if (!audio) return;
      try {
        const t = audio.currentTime;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'square';
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.06);
      } catch { /* the flash is a complete game on its own */ }
    }

    function flash(cls) {
      pad.classList.add(cls);
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => pad.classList.remove(cls), 110);
    }

    // Each beat is scheduled against the absolute grid rather than chained off
    // the previous timer, so setTimeout jitter cannot accumulate into drift.
    function scheduleBeat(gridStart, i) {
      const due = gridStart + i * intervalMs;
      beatTimer = setTimeout(() => {
        tick();
        flash('lead');
        if (i + 1 < leadInBeats) return scheduleBeat(gridStart, i + 1);
        // The last lead-in beat is the origin every tap is measured from. It
        // is the SCHEDULED time, not this callback's — the callback is late by
        // however much the timer drifted, and that error would land on the
        // player's score.
        reference = due;
        phase = 'blackout';
        label.textContent = 'KEEP THE BEAT';
        pad.classList.add('blackout');
        note.textContent = `Silence — tap ${silentBeats} more beats on the same grid.`;
      }, Math.max(0, due - performance.now()));
    }

    function begin() {
      if (phase !== 'idle') return;
      phase = 'leadin';
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          audio = new Ctx();
          audio.resume?.();
        }
      } catch { audio = null; }
      label.textContent = 'COUNT-IN';
      note.textContent = `${leadInBeats} beats — do not tap yet.`;
      scheduleBeat(performance.now(), 0);
    }

    function tap() {
      if (phase === 'idle') return begin();
      if (phase !== 'blackout') return;
      const offset = performance.now() - reference;
      // A tap in the first half-beat belongs to the count-in the player is
      // still tapping along with, not to beat one. Dropping it costs nothing;
      // consuming it would push every later tap a whole beat out of phase.
      if (offset < intervalMs / 2) return;
      offsets.push(offset);
      // A ring on every tap, identical whether the tap was early or late.
      // Anything that reveals WHICH way it was wrong turns a timing game into
      // a feedback-following game.
      flash('hit');
      count.textContent = `${offsets.length} / ${silentBeats}`;
      if (offsets.length >= silentBeats) finish();
    }

    function finish() {
      if (phase === 'done') return;
      stop();
      label.textContent = 'DONE';
      note.textContent = 'Locked in.';
      ctx.submit({ offsets });
    }

    // Detach everything: this client can end at its own last beat or at the
    // shell's deadline, and a document-level key listener outliving either one
    // would keep firing over the next game.
    function stop() {
      phase = 'done';
      clearTimeout(beatTimer);
      clearTimeout(flashTimer);
      document.removeEventListener('keydown', onKeydown);
      try { audio?.close(); } catch { /* already gone */ }
      audio = null;
    }

    function onKeydown(e) {
      if (e.code !== 'Space') return;
      e.preventDefault();  // stop page scroll
      if (!e.repeat) tap();
    }

    // pointerdown, never click: the mobile click delay would land every tap
    // ~100ms late and score the whole room's phones behind its laptops.
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    document.addEventListener('keydown', onKeydown);

    return {
      collect: () => {
        stop();
        // Whatever was tapped still scores — the beats never reached are
        // charged a full interval each, server-side.
        return offsets.length ? { offsets } : null;
      },
    };
  },
};

// ---- 9. Grid Flash ---------------------------------------------------------

GameClients.gridflash = {
  intro: 'Some cells light up for 4 seconds. Rebuild the pattern from memory. Two rounds — each reveals the true cells after you commit.',
  start(root, ctx) {
    const { patterns, showMs } = ctx.data;
    const picks = [];
    let current = new Set();
    let showing = true;
    const note = h('p', { class: 'trial-note center' });
    const grid = h('div', { class: 'grid5' });
    const btn = h('button', { class: 'big', onclick: confirm, disabled: true }, 'Done');
    root.append(note, grid, h('div', { style: { marginTop: '8px' } }, btn));
    // Square 5×5 grid sized to fit above the Done button — never scroll.
    const side = Math.min(root.clientWidth || 680, 440, availHeight(root, 140));
    grid.style.width = `${side}px`;
    grid.style.margin = '0 auto';
    const cells = [...Array(25)].map((_, i) => {
      const c = h('div', {
        class: 'cell',
        onclick: () => {
          if (showing) return;
          if (current.has(i)) current.delete(i);
          else current.add(i);
          c.classList.toggle('picked');
        },
      });
      grid.append(c);
      return c;
    });

    function round() {
      const r = picks.length;
      if (r >= patterns.length) return ctx.submit({ picks });
      showing = true;
      btn.disabled = true;
      current = new Set();
      note.textContent = `Round ${r + 1} of ${patterns.length} — memorize!`;
      cells.forEach((c, i) => {
        c.classList.remove('picked');
        c.classList.toggle('lit', patterns[r].includes(i));
      });
      setTimeout(() => {
        cells.forEach((c) => c.classList.remove('lit'));
        showing = false;
        btn.disabled = false;
        note.textContent = `Round ${r + 1} of ${patterns.length} — click the cells that were lit`;
      }, showMs);
    }
    function confirm() {
      if (showing) return;
      const r = picks.length;
      picks.push([...current]);
      // Freeze the board during review and light the true pattern so the
      // player sees which cells they missed alongside their own picks.
      showing = true;
      btn.disabled = true;
      cells.forEach((c, i) => c.classList.toggle('lit', patterns[r].includes(i)));
      turnFeedback(root, gridflashFeedback(patterns[r], picks[r]),
        () => { cells.forEach((c) => c.classList.remove('lit')); round(); },
        { progress: `Round ${r + 1} of ${patterns.length}` });
    }
    round();
    return { collect: () => ({ picks: [...picks, ...(current.size && !showing ? [[...current]] : [])] }) };
  },
};

// ---- 9a. Vanishing Tray ----------------------------------------------------
//
// Twelve glyphs sit on a tray for five seconds; then a seeded 2–4 of them are
// swapped for new ones, and you tap the slots that changed. The whole round is
// a pure function of the round seed (shared/tray.js — the same module the
// server re-derives to score), so the client builds the modified tray locally
// the way cups/oddoneout build their layouts: no mid-game emit, and a player
// who reconnects mid-round re-derives the same tray from the seed they already
// hold.

GameClients.tray = {
  intro: 'Twelve items sit on the tray for 5 seconds — then some are swapped. Tap the slots that changed.',
  start(root, ctx) {
    const { items, seed, showMs } = ctx.data;
    const { changed, replacements } = trayLevel(seed);
    const swapped = traySwapped(items, changed, replacements);
    const picks = new Set();
    let showing = true;
    const note = h('p', { class: 'trial-note center' });
    const grid = h('div', { class: 'grid4' });
    const btn = h('button', { class: 'big', onclick: confirm, disabled: true }, 'Done');
    root.append(note, grid, h('div', { style: { marginTop: '8px' } }, btn));
    // 4×3 grid of glyph tiles sized to fit above the Done button — never scroll.
    const side = Math.min(root.clientWidth || 680, 400, availHeight(root, 150));
    grid.style.width = `${side}px`;
    grid.style.margin = '0 auto';
    const cells = items.map((glyph, i) => {
      const c = h('div', { class: 'cell' });
      c.textContent = glyph;
      c.onclick = () => {
        if (showing) return;
        if (picks.has(i)) picks.delete(i);
        else picks.add(i);
        c.classList.toggle('picked');
      };
      grid.append(c);
      return c;
    });

    note.textContent = 'Memorize the tray!';
    setTimeout(() => {
      showing = false;
      btn.disabled = false;
      cells.forEach((c, i) => { c.textContent = swapped[i]; });
      note.textContent = 'Tap the slots that changed';
    }, showMs);

    function confirm() {
      ctx.submit({ picks: [...picks] });
    }
    // A partial attempt still scores: whatever is flagged at the deadline.
    return { collect: () => ({ picks: [...picks] }) };
  },
};

// ---- 9b. Follow the Cup ----------------------------------------------------
//
// The one game here with nothing hidden: the ball's whole path is on screen
// for as long as the shuffle runs, and the difficulty is holding attention on
// it, not deducing it. Every level's script comes from shared/cups.js — the
// same module the server re-derives to score — so what a player watches and
// what their picks are checked against are the same shuffle by construction.
//
// Every animation here is driven by elapsed ms, never by frames: a phone that
// drops to 20fps must get the SAME shuffle at the same speed as a laptop, or
// the slow device is playing an easier game and the metric is about hardware.

GameClients.cups = {
  intro: 'Watch which cup the ball goes under, then tap that cup after the shuffle. You play all ten levels — each correct cup scores 100 × its level, and a miss just moves you on to the next.',
  start(root, ctx) {
    const { seed, maxLevels, baseCups } = ctx.data;
    // Everything that is not shuffle is overhead against a 45s round, so the
    // fixed beats are as short as they can be and still be read. The reveal is
    // the exception: it is the only moment the ball is ever on show, and
    // rushing it makes the game unfair rather than harder.
    const BEAT_MS = 650;                                   // the "LEVEL n" card
    const LIFT_MS = 280, HOLD_MS = 580, DROP_MS = 260;     // ball on show
    const REVEAL_MS = LIFT_MS + HOLD_MS + DROP_MS;
    const VERDICT_MS = 750;                                // where it really was
    const TONE = '#1b3a52';
    const lerp = (a, b, p) => a + (b - a) * p;
    const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2);

    const picks = [];
    let level = 0;
    let plan = null;
    let phase = 'beat';        // beat → reveal → shuffle → choose → verdict
    let phaseAt = 0;
    let tapped = null;
    let raf = null;
    let stopped = false;

    const tag = h('div', { class: 'mash-count' }, 'LEVEL 1');
    root.append(tag);
    const { canvas, ctx: g, w, hgt } = makeCanvas(root, 320, 130);
    const note = h('p', { class: 'trial-note center' }, 'Keep your eyes on the ball.');
    root.append(note);

    const PAD = 24;
    const baseY = hgt - 40;
    const cupH = Math.min(140, Math.max(72, hgt * 0.46));
    // How far a cup tips up to show what is under it. Enough to clear the ball
    // and no more — lifting by a whole cup height reads as the cup flying away.
    const LIFT_PX = Math.min(72, cupH * 0.55);
    const homeXs = (n) => [...Array(n)].map((_, i) => PAD + (w - 2 * PAD) * ((i + 0.5) / n));
    const cupW = (n) => Math.min(96, ((w - 2 * PAD) / n) * 0.78);

    function drawCup(x, n, lift = 0, scale = 1, edge = '#2c5f7d') {
      const cw = cupW(n) * scale;
      const ch = cupH * scale;
      const bottom = baseY - lift;
      const top = bottom - ch;
      const halfB = cw / 2;
      const halfT = cw * 0.34;
      g.beginPath();
      g.moveTo(x - halfB, bottom);
      g.lineTo(x - halfT, top);
      g.quadraticCurveTo(x, top - 10, x + halfT, top);
      g.lineTo(x + halfB, bottom);
      g.closePath();
      const grad = g.createLinearGradient(x - halfB, 0, x + halfB, 0);
      grad.addColorStop(0, '#0a141c');
      grad.addColorStop(0.42, TONE);
      grad.addColorStop(1, '#071019');
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = edge;
      g.lineWidth = 2;
      g.stroke();
    }

    function drawBall(x) {
      g.save();
      g.shadowColor = '#ffd23d';
      g.shadowBlur = 16;
      g.fillStyle = '#ffd23d';
      g.beginPath();
      g.arc(x, baseY - 13, 13, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    function drawTable(homes) {
      g.strokeStyle = '#16303f';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(10, baseY + 2);
      g.lineTo(w - 10, baseY + 2);
      g.stroke();
      // Numbered slots: the verdict names a cup, so the cups have names.
      g.fillStyle = '#3d5a6b';
      g.font = '13px system-ui, sans-serif';
      g.textAlign = 'center';
      homes.forEach((x, i) => g.fillText(String(i + 1), x, baseY + 22));
    }

    function draw(now) {
      const t = now - phaseAt;
      const homes = homeXs(plan.cups);
      g.clearRect(0, 0, w, hgt);
      drawTable(homes);

      if (phase === 'reveal') {
        // Up, hold, down — the only moment the ball is ever visible in play.
        const lift = t < LIFT_MS ? ease(t / LIFT_MS)
          : t < LIFT_MS + HOLD_MS ? 1
            : 1 - ease(Math.min(1, (t - LIFT_MS - HOLD_MS) / DROP_MS));
        drawBall(homes[plan.start]);
        homes.forEach((x, i) => drawCup(x, plan.cups, i === plan.start ? lift * LIFT_PX : 0));
        return;
      }

      if (phase === 'shuffle') {
        const k = Math.min(plan.swaps.length - 1, Math.floor(t / plan.swapMs));
        const p = clamp((t - k * plan.swapMs) / plan.swapMs, 0, 1);
        const { a, b } = plan.swaps[k];
        // One cup arcs over the top and one passes in front, so a crossing
        // reads as two cups trading places rather than two cups merging.
        const over = (a + b + k) % 2 === 0 ? a : b;
        const under = over === a ? b : a;
        const e = ease(p);
        const bow = Math.sin(Math.PI * p);
        homes.forEach((x, i) => { if (i !== a && i !== b) drawCup(x, plan.cups); });
        drawCup(lerp(homes[over], homes[under], e), plan.cups, Math.min(54, cupH * 0.42) * bow, 1 - 0.12 * bow);
        drawCup(lerp(homes[under], homes[over], e), plan.cups, -9 * bow, 1 + 0.1 * bow);
        return;
      }

      if (phase === 'verdict') {
        const right = tapped === plan.ball;
        const lift = ease(Math.min(1, t / 260)) * LIFT_PX;
        drawBall(homes[plan.ball]);
        homes.forEach((x, i) => drawCup(
          x, plan.cups,
          i === plan.ball ? lift : 0,
          1,
          i === plan.ball ? '#3dff9e' : i === tapped ? '#ff5470' : '#2c5f7d'
        ));
        g.fillStyle = right ? '#3dff9e' : '#ff5470';
        g.font = '700 26px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(right ? '✓' : '✗', w / 2, 30);
        return;
      }

      homes.forEach((x) => drawCup(x, plan.cups, 0, 1, phase === 'choose' ? '#00e5ff' : '#2c5f7d'));
      if (phase === 'beat') {
        g.fillStyle = '#00e5ff';
        g.font = '700 32px system-ui, sans-serif';
        g.textAlign = 'center';
        g.globalAlpha = clamp(t / 200, 0, 1);
        g.fillText(`LEVEL ${level}`, w / 2, hgt * 0.24);
        g.globalAlpha = 1;
      }
    }

    function frame(now) {
      // The handle is spent the moment the callback runs, so clear it here and
      // nowhere else: `raf == null` then means "no frame is pending", which is
      // what startLevel checks before restarting the loop. Leaving a stale
      // handle behind stalls the run on the level-2 card, forever.
      raf = null;
      if (stopped) return;
      const t = now - phaseAt;
      if (phase === 'beat' && t >= BEAT_MS) enter('reveal', now, 'Watch the ball go under.');
      else if (phase === 'reveal' && t >= REVEAL_MS) enter('shuffle', now, 'Follow it.');
      else if (phase === 'shuffle' && t >= plan.shuffleMs) enter('choose', now, 'Where is it? Tap a cup.');
      else if (phase === 'verdict' && t >= VERDICT_MS) {
        // A miss no longer ends the run — every level is played and scored on
        // its own. The run ends only after the last level.
        if (level >= maxLevels) return finish();
        return startLevel(level + 1);
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    function enter(next, now, msg) {
      phase = next;
      phaseAt = now;
      note.textContent = msg;
    }

    function startLevel(n) {
      level = n;
      plan = cupsLevel(seed, n, { baseCups });
      tapped = null;
      phase = 'beat';
      phaseAt = performance.now();
      tag.textContent = `LEVEL ${n}`;
      note.textContent = `${plan.cups} cups, ${plan.swaps.length} swaps.`;
      if (raf == null && !stopped) raf = requestAnimationFrame(frame);
    }

    // pointerdown, never click: the mobile click delay would put every phone a
    // tenth of a second behind every laptop on a game the deadline cuts short.
    function onTap(ev) {
      ev.preventDefault();
      if (stopped || phase !== 'choose') return;
      const { x } = canvasPos(canvas, ev);
      const homes = homeXs(plan.cups);
      let best = 0;
      for (let i = 1; i < homes.length; i++) {
        if (Math.abs(homes[i] - x) < Math.abs(homes[best] - x)) best = i;
      }
      tapped = best;
      picks.push({ level, cupIndex: best });
      const right = best === plan.ball;
      const last = level >= maxLevels;
      tag.textContent = `LEVEL ${level} ${right ? '✓' : '✗'}`;
      enter('verdict', performance.now(), right
        ? (last ? 'Cleared the last level.' : `+${100 * level} — next level →`)
        : (last
          ? `Missed — the ball was under cup ${plan.ball + 1}.`
          : `Missed — the ball was under cup ${plan.ball + 1}. Next level →`));
    }

    function finish() {
      stop();
      ctx.submit({ picks });
    }

    // The run ends at the last level (finish) or at the shell's host-advance
    // path (collect). A rAF loop and a pointer listener that outlived either
    // would keep drawing over the next game's screen.
    function stop() {
      stopped = true;
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      canvas.removeEventListener('pointerdown', onTap);
    }

    canvas.addEventListener('pointerdown', onTap);
    startLevel(1);

    return {
      collect: () => {
        stop();
        // Always a payload, even an empty one: no level cleared is a real score
        // of zero here, the same as a wrong tap on level 1. The server agrees.
        return { picks };
      },
    };
  },
};

// ---- 11. Read the Room -----------------------------------------------------

GameClients.readroom = {
  intro: 'Answer honestly, then predict what percent of the room said yes.',
  start(root, ctx) {
    let answer = null;
    const q = h('h2', { class: 'center' }, ctx.data.question);
    const step1 = h('div', { class: 'center' },
      h('button', { style: { marginRight: '10px' }, onclick: () => pick(true) }, 'Yes'),
      h('button', { class: 'secondary', onclick: () => pick(false) }, 'No'));
    const val = h('div', { class: 'center', style: { fontSize: '28px', fontWeight: '700' } }, '50%');
    const slider = h('input', {
      type: 'range', min: 0, max: 100, value: 50,
      oninput: () => { val.textContent = `${slider.value}%`; },
    });
    const step2 = h('div', { class: 'hidden' },
      h('p', { class: 'center muted' }, 'What % of the room answered YES?'),
      val, slider,
      h('div', { style: { marginTop: '10px' } },
        h('button', { class: 'big', onclick: () => ctx.submit({ answer, prediction: Number(slider.value) }) }, 'Submit prediction')));
    root.append(q, step1, step2);
    function pick(v) {
      answer = v;
      step1.classList.add('hidden');
      step2.classList.remove('hidden');
    }
    return { collect: () => (answer == null ? null : { answer, prediction: Number(slider.value) }) };
  },
};

// ---- 12. Caption Battle (two-stage) ----------------------------------------
// Stage 1: everyone answers the same seeded prompt. Stage 2: everyone reads
// the anonymized pool built out of stage 1 and spends their votes. Both stages
// are played by all players at once. Score = votes received.

// What this device wrote in stage 1, so stage 2 can grey out your own entry.
// Server-side self-vote rejection is the real enforcement (by playerId) — this
// is only so you aren't invited to click something that will be thrown away.
let myCaption = null;

GameClients.caption = {
  intro: (stage) => (stage === 2
    ? 'Read the room’s answers and vote for the best ones. You can’t vote for your own.'
    : 'Answer the prompt. Everyone reads them next — votes are the points.'),

  startStage(stage, root, ctx) {
    return stage === 2
      ? startVote(root, ctx)
      : startWrite(root, ctx, {
        placeholder: 'Your answer…',
        footer: 'Everyone reads these next — keep it short and keep it kind.',
        remember: (text) => { myCaption = text; },
      });
  },
};

// The writing stage shared by every game that pools player-authored text.
// `remember` hands the cleaned string back to the game so its later stages can
// recognize what this device wrote.
function startWrite(root, ctx, opts = {}) {
  const max = ctx.data.maxChars || 80;
  const remember = opts.remember || (() => {});
  remember(null);
  const input = h('input', {
    type: 'text', autocomplete: 'off', maxlength: String(max * 2),
    placeholder: opts.placeholder || 'Your answer…',
  });
  const counter = h('p', { class: 'trial-note center' }, `0 / ${max}`);
  // Count what the SERVER will keep, not what is in the box: whitespace runs
  // collapse and control characters vanish before anything is pooled.
  const cleaned = () => cleanEntryText(input.value, max);
  const paint = () => {
    const n = [...cleaned()].length;
    counter.textContent = `${n} / ${max}`;
    btn.disabled = n === 0;
  };
  const send = () => {
    const text = cleaned();
    if (!text) return;
    remember(text);
    ctx.submit({ text });
  };
  const btn = h('button', { class: 'big', onclick: send, disabled: true }, 'Lock it in');
  input.addEventListener('input', paint);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  root.append(
    h('h2', { class: 'center' }, ctx.data.prompt),
    input, counter,
    h('div', { style: { marginTop: '10px' } }, btn),
    h('p', { class: 'muted center', style: { fontSize: '13px' } },
      opts.footer || 'Everyone reads these next — keep it short and keep it kind.')
  );
  input.focus();
  return {
    collect: () => {
      const text = cleaned();
      if (!text) return null;
      remember(text);
      return { text };
    },
  };
}

function startVote(root, ctx) {
  let data = ctx.data;
  const picked = new Set();
  const note = h('p', { class: 'trial-note center' });
  const list = h('div', {});
  const btn = h('button', { class: 'big', onclick: () => ctx.submit({ votes: [...picked] }) }, 'Submit votes');

  const render = () => {
    const hidden = new Set(data.hidden || []);
    const per = data.votesPerPlayer || 1;
    for (const id of picked) if (hidden.has(id)) picked.delete(id);
    note.textContent = `${picked.size} of ${per} vote${per === 1 ? '' : 's'} used`;
    btn.disabled = picked.size === 0;
    list.replaceChildren();
    for (const entry of data.entries || []) {
      if (hidden.has(entry.id)) continue;
      const mine = myCaption != null && entry.text === myCaption;
      const chosen = picked.has(entry.id);
      const opt = h('button', {
        class: `vote-option${chosen ? ' chosen' : ''}`,
        onclick: () => {
          if (mine) return;
          if (chosen) picked.delete(entry.id);
          else if (picked.size < per) picked.add(entry.id);
          render();
        },
      }, mine ? `${entry.text}  (yours)` : entry.text);
      if (mine) opt.style.opacity = '0.45';
      list.append(opt);
    }
  };

  root.append(
    h('h2', { class: 'center' }, data.prompt),
    h('p', { class: 'muted center' }, 'Vote for the best answers:'),
    list, note,
    h('div', { style: { marginTop: '10px', position: 'sticky', bottom: '10px' } }, btn)
  );
  render();
  return {
    collect: () => (picked.size ? { votes: [...picked] } : null),
    // The host pulled an entry off every screen mid-vote.
    update: (next) => { data = next; render(); },
  };
}

// ---- 15. Icebreaker (multi-stage) ------------------------------------------
// Stage 1: everyone writes one true fun fact about themselves. Stages 2…N+1:
// the room is served those facts ONE at a time, in the same order on every
// screen, and picks who it belongs to from the full list of players. Nobody
// sees the next fact until everyone has locked a guess on this one — between
// facts the room argues it out and the host reveals the answer. Every player
// is an option on every fact, the same name can be picked as often as you
// like, and only the right ones score.

// What this device wrote in stage 1, so a fact can quietly tell you it's
// yours instead of leaving you wondering. Server-side nothing changes: your
// own fact is a point everyone in the room gets exactly one of.
let myFact = null;

GameClients.icebreaker = {
  intro: (stage) => (stage === 1
    ? 'Write one TRUE fun fact about yourself. The room has to guess who each one belongs to.'
    : 'Whose fun fact is this? Pick anyone — the same person can be the answer more than once.'),

  startStage(stage, root, ctx) {
    return stage === 1
      ? startWrite(root, ctx, {
        placeholder: 'One true thing about you…',
        footer: 'Keep it true — the whole room is about to guess who wrote it.',
        remember: (text) => { myFact = text; },
      })
      : startGuess(root, ctx);
  },
};

function startGuess(root, ctx) {
  let data = ctx.data;
  let picked = null;
  const counter = h('p', { class: 'trial-note center' },
    `Fun fact ${data.round} of ${data.totalRounds}`);
  const fact = h('h2', { class: 'center' });
  const mine = h('p', { class: 'muted center', style: { fontSize: '13px' } });
  const ask = h('p', { class: 'muted center' });
  const list = h('div', {});
  const btn = h('button', {
    class: 'big',
    onclick: () => { if (picked) ctx.submit({ factId: data.factId, pick: picked }); },
    disabled: true,
  }, 'Lock in guess');

  const render = () => {
    const gone = !!data.hidden;
    fact.textContent = gone ? '— removed by the host —' : data.text;
    mine.textContent = !gone && myFact != null && data.text === myFact
      ? '(this one’s yours — free point)' : '';
    ask.textContent = gone ? 'Nobody scores this one — waiting for the host.' : 'Who wrote it?';
    btn.disabled = gone || !picked;
    list.replaceChildren();
    if (gone) return;
    // Every player in the room, in the order the server chose — identical on
    // every screen and identical for every fact, so a name never moves.
    for (const opt of data.options || []) {
      list.append(h('button', {
        class: `vote-option${picked === opt.id ? ' chosen' : ''}`,
        onclick: () => { picked = opt.id; render(); },
      }, opt.name));
    }
  };

  root.append(
    counter, fact, mine, ask, list,
    h('div', { style: { marginTop: '10px', position: 'sticky', bottom: '10px' } }, btn)
  );
  render();
  return {
    collect: () => (picked && !data.hidden ? { factId: data.factId, pick: picked } : null),
    // The host pulled this fact off every screen.
    update: (next) => { data = next; render(); },
  };
}

// ---- Anagram Rush ----------------------------------------------------------

GameClients.anagram = {
  intro: 'Unscramble each word. Tap tiles or type your answer, then move on — the correct word is revealed after each turn.',
  start(root, ctx) {
    const scrambles = ctx.data.scrambles || [];
    const solved = [];
    let index = 0;
    let reviewing = false;
    const progress = h('div', { class: 'mash-count' }, '');
    const prompt = h('div', { style: { fontSize: '30px', fontWeight: '800', letterSpacing: '0.16em', textAlign: 'center', padding: '18px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: '8px' } });
    const tiles = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', margin: '14px 0' } });
    const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'type or tap letters', style: { textTransform: 'uppercase', textAlign: 'center', fontSize: '22px', letterSpacing: '0.08em' } });
    const note = h('div', { class: 'muted', style: { textAlign: 'center', margin: '8px 0' } });
    const submit = h('button', { class: 'big' }, 'Next word');
    const skip = h('button', { class: 'secondary' }, 'Skip');

    const setEnabled = (on) => { input.disabled = !on; submit.disabled = !on; skip.disabled = !on; };
    const advance = async (save) => {
      if (reviewing || index >= scrambles.length) return;
      const i = index;
      const word = save && input.value ? input.value : '';
      if (word) solved.push({ index: i, word });
      reviewing = true;
      setEnabled(false);
      // The intended word is a server secret, so ask the server for THIS
      // player's turn answer only. A null/failed reveal shows the correct
      // answer as unknown rather than fabricating one.
      let answer = null;
      try {
        const rev = typeof ctx.reveal === 'function' ? await ctx.reveal(i) : null;
        if (rev && typeof rev.answer === 'string') answer = rev.answer;
      } catch { /* reveal is advisory — never block advancing on it */ }
      turnFeedback(root, anagramFeedback(answer, word),
        () => {
          reviewing = false;
          index = i + 1;
          input.value = '';
          setEnabled(true);
          render();
        },
        { progress: `${i + 1} of ${scrambles.length}` });
    };
    const render = () => {
      progress.textContent = `${Math.min(index + 1, scrambles.length)} / ${scrambles.length}`;
      if (index >= scrambles.length) {
        prompt.textContent = 'done';
        tiles.replaceChildren();
        input.disabled = true;
        submit.disabled = true;
        skip.disabled = true;
        note.textContent = 'waiting on the room…';
        return;
      }
      const scramble = scrambles[index];
      prompt.textContent = scramble;
      tiles.replaceChildren(...[...scramble].map((letter) => h('button', {
        class: 'secondary', onclick: () => { input.value += letter; input.focus(); },
      }, letter)));
      note.textContent = 'Build an answer, then move on — the correct word is revealed after each turn.';
      input.focus();
    };
    submit.addEventListener('click', () => advance(true));
    skip.addEventListener('click', () => advance(false));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); advance(true); }
    });
    root.append(progress, prompt, tiles, input, note, h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } }, submit, skip));
    render();
    return { collect: () => ({ solved }) };
  },
};

// ---- 13. Typing Sprint -----------------------------------------------------

GameClients.typing = {
  intro: 'Type the sentence exactly. Net correct characters per minute wins. (Sorry, phones.)',
  start(root, ctx) {
    const sentence = ctx.data.sentence;
    const started = performance.now();
    const input = h('input', {
      type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: 'Type here…',
    });
    root.append(
      h('p', { style: { fontSize: '20px', lineHeight: '1.5', background: 'var(--bg2)', padding: '12px', borderRadius: '4px', border: '1px solid var(--line)' } }, sentence),
      input,
      h('div', { style: { marginTop: '10px' } },
        h('button', { class: 'big', onclick: done }, 'Done'))
    );
    input.focus();
    input.addEventListener('input', () => {
      if (input.value === sentence) done();
    });
    function done() {
      ctx.submit({ typed: input.value, elapsedMs: performance.now() - started });
    }
    return { collect: () => (input.value ? { typed: input.value, elapsedMs: performance.now() - started } : null) };
  },
};

// ---- 14. Space Mash --------------------------------------------------------

GameClients.spacemash = {
  intro: 'Mash SPACE or the button as fast as you can for 10 seconds. Holding a key does nothing.',
  start(root, ctx) {
    const { activeMs, capPerSec } = ctx.data;
    const counter = createPressCounter({ capPerSec });
    let phase = 'countdown';
    const countEl = h('div', { class: 'mash-count' }, '3');
    const btn = h('button', { class: 'bigbtn' }, 'GET READY');
    root.append(countEl, btn);

    // Touch path uses pointerdown, never click — mobile click delay would
    // halve a phone player's score (spec §14).
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (phase === 'active') {
        counter.pointerdown();
        countEl.textContent = String(counter.count);
      }
    });
    const onKeydown = (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault(); // stop page scroll
      if (phase !== 'active') return;
      counter.keydown(e.repeat);
      countEl.textContent = String(counter.count);
    };
    const onKeyup = (e) => {
      if (e.code === 'Space') counter.keyup();
    };
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('keyup', onKeyup);

    let n = 3;
    const cd = setInterval(() => {
      n--;
      if (n > 0) {
        countEl.textContent = String(n);
      } else {
        clearInterval(cd);
        phase = 'active';
        countEl.textContent = '0';
        btn.textContent = 'MASH!';
        btn.style.background = 'var(--accent)';
        btn.style.color = '#1a0512';
        btn.style.boxShadow = '0 0 24px rgba(255, 45, 149, 0.4)';
        setTimeout(() => {
          phase = 'done';
          btn.textContent = 'TIME!';
          btn.style.background = '';
          btn.style.color = '';
          btn.style.boxShadow = '';
          document.removeEventListener('keydown', onKeydown);
          document.removeEventListener('keyup', onKeyup);
          ctx.submit({ count: counter.count, flagged: counter.flagged });
        }, activeMs);
      }
    }, 800);
    return { collect: () => ({ count: counter.count, flagged: counter.flagged }) };
  },
};
// ---- 12. Slingshot (3D) -----------------------------------------------------
// Real 3D scene (three.js, vendored) with deterministic projectile physics:
// fixed-timestep integration, gravity, bounce and roll. No aim assists — you
// judge power and direction by eye, like a real slingshot. Scoring: resting
// distance from the bullseye (ft).

GameClients.slingshot = {
  intro: 'Drag anywhere to pull the pouch back — like a real slingshot, pull right to fire left. Release to shoot. The ball bounces and rolls; closest resting spot to the bullseye counts. Best of 5.',
  start(root, ctx) {
    const { distance: D, shots: SHOTS, rings } = ctx.data;

    // World units are feet: +z downrange to the target, +x right, +y up.
    const GRAV = 32.2;
    const MIN_POWER = 18;
    const MAX_POWER = 75;
    const ELEV = Math.PI / 4;      // fixed 45° elevation — power and aim are yours
    const RESTITUTION = 0.3;
    const FRICTION = 0.45;         // horizontal speed kept per bounce (grass, not ice)
    const ROLL_DECEL = 22;         // ft/s² while rolling on the ground
    const STOP_SPEED = 1.2;        // ft/s — slower than this on the ground = at rest
    const BALL_R = 0.35;
    const DT = 1 / 120;            // fixed physics step → same result on every device
    const POUCH_HOME = { x: 0, y: 3.0, z: 0 };
    const MAX_DRAG = 110;          // px of pull to full power — short throw = twitchy
    const AIM_PX_PER_RAD = 55;     // px of sideways pull per radian — small wobbles matter
    const MAX_AZ = 0.75;           // rad — max sideways aim

    const note = h('p', { class: 'trial-note center' }, 'Loading 3D scene…');
    root.append(note);

    let shot = 0;
    let best = null;
    let disposed = false;

    // Deterministic flight: integrate the whole path up front with the fixed
    // timestep, then animate along it.
    function simulate(v0, az) {
      const p = { ...POUCH_HOME };
      const v = {
        x: v0 * Math.cos(ELEV) * Math.sin(az),
        y: v0 * Math.sin(ELEV),
        z: v0 * Math.cos(ELEV) * Math.cos(az),
      };
      const pts = [{ ...p }];
      let rolling = false;
      let t = 0;
      while (t < 12) {
        if (!rolling) v.y -= GRAV * DT;
        p.x += v.x * DT;
        p.y += v.y * DT;
        p.z += v.z * DT;
        if (p.y <= BALL_R) {
          p.y = BALL_R;
          const hSpeed = Math.hypot(v.x, v.z);
          if (!rolling && v.y < -3) {
            v.y = -v.y * RESTITUTION;       // bounce
            v.x *= FRICTION;
            v.z *= FRICTION;
          } else {
            rolling = true;                 // too flat to bounce — roll it out
            v.y = 0;
            if (hSpeed <= STOP_SPEED) break;
            const k = Math.max(0, 1 - (ROLL_DECEL * DT) / hSpeed);
            v.x *= k;
            v.z *= k;
          }
        }
        pts.push({ ...p });
        t += DT;
      }
      return { pts, rest: { x: p.x, z: p.z } };
    }

    const launchFrom = (drag) => {
      const pull = Math.min(Math.max(drag.y, 0), MAX_DRAG);
      const power = pull / MAX_DRAG;
      return {
        power,
        v0: MIN_POWER + (MAX_POWER - MIN_POWER) * power,
        // Real slingshot mirror: pull back-right → ball fires screen-LEFT.
        // The camera looks down +z, which renders world +x on the screen's
        // left, so screen-left = world +x → az goes WITH drag.x here while
        // the pouch (world -x) visually follows the drag.
        az: clamp(drag.x / AIM_PX_PER_RAD, -MAX_AZ, MAX_AZ),
      };
    };

    import('/vendor/three.module.js')
      .then((THREE) => { if (!disposed) buildScene(THREE); })
      .catch(() => { note.textContent = 'Could not load the 3D engine — try reloading.'; });

    function buildScene(THREE) {
      // Fill the screen: full container width, and all the vertical room left
      // below the header/intro (kept to a sane aspect so ultrawide monitors
      // don't get a letterbox-thin strip of ground).
      const w = root.clientWidth || 680;
      const hgt = Math.max(240, Math.min(availHeight(root, 40), Math.round(w * 0.62)));
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, hgt);
      renderer.domElement.className = 'game';
      renderer.domElement.style.touchAction = 'none';
      root.insertBefore(renderer.domElement, note);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x05070d);
      scene.fog = new THREE.Fog(0x05070d, D * 2, D * 4 + 250);

      const camera = new THREE.PerspectiveCamera(55, w / hgt, 0.1, 2000);
      camera.position.set(0, 9, -16);
      camera.lookAt(0, 1, D * 0.7);

      scene.add(new THREE.HemisphereLight(0xa8e6ff, 0x0a1420, 1.15));
      const sun = new THREE.DirectionalLight(0xffffff, 1.3);
      sun.position.set(-40, 80, -30);
      scene.add(sun);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1400, 1400),
        new THREE.MeshLambertMaterial({ color: 0x0a141c })
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      const grid = new THREE.GridHelper(1400, 70, 0x0e3a4a, 0x0a2833);
      grid.position.y = 0.02;
      scene.add(grid);

      // Target: concentric rings flat on the ground, outer first (lowest).
      const ringCols = [0x531034, 0xff2d95, 0xffd23d, 0x00e5ff];
      [...rings].sort((a, b) => b - a).forEach((r, i) => {
        const ring = new THREE.Mesh(
          new THREE.CircleGeometry(r, 56),
          new THREE.MeshBasicMaterial({ color: ringCols[i % ringCols.length] })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0, 0.03 + i * 0.012, D);
        scene.add(ring);
      });
      const bull = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      bull.rotation.x = -Math.PI / 2;
      bull.position.set(0, 0.03 + rings.length * 0.012 + 0.01, D);
      scene.add(bull);

      // Slingshot: stem + two angled fork arms.
      const wood = new THREE.MeshLambertMaterial({ color: 0xd8a339 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.7, 10), wood);
      stem.position.set(0, 0.85, 0);
      scene.add(stem);
      const forkTips = [];
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.0, 10), wood);
        arm.position.set(side * 0.6, 2.4, 0);
        arm.rotation.z = -side * 0.55;
        scene.add(arm);
        forkTips.push(new THREE.Vector3(side * 1.1, 3.2, 0));
      }

      const bandMat = new THREE.LineBasicMaterial({ color: 0xffd23d });
      const bands = forkTips.map(() => {
        const line = new THREE.Line(new THREE.BufferGeometry(), bandMat);
        scene.add(line);
        return line;
      });
      const pouch = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 12),
        new THREE.MeshLambertMaterial({ color: 0xffd23d })
      );
      scene.add(pouch);

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_R, 20, 14),
        new THREE.MeshLambertMaterial({ color: 0xeef0ff })
      );
      ball.visible = false;
      scene.add(ball);

      const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffd23d });
      const setBands = (target) => {
        bands.forEach((line, i) => {
          line.geometry.setFromPoints([forkTips[i], target]);
        });
      };
      const pouchFor = (drag) => {
        const { power } = launchFrom(drag);
        // Same screen mapping as the azimuth: world -x renders screen-right.
        return new THREE.Vector3(
          clamp(-drag.x / 45, -2.4, 2.4),
          POUCH_HOME.y - power * 1.1,
          POUCH_HOME.z - power * 4.5
        );
      };

      // ---- input ------------------------------------------------------------
      const canvas = renderer.domElement;
      let dragging = false;
      let dragStart = null;
      let drag = { x: 0, y: 0 };
      let flight = null; // { pts, rest, startedAt }

      const updateAim = () => {
        const { power } = launchFrom(drag);
        const pouchPos = pouchFor(drag);
        pouch.position.copy(pouchPos);
        setBands(pouchPos);
        hud(power > 0.03 ? `power ${(power * 100).toFixed(0)}%` : undefined);
      };

      const resetPouch = () => {
        pouch.position.set(POUCH_HOME.x, POUCH_HOME.y, POUCH_HOME.z);
        setBands(pouch.position);
      };

      canvas.addEventListener('pointerdown', (e) => {
        if (shot >= SHOTS || flight) return;
        dragging = true;
        dragStart = canvasPos(canvas, e);
        drag = { x: 0, y: 0 };
        try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
        updateAim();
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const p = canvasPos(canvas, e);
        drag = { x: p.x - dragStart.x, y: p.y - dragStart.y };
        updateAim();
      });
      canvas.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        const { v0, az, power } = launchFrom(drag);
        if (power < 0.06) { resetPouch(); hud(); return; } // too soft — treat as cancel
        const sim = simulate(v0, az);
        flight = { ...sim, startedAt: performance.now() };
        ball.visible = true;
        resetPouch();
      });

      // ---- per-frame --------------------------------------------------------
      function hud(extra) {
        if (shot >= SHOTS) {
          note.textContent = `Done — best: ${best != null ? best.toFixed(1) : '—'} ft from the bullseye`;
          return;
        }
        note.textContent =
          `Shot ${shot + 1} of ${SHOTS} · target ${D} ft` +
          (best != null ? ` · best ${best.toFixed(1)} ft` : '') +
          (extra ? ` · ${extra}` : '');
      }

      function settleShot(rest) {
        const dist = Math.hypot(rest.x, rest.z - D);
        best = best == null ? dist : Math.min(best, dist);
        const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), ghostMat);
        ghost.position.set(rest.x, BALL_R, rest.z);
        scene.add(ghost);
        shot++;
        hud(`landed ${dist.toFixed(1)} ft away`);
        if (shot >= SHOTS) {
          setTimeout(() => { if (!disposed) ctx.submit({ best }); }, 900);
        }
      }

      function frame() {
        if (disposed || !canvas.isConnected) return;
        if (flight) {
          const idx = Math.floor((performance.now() - flight.startedAt) / 1000 / DT);
          if (idx >= flight.pts.length) {
            ball.visible = false;
            const { rest } = flight;
            flight = null;
            settleShot(rest);
          } else {
            const p = flight.pts[idx];
            ball.position.set(p.x, p.y, p.z);
          }
        }
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      }

      resetPouch();
      hud();
      frame();
    }

    return {
      collect: () => (best != null ? { best } : null),
    };
  },
};

// ---- 17. Balance the Beam ---------------------------------------------------
//
// A hand-caught broomstick: drag anywhere and the base (the carriage under
// the pivot) follows your finger; the virtual hand commands the pole toward
// the OPPOSITE side, so the base shoves under a rightward fall — drag TOWARD
// the fall to balance it (see shared/balance.js). Seeded nudges — derived
// from the round seed, identical on every device — kick the beam at
// escalating intervals and strength. Fail past 35°; score = survival time.
// The physics runs on a fixed 120Hz timestep driven by elapsed time, so a
// 30fps phone and a 120Hz laptop get identical dynamics (the slingshot
// pattern).

GameClients.balance = {
  intro: 'Slide the base to keep the beam inside the 35° arc — the nudges get worse.',
  start(root, ctx) {
    const { canvas, ctx: g, w, hgt } = makeCanvas(root, 300, 56);
    const pad = 30;
    const pivotY = hgt - 30;
    const lenPx = hgt * 0.52;                       // beam length in px (tip stays on canvas at 35°)
    const pxPerRad = (w / 2 - pad) / BALANCE_TARGET_RANGE; // rad → px (full drag sweep = ±TARGET_RANGE)
    const schedule = balanceSchedule(ctx.data.seed, { durationMs: ctx.duration });
    let state = balanceState();
    let elapsed = 0;                                // simulated ms (fixed-timestep)
    let survivedMs = 0;
    let nudgeIdx = 0;
    let dragging = false;
    let dragPx = w / 2;
    let acc = 0;
    let last = performance.now();
    let fallen = false;

    // Drag maps to a steer angle: dragging right (base sliding right) is
    // positive. Release recentres.
    const steerFromDrag = () =>
      dragging ? clamp((dragPx - w / 2) / pxPerRad, -BALANCE_TARGET_RANGE, BALANCE_TARGET_RANGE) : 0;

    // ---- input: drag anywhere, release to recentre -------------------------
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      const p = canvasPos(canvas, e);
      dragPx = clamp(p.x, pad, w - pad);
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = canvasPos(canvas, e);
      dragPx = clamp(p.x, pad, w - pad);
    });
    for (const ev of ['pointerup', 'pointercancel']) {
      canvas.addEventListener(ev, () => {
        dragging = false;
        dragPx = w / 2;
      });
    }
    canvas.style.touchAction = 'none';

    // ---- rendering ---------------------------------------------------------
    function draw() {
      g.clearRect(0, 0, w, hgt);
      // Fail wedge: the two 35° lines the beam must stay between.
      g.strokeStyle = 'rgba(255,84,112,0.30)';
      g.lineWidth = 2;
      for (const a of [-BALANCE_MAX_ANGLE, BALANCE_MAX_ANGLE]) {
        g.beginPath();
        g.moveTo(dragPx, pivotY);
        g.lineTo(dragPx + Math.sin(a) * lenPx * 1.45, pivotY - Math.cos(a) * lenPx * 1.45);
        g.stroke();
      }
      // Carriage: a thumb-friendly sled under the pivot, following the drag —
      // this is the BASE, and the physics treats the drag as sliding it.
      g.fillStyle = '#0e3a4a';
      g.strokeStyle = '#16303f';
      g.lineWidth = 2;
      const cw = 74, ch = 16;
      g.fillRect(dragPx - cw / 2, pivotY - 8, cw, ch);
      g.strokeRect(dragPx - cw / 2, pivotY - 8, cw, ch);
      // Beam.
      const tipX = dragPx + Math.sin(state.theta) * lenPx;
      const tipY = pivotY - Math.cos(state.theta) * lenPx;
      g.shadowColor = '#00e5ff';
      g.shadowBlur = 14;
      g.strokeStyle = '#00e5ff';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(dragPx, pivotY - 4);
      g.lineTo(tipX, tipY);
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = '#ffd23d';
      g.beginPath();
      g.arc(tipX, tipY, 7, 0, Math.PI * 2);
      g.fill();
      // Survival clock.
      g.fillStyle = '#d9faff';
      g.font = '700 26px system-ui, sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText(`${(elapsed / 1000).toFixed(1)}s`, 14, 10);
      g.fillStyle = '#7fb8cc';
      g.font = '13px system-ui, sans-serif';
      g.fillText('slide the base', w - 14, 16);
      g.textAlign = 'right';
    }

    // ---- fixed-timestep loop ----------------------------------------------
    function frame(now) {
      if (!canvas.isConnected) return;
      acc += Math.min(100, now - last);             // clamp a backgrounded tab
      last = now;
      let steps = 0;
      while (acc >= BALANCE_DT * 1000 && steps < 10) {
        // Kicks due at this simulated time — identical schedule, every device.
        while (nudgeIdx < schedule.length && schedule[nudgeIdx].atMs <= elapsed) {
          const n = schedule[nudgeIdx++];
          state.omega += n.impulse * n.dir;
        }
        const u = balanceControl(steerFromDrag(), state);
        state = balanceStep(state, BALANCE_DT, u);
        elapsed += BALANCE_DT * 1000;
        acc -= BALANCE_DT * 1000;
        steps++;
        if (Math.abs(state.theta) > BALANCE_MAX_ANGLE) {
          fallen = true;
          survivedMs = elapsed;
          break;
        }
      }
      draw();
      if (fallen) {
        ctx.submit({ survivedMs: Math.round(survivedMs) });
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      // Still upright at the deadline: you scored the whole round.
      collect: () => ({ survivedMs: Math.round(elapsed) }),
    };
  },
};

// ---- Fraction Face-Off -----------------------------------------------------

GameClients.fractions = {
  intro: 'Tap the bigger value. Each tap shows your pick and the larger value before the next pair. Wrong taps cost points.',
  start(root, ctx) {
    const pairs = ctx.data.pairs;
    const picks = [];
    let idx = 0;
    let correct = 0;
    let wrong = 0;
    let reviewing = false;
    const net = () => Math.max(0, correct - FRACTIONS_PENALTY * wrong);
    const scoreEl = h('div', { class: 'mash-count' }, '0');
    const hintEl = h('div', { class: 'muted', style: { textAlign: 'center' } }, 'tap the bigger one');
    const leftBtn = h('button', { class: 'fractions-side big' }, '');
    const rightBtn = h('button', { class: 'fractions-side big' }, '');
    const flash = (btn) => {
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 130);
    };
    const tap = (side, btn) => {
      if (reviewing || idx >= pairs.length) return;
      const pair = pairs[idx];
      const i = idx;
      picks.push(side);
      const mine = parseValue(pair.left) > parseValue(pair.right) ? 'left' : 'right';
      if (side === mine) correct++;
      else wrong++;
      scoreEl.textContent = String(net());
      flash(btn);
      idx++;
      reviewing = true;
      turnFeedback(root, fractionsFeedback(pair, side),
        () => { reviewing = false; render(); },
        { progress: `${i + 1} of ${pairs.length}`, autoMs: 1400 });
    };
    const render = () => {
      if (idx >= pairs.length) {
        leftBtn.textContent = rightBtn.textContent = 'done';
        hintEl.textContent = 'waiting on the room…';
        return;
      }
      leftBtn.textContent = pairs[idx].left;
      rightBtn.textContent = pairs[idx].right;
    };
    leftBtn.addEventListener('click', () => tap('left', leftBtn));
    rightBtn.addEventListener('click', () => tap('right', rightBtn));
    render();
    root.append(scoreEl, hintEl, leftBtn, rightBtn);
    return {
      // The scoreboard shows the server's authoritative net; correct/wrong
      // ride along for the host's display line (formatRaw).
      collect: () => ({ picks, correct, wrong }),
    };
  },
};
