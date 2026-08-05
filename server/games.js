// Server-side minigame definitions: roster metadata, per-round content
// generation (seeded, identical for every player), and metric computation.
// Metrics returned as `null` mean "treat as non-submission" (§4.6: P90 clamp,
// normalized 0, NOT auto-elimination).

import { randInt, shuffle, pick } from '../shared/rng.js';
import { rgbToLab, ciede2000 } from '../shared/ciede2000.js';
import { cleanEntryText, isUsableEntry, ENTRY_MAX_CHARS } from '../shared/textclean.js';
import { CUPS_BASE_CUPS, CUPS_MAX_LEVELS, cupsLevel } from '../shared/cups.js';
import { TRAY_SLOTS, trayLevel } from '../shared/tray.js';
import {
  BALANCE_GRAVITY,
  BALANCE_LENGTH,
  BALANCE_DAMPING,
  BALANCE_FIRST_NUDGE_MS,
} from '../shared/balance.js';
import { FRACTIONS_PENALTY, fractionsPairs } from '../shared/fractions.js';

const SENTENCES = [
  'The quick brown fox jumps over the lazy dog while the band plays on.',
  'Never trust an elevator that smells faintly of fresh paint and regret.',
  'Somewhere in this building a printer is jamming for no reason at all.',
  'A committee is a group that keeps minutes and loses hours every week.',
  'The wifi is strongest in the one room nobody ever wants to sit in.',
  'Please do not feed the seagulls; they have unionized and want snacks.',
  'My keyboard has a key that only works when I am not looking at it.',
  'The meeting could have been an email, and the email could have waited.',
  'Half of debugging is staring; the other half is apologizing to the code.',
  'If you can read this sentence quickly, your coffee is finally working.',
  'Our team synergy peaked the day the vending machine started working.',
  'I put my keys somewhere safe and now they are gone forever, obviously.',
  'The office plant has seen things no fern should ever have to witness.',
  'Reply all is a button that has ended more careers than we can count.',
  'My password is strong, unique, and written on a sticky note right here.',
  'The mute button works perfectly except when you actually need it most.',
  'The fastest way to find a typo is to hit send and wait three seconds.',
  'Our roadmap is less of a map and more of a vibe with quarterly labels.',
  'Nothing motivates a team like a deadline that was due yesterday.',
  'I have a filing system for my desktop: chaos, sorted alphabetically.',
  'The intern fixed in an hour what we argued about for eleven meetings.',
  'A watched progress bar never loads, but an ignored one fails silently.',
  'My calendar has back to back meetings about reducing meeting overload.',
  'The printer senses fear and jams accordingly during important demos.',
  'We renamed the folder final, then final two, then final for real now.',
  'Someone microwaved fish again and the whole floor is now in mourning.',
  'My browser has ninety tabs open and each one is a broken promise.',
  'The standup ran long because nobody could agree on what short means.',
  'Autocorrect has never once corrected a word into something better.',
  'The snack drawer is a shared resource governed by unspoken treaties.',
];

const ROOM_QUESTIONS = [
  'Have you ever fallen asleep in a meeting?',
  'Do you sing in the shower?',
  'Have you ever pretended your camera was broken to skip video?',
  'Do you eat pizza with a fork?',
  'Have you ever sent a message to the wrong chat?',
  'Do you make your bed every day?',
  'Have you ever laughed at a meme during a serious meeting?',
  'Do you still know your childhood phone number?',
  'Have you ever worn pajama pants on a video call?',
  'Do you talk to yourself out loud while working?',
  'Do you snooze your alarm more than twice?',
  'Have you ever returned a gift for the money?',
  'Have you ever blamed the wifi to escape a meeting that was going fine?',
  'Do you put ketchup on eggs?',
  'Have you ever eaten clearly-labeled food from the office fridge?',
  'Do you clap when the plane lands?',
  'Have you ever googled how to spell a word you use every day?',
  'Do you double-dip chips at parties?',
  'Have you ever waved back at someone who was not waving at you?',
  'Do you actually read the terms and conditions?',
  'Have you ever faked knowing a name for more than a month?',
  'Do you sleep with socks on?',
  'Have you ever cried at a commercial?',
  'Do you check your phone within one minute of waking up?',
  'Have you ever rehearsed an argument in the shower you never had?',
  'Do you own more than five houseplants?',
  'Have you ever liked your own post?',
  'Do you eat cereal for dinner?',
  'Have you ever practiced your coffee order before reaching the counter?',
  'Have you ever pushed a door that clearly said pull?',
  'Do you apologize to furniture when you bump into it?',
  'Have you ever faked a phone call to escape a conversation?',
  'Do you have a junk drawer you are slightly afraid to open?',
  'Have you ever re-gifted a present?',
  'Do you save the pizza crusts for last?',
  'Have you ever texted someone sitting in the same room?',
  'Do you have more than 1,000 unread emails?',
  'Do you believe in ghosts?',
  'Have you ever googled yourself?',
  'Do you hoard sauce packets in a drawer?',
  'Have you ever fake-laughed at the boss’s joke?',
  'Do you know every word of at least one 2000s pop song?',
  'Have you ever worn the same shirt on video calls two days in a row?',
  'Do you narrate your pet’s inner thoughts out loud?',
  'Have you ever missed a flight?',
  'Do you screenshot things you will never look at again?',
  'Have you ever joined a meeting from a bathroom?',
  'Do you think pineapple belongs on pizza?',
  'Have you ever said “you too” to a waiter who said “enjoy your meal”?',
  'Do you still count on your fingers?',
  'Have you ever pretended to take notes to look busy?',
  'Do you dance when nobody is watching?',
  'Have you ever locked yourself out of your own home?',
  'Do you keep cables for devices you no longer own?',
  'Have you ever cried during an animated movie as an adult?',
  'Do you talk to your plants?',
  'Have you ever eaten dessert before dinner as an adult?',
  'Do you replay conversations from years ago and cringe?',
  'Have you ever been on TV?',
  'Do you sleep with more than two pillows?',
  'Have you ever won a raffle?',
  'Do you use dark mode on everything?',
  'Have you ever briefly forgotten your own age?',
  'Do you keep your phone permanently on silent?',
  'Have you ever gone back home just to check the door was locked?',
  'Do you confidently sing lyrics that turn out to be wrong?',
  'Have you ever laughed so hard at work that you cried?',
  'Do you have an emergency snack within arm’s reach right now?',
  'Have you ever sent a voice message of pure silence by accident?',
  'Do you keep a box of old birthday cards?',
  'Have you ever said goodbye and then walked in the same direction?',
  'Do you re-check the fridge hoping new food has appeared?',
  'Have you ever fallen off a chair in public?',
  'Do you set alarms for weird times like 7:03?',
  'Have you ever called a teacher “mom” or a boss “dad”?',
  'Do you keep the box your phone came in?',
  'Have you ever watched an entire season in one day?',
  'Do you take the stairs only when someone is watching?',
  'Have you ever clapped alone at the end of a presentation?',
  'Do you own a kitchen gadget you have used exactly once?',
];

