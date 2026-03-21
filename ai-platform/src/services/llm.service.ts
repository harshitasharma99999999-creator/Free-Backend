import { config } from '../utils/config';
import { logger } from '../utils/logger';

// ── Content types (text + vision) ─────────────────────────────────────────────
export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

// ── Tool / function calling types ─────────────────────────────────────────────
export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatOptions {
  model?: string;
  tools?: Tool[];
  tool_choice?: ToolChoice;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface ChatResult {
  content: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: string;
  provider: 'ollama' | 'groq';
  tool_calls?: ToolCall[];
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  promptTokens: number;
}

// ── Eior model aliases → Ollama model IDs (primary) ───────────────────────────
const MODEL_ALIASES: Record<string, { ollama: string; groq: string }> = {
  'eior-chat':   { ollama: 'llama3.1:8b',         groq: 'moonshotai/kimi-k2-instruct-0905'           },
  'eior-fast':   { ollama: 'phi3:mini',             groq: 'llama-3.1-8b-instant'                       },
  'eior-vision': { ollama: 'llava:7b',              groq: 'meta-llama/llama-4-scout-17b-16e-instruct'  },
  'eior-code':   { ollama: 'qwen2.5-coder:7b',      groq: 'moonshotai/kimi-k2-instruct-0905'           },
  'eior-embed':  { ollama: 'nomic-embed-text',       groq: 'nomic-embed-text-v1.5'                      },
  'eior':        { ollama: 'llama3.1:8b',           groq: 'moonshotai/kimi-k2-instruct-0905'           },
};

const DEFAULT_ALIAS = 'eior-chat';

function resolveAlias(requested: string, hasImages: boolean): string {
  if (hasImages) return 'eior-vision';
  return requested in MODEL_ALIASES ? requested : DEFAULT_ALIAS;
}

function resolveOllamaModel(alias: string): string {
  return MODEL_ALIASES[alias]?.ollama ?? MODEL_ALIASES[DEFAULT_ALIAS].ollama;
}

function resolveGroqModel(alias: string): string {
  return MODEL_ALIASES[alias]?.groq ?? MODEL_ALIASES[DEFAULT_ALIAS].groq;
}

function detectImages(messages: ChatMessage[]): boolean {
  return messages.some(m =>
    Array.isArray(m.content) &&
    (m.content as ContentPart[]).some(p => p.type === 'image_url')
  );
}

function estTokens(messages: ChatMessage[]): number {
  return messages.reduce((acc, m) => {
    const text = typeof m.content === 'string'
      ? m.content ?? ''
      : Array.isArray(m.content)
        ? (m.content as ContentPart[]).map(p => p.text ?? '').join(' ')
        : '';
    return acc + Math.ceil(text.length / 4);
  }, 0);
}

// ── Ollama (primary — self-hosted) ────────────────────────────────────────────
async function callOllama(
  messages: ChatMessage[],
  ollamaModel: string,
  opts: { tools?: Tool[]; max_tokens?: number; temperature?: number; top_p?: number } = {}
): Promise<ChatResult> {
  // Flatten array content for Ollama text format; pass images via Ollama image field
  const ollamaMessages = messages.map(m => {
    if (typeof m.content === 'string' || m.content === null) {
      const msg: Record<string, unknown> = { role: m.role, content: m.content ?? '' };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      return msg;
    }
    const parts = m.content as ContentPart[];
    const textParts = parts.filter(p => p.type === 'text').map(p => p.text).join('\n');
    const images = parts.filter(p => p.type === 'image_url').map(p => {
      const url = p.image_url!.url;
      // Ollama expects base64 without data URI prefix for local images
      return url.startsWith('data:') ? url.split(',')[1] : url;
    });
    const msg: Record<string, unknown> = { role: m.role, content: textParts };
    if (images.length) msg.images = images;
    return msg;
  });

  const body: Record<string, unknown> = {
    model: ollamaModel,
    messages: ollamaMessages,
    stream: false,
    options: {
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts.top_p       !== undefined && { top_p:       opts.top_p       }),
      ...(opts.max_tokens  !== undefined && { num_predict:  opts.max_tokens  }),
    },
  };

  if (opts.tools?.length) body.tools = opts.tools;

  const res = await fetch(`${config.OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    message: { content: string; tool_calls?: ToolCall[] };
    prompt_eval_count?: number;
    eval_count?: number;
    done_reason?: string;
  };

  return {
    content:          data.message.content || null,
    tool_calls:       data.message.tool_calls,
    model:            ollamaModel,
    promptTokens:     data.prompt_eval_count ?? estTokens(messages),
    completionTokens: data.eval_count         ?? Math.ceil((data.message.content?.length ?? 0) / 4),
    finishReason:     data.done_reason === 'tool_calls' ? 'tool_calls' : 'stop',
    provider:         'ollama',
  };
}

// ── Groq (emergency fallback + tool calling) ──────────────────────────────────
async function callGroq(
  messages: ChatMessage[],
  groqModel: string,
  opts: { tools?: Tool[]; tool_choice?: ToolChoice; max_tokens?: number; temperature?: number; top_p?: number } = {}
): Promise<ChatResult> {
  if (!config.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured — Ollama is required');

  const body: Record<string, unknown> = { model: groqModel, messages };
  if (opts.tools?.length)          body.tools       = opts.tools;
  if (opts.tool_choice !== undefined) body.tool_choice = opts.tool_choice;
  if (opts.max_tokens  !== undefined) body.max_tokens  = opts.max_tokens;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.top_p       !== undefined) body.top_p       = opts.top_p;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    choices: [{ message: { content: string | null; tool_calls?: ToolCall[] }; finish_reason: string }];
    usage:   { prompt_tokens: number; completion_tokens: number };
    model:   string;
  };

  const choice = data.choices[0];
  return {
    content:          choice.message.content,
    tool_calls:       choice.message.tool_calls,
    model:            data.model,
    promptTokens:     data.usage.prompt_tokens,
    completionTokens: data.usage.completion_tokens,
    finishReason:     choice.finish_reason,
    provider:         'groq',
  };
}

// ── Public chat API ───────────────────────────────────────────────────────────
export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<ChatResult> {
  const { model, tools, tool_choice, max_tokens, temperature, top_p } = opts;
  const alias       = resolveAlias(model ?? DEFAULT_ALIAS, detectImages(messages));
  const ollamaModel = resolveOllamaModel(alias);
  const groqModel   = resolveGroqModel(alias);

  try {
    const result = await callOllama(messages, ollamaModel, { tools, max_tokens, temperature, top_p });
    return { ...result, model: alias };
  } catch (ollamaErr) {
    logger.warn({ ollamaErr }, 'Ollama unavailable — emergency fallback to Groq');
    try {
      const result = await callGroq(messages, groqModel, { tools, tool_choice, max_tokens, temperature, top_p });
      return { ...result, model: alias };
    } catch (groqErr) {
      logger.error({ groqErr }, 'Both Ollama and Groq failed');
      throw new Error('AI service temporarily unavailable. Please try again shortly.');
    }
  }
}

// ── Embeddings ────────────────────────────────────────────────────────────────
async function callOllamaEmbed(input: string[], model: string): Promise<EmbeddingResult> {
  // Ollama /api/embed (batch) - Ollama >= 0.3
  const res = await fetch(`${config.OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${await res.text()}`);

  const data = await res.json() as { embeddings: number[][]; prompt_eval_count?: number };
  return {
    embeddings:   data.embeddings,
    model,
    promptTokens: data.prompt_eval_count ?? Math.ceil(input.join(' ').length / 4),
  };
}

async function callGroqEmbed(input: string[], groqModel: string): Promise<EmbeddingResult> {
  if (!config.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

  const res = await fetch('https://api.groq.com/openai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: groqModel, input }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Groq embed ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    data:  { embedding: number[]; index: number }[];
    model: string;
    usage: { prompt_tokens: number; total_tokens: number };
  };

  return {
    embeddings:   data.data.sort((a, b) => a.index - b.index).map(d => d.embedding),
    model:        data.model,
    promptTokens: data.usage.prompt_tokens,
  };
}

export async function createEmbedding(
  input: string | string[],
  model = 'eior-embed'
): Promise<EmbeddingResult> {
  const inputs      = Array.isArray(input) ? input : [input];
  const ollamaModel = resolveOllamaModel(model === 'eior-embed' ? 'eior-embed' : 'eior-embed');
  const groqModel   = resolveGroqModel('eior-embed');

  try {
    return await callOllamaEmbed(inputs, ollamaModel);
  } catch (ollamaErr) {
    logger.warn({ ollamaErr }, 'Ollama embed unavailable — fallback to Groq');
    return await callGroqEmbed(inputs, groqModel);
  }
}

// ── Audio transcription via Groq Whisper ──────────────────────────────────────
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  mimeType: string,
  language?: string,
  prompt?: string,
): Promise<{ text: string; language?: string; duration?: number }> {
  if (!config.GROQ_API_KEY) throw new Error('GROQ_API_KEY required for audio transcription');

  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  form.append('file', blob, filename);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  if (language) form.append('language', language);
  if (prompt)   form.append('prompt', prompt);

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`Groq STT ${res.status}: ${await res.text()}`);

  const data = await res.json() as { text: string; language?: string; duration?: number };
  return { text: data.text, language: data.language, duration: data.duration };
}

// ── Audio translation (any language → English) ────────────────────────────────
export async function translateAudio(
  audioBuffer: Buffer,
  filename: string,
  mimeType: string,
  prompt?: string,
): Promise<{ text: string }> {
  if (!config.GROQ_API_KEY) throw new Error('GROQ_API_KEY required for audio translation');

  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  form.append('file', blob, filename);
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'json');
  if (prompt) form.append('prompt', prompt);

  const res = await fetch('https://api.groq.com/openai/v1/audio/translations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`Groq translate ${res.status}: ${await res.text()}`);

  const data = await res.json() as { text: string };
  return { text: data.text };
}

// ── Text-to-Speech via StreamElements (free) ──────────────────────────────────
// Voice mapping: OpenAI names → StreamElements voices
const TTS_VOICE_MAP: Record<string, string> = {
  alloy:   'Brian',
  echo:    'Matthew',
  fable:   'Brian',
  onyx:    'Joey',
  nova:    'Amy',
  shimmer: 'Emma',
};

export async function textToSpeech(
  text: string,
  voice = 'alloy',
  speed = 1.0,
): Promise<Buffer> {
  const seVoice  = TTS_VOICE_MAP[voice] ?? 'Brian';
  const encoded  = encodeURIComponent(text.slice(0, 3000));
  const url      = `https://api.streamelements.com/kappa/v2/speech?voice=${seVoice}&text=${encoded}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });

  if (!res.ok) throw new Error(`TTS ${res.status}: service unavailable`);

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Moderation ────────────────────────────────────────────────────────────────
// Simple heuristic moderation — no external API needed
interface ModerationCategories {
  hate: boolean;
  'hate/threatening': boolean;
  harassment: boolean;
  'harassment/threatening': boolean;
  'self-harm': boolean;
  'self-harm/intent': boolean;
  'self-harm/instructions': boolean;
  sexual: boolean;
  'sexual/minors': boolean;
  violence: boolean;
  'violence/graphic': boolean;
}

interface ModerationResult {
  flagged: boolean;
  categories: ModerationCategories;
  category_scores: Record<keyof ModerationCategories, number>;
}

const HATE_WORDS    = ['kill all', 'death to', 'genocide', 'exterminate'];
const SEXUAL_WORDS  = ['explicit sexual', 'pornography', 'nude minors'];
const VIOLENCE_WORDS = ['bomb making', 'how to make a bomb', 'mass shooting'];
const SELFHARM_WORDS = ['how to commit suicide', 'ways to self harm'];

function scoreCategory(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  const hits = keywords.filter(kw => lower.includes(kw)).length;
  return Math.min(1.0, hits * 0.4);
}

export function moderateText(input: string | string[]): ModerationResult[] {
  const inputs = Array.isArray(input) ? input : [input];
  return inputs.map(text => {
    const hateScore       = scoreCategory(text, HATE_WORDS);
    const sexualScore     = scoreCategory(text, SEXUAL_WORDS);
    const violenceScore   = scoreCategory(text, VIOLENCE_WORDS);
    const selfHarmScore   = scoreCategory(text, SELFHARM_WORDS);

    const categories: ModerationCategories = {
      hate:                    hateScore >= 0.4,
      'hate/threatening':      hateScore >= 0.8,
      harassment:              hateScore >= 0.4,
      'harassment/threatening': hateScore >= 0.8,
      'self-harm':             selfHarmScore >= 0.4,
      'self-harm/intent':      selfHarmScore >= 0.8,
      'self-harm/instructions': selfHarmScore >= 0.4,
      sexual:                  sexualScore >= 0.4,
      'sexual/minors':         sexualScore >= 0.8,
      violence:                violenceScore >= 0.4,
      'violence/graphic':      violenceScore >= 0.8,
    };

    const flagged = Object.values(categories).some(Boolean);

    const category_scores: Record<keyof ModerationCategories, number> = {
      hate:                    hateScore,
      'hate/threatening':      hateScore * 0.5,
      harassment:              hateScore,
      'harassment/threatening': hateScore * 0.5,
      'self-harm':             selfHarmScore,
      'self-harm/intent':      selfHarmScore * 0.5,
      'self-harm/instructions': selfHarmScore * 0.5,
      sexual:                  sexualScore,
      'sexual/minors':         sexualScore * 0.3,
      violence:                violenceScore,
      'violence/graphic':      violenceScore * 0.5,
    };

    return { flagged, categories, category_scores };
  });
}

export const textModels = () => [
  { id: 'eior-chat',   name: 'Eior Chat',   type: 'chat',      provider: 'eior' },
  { id: 'eior-fast',   name: 'Eior Fast',   type: 'chat',      provider: 'eior' },
  { id: 'eior-vision', name: 'Eior Vision', type: 'vision',    provider: 'eior' },
  { id: 'eior-code',   name: 'Eior Code',   type: 'chat',      provider: 'eior' },
  { id: 'eior-embed',  name: 'Eior Embed',  type: 'embedding', provider: 'eior' },
];
