import OpenAI from 'openai';

const EIOR_BASE_URL = 'https://api-production-2b12.up.railway.app/v1';

/**
 * Eior AI client — synchronous/async OpenAI-compatible SDK.
 *
 * @example
 * import Eior from 'eior';
 *
 * const client = new Eior({ apiKey: 'sk-your-key' });
 *
 * const response = await client.chat.completions.create({
 *   model: 'eior-chat',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * console.log(response.choices[0].message.content);
 */
export class Eior extends OpenAI {
  constructor({ apiKey, baseURL = EIOR_BASE_URL, ...rest } = {}) {
    super({ apiKey, baseURL, ...rest });
  }
}

export default Eior;
export { EIOR_BASE_URL };