// Caption Battle stage-one prompts. Sentence-completions, not images: the
// answers stay short, comparable, and readable on a projector, and nothing
// here needs an asset pipeline. Work-meeting safe by construction.
const CAPTION_PROMPTS = [
  'The real reason this meeting exists:',
  'A terrible name for a team offsite:',
  'The email subject line nobody should ever send:',
  'What the office printer is thinking right now:',
  'The worst possible thing to say on a first day:',
  'A rejected slogan for this company:',
  'What the wifi password should actually be:',
  'The one agenda item that would fix everything:',
  'An honest job title for what you actually do:',
  'The last thing you want to hear on a video call:',
  'What the vending machine would say if it could talk:',
  'A five-star review of this meeting:',
  'The worst possible out-of-office message:',
  'What your calendar is secretly trying to tell you:',
  'A new rule that would improve every meeting:',
  'The most suspicious thing to find in the office fridge:',
  'What the mute button whispers when you forget it:',
  'A terrible motivational poster caption:',
  'The real translation of “let’s take this offline”:',
  'What this quarter’s roadmap actually looks like:',
  'A dreadful name for a productivity app:',
  'The unwritten rule everyone in this room follows:',
  'What the office plant has witnessed:',
  'A warning label this laptop should come with:',
  'The worst possible icebreaker question:',
  'What “quick sync” really means:',
  'A conspiracy theory about the coffee machine:',
  'The most useless superpower for office life:',
  'What the meeting room would name itself:',
  'A headline about today that nobody expected:',
];

// Icebreaker stage-one prompts. Every one of them has to ask for a TRUE fact
// about the player and nobody else — the whole game is the room guessing who
// wrote which one, so an invented answer breaks it rather than winning it.
// Work-meeting safe by construction: nothing here asks for anything a
// colleague would rather not have on a projector.
const ICEBREAKER_PROMPTS = [
  'A fun fact about you that nobody in this room knows:',
  'Something you have done that would surprise this room:',
  'A hidden talent of yours:',
  'The most unusual job you have ever had:',
  'A place you have been that nobody here would guess:',
  'Something you collected or were obsessed with as a kid:',
  'An award, trophy or certificate you actually own:',
  'The strangest food you have genuinely enjoyed:',
  'A skill you learned that never once came up at work:',
  'Something on your desk right now with a story behind it:',
  'A hobby of yours that surprises people:',
  'The closest you have come to being famous:',
  'An animal you have met that most people have not:',
  'A world record you could plausibly attempt:',
  'Something you are weirdly good at:',
  'A thing you have done exactly once and never again:',
];

// Metronome Blackout's tempo bank: every whole millisecond in 400–900ms that
// is NOT a whole number of BPM (60000 / intervalMs). A round 100 or 120 BPM is
// something a player can type into any metronome app; 673ms is not, and it has
// to be matched in phase as well as tempo, inside one 45-second round. That
// makes the obvious external tool impractical rather than impossible — an
// accepted trade, and the honest version of "you cannot cheat this".
const METRONOME_INTERVALS = [];
for (let ms = 400; ms <= 900; ms++) if (60000 % ms !== 0) METRONOME_INTERVALS.push(ms);

// Vanishing Tray (issue #11): twelve items sit on a tray for five seconds,
// then some are swapped for new ones. The whole round — which glyphs, which
// slots change, what they change to — is a pure function of the round seed,
// derived in shared/tray.js (the single source both the client and the server
// import). Emoji render differently per platform, and that is fine: identity
// is what is scored, not appearance, so near-identical pairs and
// skin-tone / variation-selector families are excluded there.

