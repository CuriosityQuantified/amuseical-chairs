import { randInt, shuffle } from './rng.js';

export const FLAGS_ROUNDS = 10;
export const FLAGS_OPTIONS = 8;

export function flagRounds(catalog, rng) {
  if (!Array.isArray(catalog) || catalog.length < FLAGS_ROUNDS * FLAGS_OPTIONS) throw new Error('flag catalog is too small');
  const available = [...catalog];
  const rounds = [];
  for (let round = 0; round < FLAGS_ROUNDS; round++) {
    const targetIndex = randInt(rng, 0, available.length - 1);
    const target = available.splice(targetIndex, 1)[0];
    const distractors = shuffle(rng, available).slice(0, FLAGS_OPTIONS - 1);
    const options = shuffle(rng, [target, ...distractors]);
    rounds.push({ image: target.asset, options: options.map((flag) => flag.name), target: target.name });
  }
  return rounds;
}

export function validFlagChoices(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.choices)) return null;
  if (payload.choices.length !== FLAGS_ROUNDS) return null;
  return payload.choices.map((choice) => {
    if (!Number.isInteger(choice) || choice < 0 || choice >= FLAGS_OPTIONS) return -1;
    return choice;
  });
}
