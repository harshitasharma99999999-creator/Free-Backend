import { config } from '../utils/config';
import { logger } from '../utils/logger';

export interface ImageOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  n?: number;
}

export interface ImageResult {
  images: string[];   // URLs (Replicate) or data:image/png;base64,... (A1111)
  model: string;
  provider: 'automatic1111' | 'replicate';
}

// ── Automatic1111 (local Stable Diffusion) ────────────────────────────────────
async function callA1111(opts: ImageOptions): Promise<ImageResult> {
  const res = await fetch(`${config.SD_BASE_URL}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt:          opts.prompt,
      negative_prompt: opts.negativePrompt ?? 'blurry, low quality, deformed, bad anatomy',
      width:           opts.width  ?? 1024,
      height:          opts.height ?? 1024,
      batch_size:      opts.n      ?? 1,
      steps:           25,
      cfg_scale:       7,
      sampler_name:    'DPM++ 2M Karras',
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`A1111 ${res.status}: ${await res.text()}`);

  const data = await res.json() as { images: string[] };

  return {
    images:   data.images.map(b64 => `data:image/png;base64,${b64}`),
    model:    config.SD_MODEL,
    provider: 'automatic1111',
  };
}

// ── Replicate SDXL (cloud fallback) ──────────────────────────────────────────
async function callReplicate(opts: ImageOptions): Promise<ImageResult> {
  if (!config.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured');

  const res = await fetch(
    'https://api.replicate.com/v1/models/stability-ai/sdxl/predictions',
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${config.REPLICATE_API_TOKEN}`,
        'Prefer':        'wait=60',
      },
      body: JSON.stringify({
        input: {
          prompt:          opts.prompt,
          negative_prompt: opts.negativePrompt,
          width:           opts.width  ?? 1024,
          height:          opts.height ?? 1024,
          num_outputs:     opts.n      ?? 1,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    }
  );

  if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);

  const prediction = await res.json() as { output?: string[] };
  return {
    images:   prediction.output ?? [],
    model:    'stability-ai/sdxl',
    provider: 'replicate',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateImage(opts: ImageOptions): Promise<ImageResult> {
  try {
    return await callA1111(opts);
  } catch (err) {
    logger.warn({ err }, 'Automatic1111 unavailable — falling back to Replicate');
    return callReplicate(opts);
  }
}

export const imageModels = () => [
  { id: config.SD_MODEL, name: 'Stable Diffusion (Local)', type: 'image', provider: 'automatic1111' },
  ...(config.REPLICATE_API_TOKEN
    ? [{ id: 'stability-ai/sdxl', name: 'SDXL (Replicate)', type: 'image', provider: 'replicate' }]
    : []),
];