export const ROSTER = [
  { key: 'rgb', name: 'RGB Color Match', category: 'perceptual', type: 'error' },
  { key: 'oddoneout', name: 'Odd One Out', category: 'perceptual', type: 'score' },
  { key: 'bisect', name: 'Bisect the Line', category: 'perceptual', type: 'error' },
  { key: 'trace', name: 'Trace the Shape', category: 'perceptual', type: 'error' },
  { key: 'dots', name: 'Dots in the Jar', category: 'numerical', type: 'error' },
  { key: 'stopclock', name: 'Stop the Clock', category: 'timing', type: 'error' },
  { key: 'metronome', name: 'Metronome Blackout', category: 'timing', type: 'error' },
  { key: 'gridflash', name: 'Grid Flash', category: 'memory', type: 'error' },
  { key: 'tray', name: 'Vanishing Tray', category: 'memory', type: 'error' },
  { key: 'cups', name: 'Follow the Cup', category: 'attention', type: 'score' },
  { key: 'readroom', name: 'Read the Room', category: 'social', type: 'error' },
  { key: 'caption', name: 'Caption Battle', category: 'social', type: 'score', stages: 2 },
  { key: 'icebreaker', name: 'Icebreaker', category: 'social', type: 'score', stages: 'variable' },
  { key: 'typing', name: 'Typing Sprint', category: 'motor', type: 'score', keyboardOnly: true },
  { key: 'spacemash', name: 'Space Mash', category: 'motor', type: 'score' },
  { key: 'slingshot', name: 'Slingshot', category: 'motor', type: 'error' },
  { key: 'balance', name: 'Balance the Beam', category: 'motor', type: 'score' },
  { key: 'fractions', name: 'Fraction Face-Off', category: 'numerical', type: 'score' },
];

export const ROSTER_BY_KEY = new Map(ROSTER.map((g) => [g.key, g]));
export const NEEDS_AGGREGATION = new Set(['readroom', 'caption', 'icebreaker']);
// Games whose later stages are built out of stage one's submissions. Every
// stage is still played by ALL players at once — this is not a turn-based
// mechanic. `stages` on the roster is 2 for a fixed two-stage game and
// 'variable' for one whose length depends on what the room submitted
// (Icebreaker runs one guessing stage per fun fact).
export const MULTI_STAGE = new Set(['caption', 'icebreaker']);

// A guessing stage is "which of these 20 names is it" — it does not need a
// whole minigame slot, and Icebreaker runs one per player in the room.
const ICEBREAKER_STAGE_SCALE = 0.5;

// How many entries one player may vote for in a voting stage. Vote-based
// scoring concentrates hard — a room of 20 puts its votes on 3–4 captions and
// everyone else ties at the floor for a whole game. Multiple votes per player
// (issue #12, option 1) flattens the distribution so mid-tier entries separate
// from zero. Clamped down when the pool is too small to spend them on anyone
// but yourself.
const VOTES_PER_PLAYER = 3;
export const votesForPool = (poolSize) =>
  Math.max(1, Math.min(VOTES_PER_PLAYER, poolSize - 1));

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Pick an index into a content list, avoiding repeats within a session.
function pickContent(rng, listLen, usedSet) {
  let candidates = [];
  for (let i = 0; i < listLen; i++) if (!usedSet.has(i)) candidates.push(i);
  if (!candidates.length) candidates = [...Array(listLen).keys()];
  const idx = candidates[Math.floor(rng() * candidates.length)];
  usedSet.add(idx);
  return idx;
}

