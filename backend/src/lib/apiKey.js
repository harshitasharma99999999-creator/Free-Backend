import { nanoid } from 'nanoid';

const PREFIX = 'fk_'; // free key
const KEY_LENGTH = 32;

export function generateApiKey() {
  return PREFIX + nanoid(KEY_LENGTH);
}

export function isValidApiKeyFormat(key) {
  return typeof key === 'string' && key.startsWith(PREFIX) && key.length === PREFIX.length + KEY_LENGTH;
}
