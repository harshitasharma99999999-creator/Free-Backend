import { config } from '../utils/config';
import { logger } from '../utils/logger';

export interface VideoOptions {
  prompt: string;
  duration?: number; // seconds (1–10)
}

export interface VideoResult {
  videoUrl: string;
  model: string;
  provider: 'replicate';
  status: 'completed';
}

type PredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

interface ReplicatePrediction {
  id: string;
  status: PredictionStatus;
  output?: string | string[];
  error?: string;
}

export async function generateVideo(opts: VideoOptions): Promise<VideoResult> {
  if (!config.REPLICATE_API_TOKEN) {
    throw new Error('Video generation requires REPLICATE_API_TOKEN to be set.');
  }

  // ── Create prediction ──────────────────────────────────────────────────────
  const createRes = await fetch(
    'https://api.replicate.com/v1/models/wan-ai/wan2.1-t2v-480p/predictions',
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${config.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        input: {
          prompt:             opts.prompt,
          max_area:           '480*832',
          fast_mode:          'Balanced',
          num_frames:         Math.max(16, (opts.duration ?? 5) * 16),
          frames_per_second:  16,
          sample_steps:       30,
          sample_guide_scale: 5,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!createRes.ok) {
    throw new Error(`Replicate create failed: ${createRes.status} ${await createRes.text()}`);
  }

  const prediction = await createRes.json() as ReplicatePrediction;

  // ── Poll until done (max 5 minutes) ───────────────────────────────────────
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5_000));

    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      { headers: { 'Authorization': `Bearer ${config.REPLICATE_API_TOKEN}` } }
    );

    const poll = await pollRes.json() as ReplicatePrediction;
    logger.debug({ id: prediction.id, status: poll.status }, 'Video generation status');

    if (poll.status === 'succeeded') {
      const url = Array.isArray(poll.output) ? poll.output[0] : poll.output;
      if (!url) throw new Error('Replicate returned no video URL');
      return { videoUrl: url, model: 'wan-ai/wan2.1-t2v-480p', provider: 'replicate', status: 'completed' };
    }

    if (poll.status === 'failed' || poll.status === 'canceled') {
      throw new Error(`Video generation ${poll.status}: ${poll.error ?? 'unknown error'}`);
    }
  }

  throw new Error('Video generation timed out after 5 minutes');
}

export const videoModels = () =>
  config.REPLICATE_API_TOKEN
    ? [{ id: 'wan-ai/wan2.1-t2v-480p', name: 'WAN 2.1 T2V 480p', type: 'video', provider: 'replicate' }]
    : [];