// Build the per-round data for a game. `clientData` is broadcast to players;
// `secret` stays server-side (answers).
// ctx: { rng, config, used } — `used` maps content-list name -> Set of indices.
export function buildGameData(key, ctx) {
  const { rng, config, used } = ctx;
  const usedSet = (name) => {
    if (!used[name]) used[name] = new Set();
    return used[name];
  };
  switch (key) {
    case 'rgb': {
      // Mid-saturation / mid-lightness targets — near-black and near-white
      // compress the perceptual scale.
      const target = { r: randInt(rng, 50, 205), g: randInt(rng, 50, 205), b: randInt(rng, 50, 205) };
      return { clientData: { target }, secret: { target } };
    }
    case 'oddoneout':
      return { clientData: { seed: `odd-${Math.floor(rng() * 1e9)}` }, secret: {} };
    case 'bisect': {
      const targets = [];
      while (targets.length < 5) {
        const t = randInt(rng, 7, 93);
        if (!targets.some((x) => Math.abs(x - t) < 4)) targets.push(t);
      }
      return { clientData: { targets }, secret: { targets } };
    }
    case 'trace':
      return {
        clientData: {
          shape: pick(rng, [
            'spiral', 'star', 'wave', 'zigzag', 'infinity',
            'heart', 'circle', 'triangle', 'square', 'diamond',
            'hourglass', 'hexagon', 'bolt', 'arrow', 'cross',
          ]),
          seed: `trace-${Math.floor(rng() * 1e9)}`,
        },
        secret: {},
      };
    case 'dots': {
      const counts = [randInt(rng, 22, 40), randInt(rng, 90, 150), randInt(rng, 300, 500)];
      return { clientData: { counts, seed: `dots-${Math.floor(rng() * 1e9)}` }, secret: { counts } };
    }
    case 'stopclock': {
      // Random target 6.0–10.0s (half-second steps) so nobody can pre-train
      // a single interval.
      const targetMs = randInt(rng, 12, 20) * 500;
      return { clientData: { targetMs, visibleMs: 3000, attempts: 2 }, secret: {} };
    }
    case 'metronome':
      // Four beats play, then silence, and the player taps the next eight.
      // There is no secret half: intervalMs implies the whole grid, and the
      // player has just heard it — hiding it would hide nothing.
      return {
        clientData: { intervalMs: pick(rng, METRONOME_INTERVALS), leadInBeats: 4, silentBeats: 8 },
        secret: {},
      };
    case 'gridflash': {
      // 6–9 lit cells per round — pattern size varies between sessions.
      const patterns = [0, 1].map(() =>
        shuffle(rng, [...Array(25).keys()]).slice(0, randInt(rng, 6, 9)).sort((a, b) => a - b));
      return { clientData: { patterns, showMs: 4000 }, secret: { patterns } };
    }
    case 'tray': {
      // 12 glyphs for 5 seconds, then 2–4 are swapped for new ones. The seed
      // derives the whole round — the client re-derives the swapped tray
      // locally the way cups/oddoneout derive their layouts — so there is no
      // mid-game emit (the engine has none for minigames). The metric is still
      // computed server-side from `secret`.
      const seed = `tray-${Math.floor(rng() * 1e9)}`;
      const { items, changed, replacements } = trayLevel(seed);
      return { clientData: { items, seed, showMs: 5000 }, secret: { changed, replacements } };
    }
    case 'cups':
      // One seed, every level. The client derives each level's swap script from
      // it and animates that; the server derives the same script to score. No
      // secret half — a level's answer is on screen for as long as its shuffle
      // lasts, so there is nothing here that hiding could keep.
      return {
        clientData: {
          seed: `cups-${Math.floor(rng() * 1e9)}`,
          maxLevels: CUPS_MAX_LEVELS,
          baseCups: CUPS_BASE_CUPS,
        },
        secret: {},
      };
    case 'readroom': {
      const idx = pickContent(rng, ROOM_QUESTIONS.length, usedSet('readroom'));
      return { clientData: { question: ROOM_QUESTIONS[idx] }, secret: {} };
    }
    case 'caption': {
      // Stage one only. The stages after it are buildStages' job — they are
      // made out of what the room actually wrote.
      const idx = pickContent(rng, CAPTION_PROMPTS.length, usedSet('caption'));
      return {
        clientData: { prompt: CAPTION_PROMPTS[idx], maxChars: ENTRY_MAX_CHARS },
        secret: {},
      };
    }
    case 'icebreaker': {
      // Stage one only: everyone writes one true fact about themselves. The
      // guessing stages are built out of those facts, one stage per fact.
      const idx = pickContent(rng, ICEBREAKER_PROMPTS.length, usedSet('icebreaker'));
      return {
        clientData: { prompt: ICEBREAKER_PROMPTS[idx], maxChars: ENTRY_MAX_CHARS },
        secret: {},
      };
    }
    case 'typing': {
      const idx = pickContent(rng, SENTENCES.length, usedSet('typing'));
      return { clientData: { sentence: SENTENCES[idx] }, secret: { sentence: SENTENCES[idx] } };
    }
    case 'spacemash':
      return { clientData: { activeMs: 10000, capPerSec: 20 }, secret: {} };
    case 'slingshot': {
      // Jitter the host's base distance ±25% so range-finding stays a skill.
      const distance = clamp(Math.round(config.slingshotDistance * (0.75 + rng() * 0.5)), 30, 150);
      return {
        clientData: { distance, shots: 5, rings: [2, 5, 10, 20] },
        secret: {},
      };
    }
    case 'balance': {
      // Inverted pendulum kept upright by dragging its base. The seed derives
      // the whole nudge schedule (shared/balance.js, identical on every
      // device); the physics constants travel with the round so they are
      // auditable on the host screen. There is no secret half — the metric is
      // survival time, clamped server-side, the same trust model stopclock
      // and slingshot already run on.
      return {
        clientData: {
          seed: `balance-${Math.floor(rng() * 1e9)}`,
          gravity: BALANCE_GRAVITY,
          length: BALANCE_LENGTH,
          damping: BALANCE_DAMPING,
          nudgeEveryMs: BALANCE_FIRST_NUDGE_MS,
        },
        secret: {},
      };
    }
    case 'fractions': {
      // A seeded stream of two-choice comparisons; the numeric values stay
      // server-side. clientData carries only the rendered text (the stream is
      // a pure function of the seed) and the secret is the per-pair answer,
      // positionally matched to payload.picks. The calculator-on-every-device
      // surface is stated, not hidden, in shared/fractions.js.
      const seed = `fractions-${Math.floor(rng() * 1e9)}`;
      const pairs = fractionsPairs(seed);
      return {
        clientData: { pairs: pairs.map((p) => ({ left: p.left, right: p.right })) },
        secret: { answers: pairs.map((p) => p.answer) },
      };
    }
    default:
      throw new Error(`unknown game key ${key}`);
  }
}

