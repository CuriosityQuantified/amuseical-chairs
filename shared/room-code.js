// Room-code rules shared by the server and player browser.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function normalizeRoomCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return code.length === 4 && [...code].every((character) => CODE_ALPHABET.includes(character))
    ? code
    : null;
}
