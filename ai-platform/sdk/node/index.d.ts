import OpenAI from 'openai';

export declare const EIOR_BASE_URL: string;

export declare class Eior extends OpenAI {
  constructor(options?: ConstructorParameters<typeof OpenAI>[0]);
}

export default Eior;