// Build every stage that follows stage one, out of stage one's submissions.
// entries: [{ playerId, payload }] — every stage-one submission received.
// ctx: { rng, clientData, players, config } where clientData is STAGE ONE's
// data and players is [{ id, name }] for the whole room.
//
// Returns an ARRAY of stage descriptors — { clientData, secret, stageName,
// reveal, durationScale } — played in the order returned, or null when there
// is not enough material to run any of them (the caller scores stage one
// instead). Never throws on a degenerate pool: a room where nobody typed
// anything still has to reach a scores screen.
export function buildStages(key, entries, ctx) {
  const { rng, clientData, players = [] } = ctx;
  if (key === 'icebreaker') {
    // Same moderation pass as any other pooled player text — these strings go
    // on a projector one at a time.
    const usable = entries
      .map((e) => ({ playerId: e.playerId, text: cleanEntryText(e.payload?.text) }))
      .filter((e) => isUsableEntry(e.text));
    // 0 or 1 facts: there is nothing to guess between. Skip the guessing.
    if (usable.length < 2) return null;
    // ONE seeded shuffle, server-side, broadcast one stage at a time: every
    // player is served the identical fact list in the identical order, which
    // is what makes the room's out-loud discussion and the host's reveal line
    // up on every screen.
    const facts = shuffle(rng, usable);
    // The candidate list is every player in the room — including yourself,
    // including anyone who never wrote a fact — in one order that is the same
    // on every screen and for every fact, so a name never moves under a
    // thumb mid-game. The same name can be picked for any number of facts;
    // only the correct ones score.
    const options = shuffle(rng, players).map((p) => ({ id: p.id, name: p.name }));
    return facts.map((f, i) => ({
      stageName: `Fun fact ${i + 1} of ${facts.length}`,
      reveal: true,
      durationScale: ICEBREAKER_STAGE_SCALE,
      clientData: {
        factId: `f${i}`,
        text: f.text,
        round: i + 1,
        totalRounds: facts.length,
        options,
        hidden: false,
      },
      // Whose fact it is stays server-side until the host reveals it — that
      // reveal is the entire point of the game.
      secret: { answer: f.playerId },
    }));
  }
  if (key === 'caption') {
    // Moderation happens HERE, once, on the way into the pool: everything
    // downstream (host projector, player screens, the reveal) reads these
    // strings and nothing else.
    const usable = entries
      .map((e) => ({ playerId: e.playerId, text: cleanEntryText(e.payload?.text) }))
      .filter((e) => isUsableEntry(e.text));
    // 0 or 1 captions: there is nothing to choose between. Skip stage two.
    if (usable.length < 2) return null;
    // Shuffled so pool order leaks neither submission order nor authorship,
    // and ids are positional in the shuffled pool for the same reason.
    const shuffled = shuffle(rng, usable);
    const owners = {};
    const pool = shuffled.map((e, i) => {
      const id = `e${i}`;
      owners[id] = e.playerId;
      return { id, text: e.text };
    });
    return [{
      clientData: {
        prompt: clientData?.prompt ?? '',
        entries: pool,
        votesPerPlayer: votesForPool(pool.length),
        hidden: [],          // entry ids the host has pulled off the screen
      },
      // Authorship stays server-side for the whole voting stage — the pool is
      // anonymous, which is both safer and funnier, and it is what makes
      // self-vote rejection a server-side check by playerId.
      secret: { owners },
    }];
  }
  throw new Error(`game ${key} has no stages after the first`);
}

// ---- Icebreaker -------------------------------------------------------------
//
// Stage 1: everyone writes one true fun fact about themselves. Stages 2…N+1:
// one fact at a time, in the same order on every screen, with the whole room
// as the candidate list. Everyone locks a guess before anyone sees the next
// fact; between facts the room argues out loud and the host reveals the
// answer. Metric = correct guesses.
//
// `stages` is this game's stages so far, oldest first, each shaped
// { stage, clientData, secret, entries } — the room's own stage objects,
// flattened. Walking them is the only source of truth for both the
// between-fact reveal and the final scoring.
function icebreakerTally(stages = []) {
  const correct = new Map();   // playerId -> facts guessed right
  const played = new Set();    // anyone who wrote a fact or locked a guess
  const rounds = [];
  for (const s of stages) {
    const entries = s.entries || [];
    if ((s.stage || 1) === 1) {
      for (const e of entries) {
        if (isUsableEntry(cleanEntryText(e.payload?.text))) played.add(e.playerId);
      }
      continue;
    }
    // A fact the host pulled off the screen scores nobody — the guesses made
    // before it vanished are not the players' fault, so they are voided
    // rather than counted wrong.
    const hidden = !!s.clientData?.hidden;
    const answer = s.secret?.answer ?? null;
    const picks = [];
    for (const e of entries) {
      played.add(e.playerId);
      const pickedId = typeof e.payload?.pick === 'string' ? e.payload.pick : null;
      if (!pickedId) continue;
      const ok = !hidden && pickedId === answer;
      if (ok) correct.set(e.playerId, (correct.get(e.playerId) || 0) + 1);
      picks.push({ playerId: e.playerId, pickedId, correct: ok });
    }
    rounds.push({
      round: s.clientData?.round ?? rounds.length + 1,
      totalRounds: s.clientData?.totalRounds ?? null,
      text: hidden ? '' : (s.clientData?.text || ''),
      hidden,
      playerId: hidden ? null : answer,
      picks,
    });
  }
  return { correct, played, rounds };
}

// The between-facts screen. Returns two payloads for the same fact: `teaser`
// goes out the moment the fact closes (the room discusses and calls it out
// loud), `answer` goes out when the host presses Next. The answer is NOT in
// the teaser — it is broadcast to every device, and a player reading their
// own socket would otherwise have it before the room does.
export function buildReveal(key, stages = []) {
  if (key !== 'icebreaker') return null;
  const closed = stages[stages.length - 1];
  if (!closed || (closed.stage || 1) === 1) return null;
  const { correct, rounds } = icebreakerTally(stages);
  const here = rounds[rounds.length - 1];
  if (!here) return null;
  const common = {
    round: here.round,
    totalRounds: here.totalRounds,
    text: here.text,
    hidden: here.hidden,
    guessed: here.picks.length,
  };
  const tally = new Map();
  for (const p of here.picks) tally.set(p.pickedId, (tally.get(p.pickedId) || 0) + 1);
  return {
    teaser: common,
    answer: {
      ...common,
      playerId: here.playerId,
      // Who the room picked, most-picked first — the shape of the argument.
      tally: [...tally.entries()]
        .map(([playerId, count]) => ({ playerId, count }))
        .sort((a, b) => b.count - a.count),
      // Every player's own line: what they picked, whether it landed, and how
      // many they have right so far. Each device renders only its own row.
      guesses: here.picks.map((p) => ({
        playerId: p.playerId,
        pickedId: p.pickedId,
        correct: p.correct,
        rightSoFar: correct.get(p.playerId) || 0,
      })),
    },
  };
}

// Compute the raw metric for one player's submission. Returns null for
// "counts as non-submission". Payloads are untrusted — validate and clamp.
export function computeMetric(key, payload, secret, clientData, config) {
  if (!payload || typeof payload !== 'object') return null;
  switch (key) {
    case 'rgb': {
      const r = num(payload.r);
      const g = num(payload.g);
      const b = num(payload.b);
      if (r == null || g == null || b == null) return null;
      const guess = { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
      return ciede2000(rgbToLab(secret.target), rgbToLab(guess));
    }
    case 'oddoneout': {
      const c = num(payload.cleared);
      if (c == null) return null;
      return clamp(Math.floor(c), 0, 300);
    }
    case 'bisect': {
      if (!Array.isArray(payload.guesses)) return null;
      const targets = secret.targets;
      let any = false;
      let sum = 0;
      for (let i = 0; i < targets.length; i++) {
        const g = num(payload.guesses[i]);
        if (g == null) {
          sum += 50; // missed sub-trial: worst plausible deviation
        } else {
          any = true;
          sum += Math.abs(clamp(g, 0, 100) - targets[i]);
        }
      }
      return any ? sum : null;
    }
    case 'trace': {
      const dev = num(payload.deviation);
      const cov = num(payload.coverage);
      // Spec: require >= 90% path coverage or the attempt scores P90.
      if (dev == null || cov == null || cov < 0.9) return null;
      return clamp(dev, 0, 2);
    }
    case 'dots': {
      if (!Array.isArray(payload.guesses)) return null;
      const truths = secret.counts;
      let any = false;
      let sum = 0;
      for (let i = 0; i < truths.length; i++) {
        const g = num(payload.guesses[i]);
        if (g == null || g < 0) {
          sum += 1; // missing trial = 100% relative error
        } else {
          any = true;
          // Relative error so the big-magnitude trial doesn't dominate (§6.3).
          sum += clamp(Math.abs(g - truths[i]) / truths[i], 0, 5);
        }
      }
      return any ? sum : null;
    }
    case 'stopclock': {
      const best = num(payload.best);
      if (best == null || best < 0) return null;
      return clamp(best, 0, 60000);
    }
    case 'metronome': {
      // payload.offsets: ms from the LAST lead-in beat to each tap, in the
      // order they were made, so the nth scored beat is due at intervalMs * n.
      //
      // Taps are consumed IN ORDER rather than matched to whichever beat they
      // happen to sit nearest. That is the whole defence against mashing: the
      // eighth tap is judged against the eighth beat wherever it landed, so
      // filling the window with taps buys a worse average, never a better one.
      if (!Array.isArray(payload.offsets)) return null;
      const { intervalMs, silentBeats } = clientData;
      const taps = payload.offsets
        .map((v) => num(v))
        .filter((v) => v != null)
        .slice(0, silentBeats);   // extra taps past the last beat are ignored
      // Not one usable tap: this player did not play the game. Scoring them as
      // maximally bad would drag the P90 clamp for everyone who did (§4 —
      // normalize across the players who played it), so they are a
      // non-submission, the same way bisect treats an all-blank sheet.
      if (!taps.length) return null;
      let sum = 0;
      for (let i = 0; i < silentBeats; i++) {
        // A beat never tapped costs one full interval — exactly what the most
        // wrong possible tap costs, so skipping a beat is never the cheaper
        // option, and one wild tap cannot swamp seven good ones.
        const dev = i < taps.length ? Math.abs(taps[i] - intervalMs * (i + 1)) : intervalMs;
        sum += Math.min(dev, intervalMs);
      }
      return sum / silentBeats;   // mean absolute deviation, ms; ≤ intervalMs
    }
    case 'gridflash': {
      if (!Array.isArray(payload.picks)) return null;
      let total = 0;
      for (let r = 0; r < secret.patterns.length; r++) {
        const pattern = new Set(secret.patterns[r]);
        const raw = Array.isArray(payload.picks[r]) ? payload.picks[r] : [];
        const picks = new Set(
          raw.filter((c) => Number.isInteger(c) && c >= 0 && c < 25).slice(0, 25)
        );
        let diff = 0;
        for (const c of pattern) if (!picks.has(c)) diff++;
        for (const c of picks) if (!pattern.has(c)) diff++;
        total += diff;
      }
      return total;
    }
    case 'tray': {
      // Symmetric difference: (changed slots missed) + (unchanged slots wrongly
      // flagged). Flagging everything scores 12 - nSwaps errors, which is worse
      // than a real attempt — blanket-tapping is never a winning strategy.
      if (!Array.isArray(payload.picks)) return null;
      const changed = new Set(secret.changed);
      const picks = new Set(
        payload.picks
          .filter((c) => Number.isInteger(c) && c >= 0 && c < TRAY_SLOTS)
          .slice(0, TRAY_SLOTS)
      );
      let diff = 0;
      for (const c of changed) if (!picks.has(c)) diff++;
      for (const c of picks) if (!changed.has(c)) diff++;
      return diff;
    }
    case 'cups': {
      // payload.picks: [{ level, cupIndex }] in the order they were tapped.
      //
      // The walk re-derives every level from the round seed and stops at the
      // first pick that is not a correct answer to the level it is standing on.
      // Three things are checked rather than believed, because all three are
      // free to forge in a payload: that the run starts at level 1 and climbs
      // one at a time (so no ladder can be skipped), that the cup index is a
      // real cup on THAT level's table (3–5 of them, and it grows), and that it
      // is the cup the ball is actually under. Anything else — junk, a gap, a
      // repeat — ends the walk exactly where a miss would.
      if (!Array.isArray(payload.picks)) return null;
      const { seed, maxLevels, baseCups } = clientData;
      let cleared = 0;
      for (const entry of payload.picks) {
        if (cleared >= maxLevels) break;
        if (!entry || typeof entry !== 'object') break;
        const level = cleared + 1;
        if (entry.level !== level) break;
        const plan = cupsLevel(seed, level, { baseCups });
        const idx = entry.cupIndex;
        if (!Number.isInteger(idx) || idx < 0 || idx >= plan.cups) break;
        if (idx !== plan.ball) break;
        cleared++;
      }
      // Zero is a real score, not a non-submission: a wrong tap on level 1 and
      // never tapping at all are the same outcome — no level cleared — and
      // there is no partial credit inside a level for one of them to have more
      // of than the other. Same convention as oddoneout's `{ cleared: 0 }`.
      return cleared;
    }
    case 'typing': {
      const typed = typeof payload.typed === 'string' ? payload.typed.slice(0, 500) : null;
      if (typed == null || !typed.length) return null;
      const s = secret.sentence;
      let correct = 0;
      let errors = 0;
      for (let i = 0; i < typed.length; i++) {
        if (i < s.length && typed[i] === s[i]) correct++;
        else errors++;
      }
      const elapsed = clamp(num(payload.elapsedMs) ?? config.gameDuration, 3000, Math.max(3000, config.gameDuration));
      const cpm = correct / (elapsed / 60000);
      return Math.max(0, cpm - 5 * errors);
    }
    case 'spacemash': {
      const c = num(payload.count);
      if (c == null) return null;
      const cap = Math.ceil((clientData.capPerSec * clientData.activeMs) / 1000);
      return clamp(Math.floor(c), 0, cap);
    }
    case 'slingshot': {
      const best = num(payload.best);
      if (best == null || best < 0) return null;
      return clamp(best, 0, 500);
    }
    case 'balance': {
      // Survival time. The server can only sanity-clamp (no replay
      // verification) — the payload is a single number bounded by the
      // deadline, so the worst case is a player claiming the maximum, the
      // same trust model stopclock and slingshot already run on. Negative or
      // missing = non-submission; 0 = fell instantly, a real score.
      const s = num(payload.survivedMs);
      if (s == null || s < 0) return null;
      return clamp(s, 0, config.gameDuration || 45000);
    }
    case 'fractions': {
      // Net = correct − PENALTY × wrong, clamped at 0 so a pure guesser
      // scores near zero rather than half. Picks match the answer list
      // positionally; entries past the stream's end and anything that is not
      // 'left'|'right' are skipped, not counted wrong. The payload's own
      // correct/wrong fields are display-only — this is the authoritative sum.
      if (!payload || !Array.isArray(payload.picks)) return null;
      const answers = secret && Array.isArray(secret.answers) ? secret.answers : [];
      let correct = 0;
      let wrong = 0;
      const n = Math.min(payload.picks.length, answers.length);
      for (let i = 0; i < n; i++) {
        const pick = payload.picks[i];
        if (pick !== 'left' && pick !== 'right') continue;
        if (pick === answers[i]) correct++;
        else wrong++;
      }
      return Math.max(0, correct - FRACTIONS_PENALTY * wrong);
    }
    default:
      return null;
  }
}

// Social games need every submission before anyone can be scored.
// entries: [{ playerId, payload }] — the submissions of the stage that just
// closed. ctx: { clientData, secret } of that same stage, plus `stages` (every
// stage of this game, oldest first) for games scored across all of them.
// Returns { metrics: Map, extra }.
export function aggregateGame(key, entries, ctx = {}) {
  if (key === 'caption') return aggregateCaption(entries, ctx);
  if (key === 'icebreaker') return aggregateIcebreaker(ctx);
  if (key === 'readroom') {
    const valid = entries.filter((e) => e.payload && typeof e.payload.answer === 'boolean');
    const metrics = new Map();
    if (!valid.length) return { metrics, extra: { actualPct: null } };
    const yes = valid.filter((e) => e.payload.answer).length;
    const actualPct = (100 * yes) / valid.length;
    for (const e of valid) {
      const pred = num(e.payload.prediction);
      if (pred == null) continue; // answered but never predicted → non-submission
      metrics.set(e.playerId, Math.abs(clamp(pred, 0, 100) - actualPct));
    }
    return { metrics, extra: { actualPct: Math.round(actualPct) } };
  }
  throw new Error(`game ${key} does not aggregate`);
}

// Caption Battle scoring. Metric = votes received, so a player's score comes
// entirely from what the room picked. Two shapes arrive here:
//
//   - stage two closed (ctx.secret.owners present): `entries` are ballots.
//   - stage two never ran, because fewer than two people wrote anything:
//     `entries` are the stage-one captions and nobody voted on anything.
//
// Only players who put a caption in the pool are scored; a player who joined
// between the stages and only voted is a non-submitter for this game and
// scores 0, exactly like a missed submission anywhere else.
function aggregateCaption(entries, ctx) {
  const owners = ctx?.secret?.owners || null;
  const prompt = ctx?.clientData?.prompt ?? null;

  if (!owners) {
    const metrics = new Map();
    const board = [];
    for (const e of entries) {
      const text = cleanEntryText(e.payload?.text);
      if (!isUsableEntry(text)) continue;
      metrics.set(e.playerId, 0);
      board.push({ entryId: null, playerId: e.playerId, text, votes: 0, hidden: false });
    }
    return { metrics, extra: { prompt, board, votesPerPlayer: 0, voters: 0, skipped: true } };
  }

  const pool = Array.isArray(ctx?.clientData?.entries) ? ctx.clientData.entries : [];
  const hidden = new Set(ctx?.clientData?.hidden || []);
  const perVoter = Math.max(1, Math.floor(Number(ctx?.clientData?.votesPerPlayer) || 1));
  const tally = new Map(pool.map((e) => [e.id, 0]));

  let voters = 0;
  for (const e of entries) {
    const ballot = Array.isArray(e.payload?.votes) ? e.payload.votes : [];
    const used = new Set();
    for (const raw of ballot) {
      if (used.size >= perVoter) break;
      const id = typeof raw === 'string' ? raw : null;
      if (!id || used.has(id)) continue;              // padded or duplicated ballot
      if (!tally.has(id) || hidden.has(id)) continue; // unknown or pulled entry
      if (owners[id] === e.playerId) continue;        // self-vote — by playerId, server-side
      used.add(id);
      tally.set(id, tally.get(id) + 1);
    }
    if (used.size) voters++;
  }

  const metrics = new Map();
  const board = [];
  for (const entry of pool) {
    const isHidden = hidden.has(entry.id);
    const votes = isHidden ? 0 : (tally.get(entry.id) || 0);
    const owner = owners[entry.id];
    if (owner != null) metrics.set(owner, (metrics.get(owner) || 0) + votes);
    board.push({ entryId: entry.id, playerId: owner ?? null, text: entry.text, votes, hidden: isHidden });
  }
  board.sort((a, b) => b.votes - a.votes);
  return { metrics, extra: { prompt, board, votesPerPlayer: perVoter, voters, skipped: false } };
}

// Icebreaker scoring: one point per fact matched to the right person, summed
// over every guessing stage. Anyone who wrote a fact or locked a single guess
// is scored (possibly at 0) — only a player who did neither is a
// non-submitter. A player's own fact is a gimme, and deliberately so: everyone
// in the room has exactly one, so it cancels out and nobody has to be told
// their own name is greyed out mid-game.
function aggregateIcebreaker(ctx) {
  const { correct, played, rounds } = icebreakerTally(ctx?.stages || []);
  const metrics = new Map();
  for (const id of played) metrics.set(id, correct.get(id) || 0);
  return {
    metrics,
    extra: {
      // The reveal table: every fact, whose it was, and how the room did on
      // it. Names are attached by the room at the last moment.
      rounds: rounds.map((r) => ({
        round: r.round,
        text: r.text,
        hidden: r.hidden,
        playerId: r.playerId,
        rightCount: r.picks.filter((p) => p.correct).length,
        guessCount: r.picks.length,
      })),
      // 0 facts means the guessing never ran — fewer than two people wrote
      // anything, so there was nothing to guess between.
      facts: rounds.length,
      skipped: rounds.length === 0,
    },
  };
}

// Human-readable raw value for the reveal screens.
export function formatRaw(key, metric, payload) {
  if (metric == null) {
    // A player who joined between the stages voted but never wrote a caption:
    // still a 0, but "no submission" would read as a bug to them.
    if (key === 'caption' && Array.isArray(payload?.votes) && payload.votes.length) {
      return 'voted — no caption';
    }
    return 'no submission';
  }
  switch (key) {
    case 'rgb': return `ΔE ${metric.toFixed(1)}`;
    case 'oddoneout': return `${metric} tiles`;
    case 'bisect': return `${metric.toFixed(1)} pts off`;
    case 'trace': return `${(metric * 100).toFixed(1)}% dev`;
    case 'dots': return `${(metric * 100).toFixed(0)}% off`;
    case 'stopclock': return `${Math.round(metric)} ms off`;
    case 'metronome': return `${Math.round(metric)} ms avg off`;
    case 'gridflash': return `${metric} cells off`;
    case 'tray': return `${metric} wrong`;
    case 'cups': return `level ${metric}`;
    case 'readroom': return `${metric.toFixed(0)} pts off`;
    case 'caption': return `${metric} vote${metric === 1 ? '' : 's'}`;
    case 'icebreaker': return `${metric} right`;
    case 'typing': return `${Math.round(metric)} net cpm`;
    case 'spacemash': return `${metric} presses${payload?.flagged ? ' ⚠' : ''}`;
    case 'slingshot': return `${metric.toFixed(1)} ft`;
    case 'balance': return `${(metric / 1000).toFixed(1)}s upright`;
    case 'fractions': {
      const correct = Number.isFinite(payload?.correct) ? payload.correct : 0;
      const wrong = Number.isFinite(payload?.wrong) ? payload.wrong : 0;
      return `${metric} net (${correct}✓ ${wrong}✗)`;
    }
    default: return String(metric);
  }
}
