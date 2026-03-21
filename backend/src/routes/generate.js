import { Router } from 'express';
import axios from 'axios';
import { requireApiKey } from '../middleware/apiKeyAuth.js';
import { generationLimiter } from '../middleware/rateLimiter.js';
import { deductCredits } from '../utils/credits.js';
import { env } from '../config/env.js';

const router = Router();

// ─── Replicate helper ─────────────────────────────────────────────────────────

async function runReplicatePrediction(modelVersion, input) {
  if (!env.replicate.apiToken) {
    throw new Error('REPLICATE_API_TOKEN is not configured on the server.');
  }

  // Create prediction
  const createRes = await axios.post(
    'https://api.replicate.com/v1/predictions',
    { version: modelVersion, input },
    {
      headers: {
        Authorization: `Bearer ${env.replicate.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  let prediction = createRes.data;

  // Poll until the prediction completes (max 120 seconds)
  const maxAttempts = 40;
  let attempts = 0;
  while (
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled' &&
    attempts < maxAttempts
  ) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await axios.get(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      {
        headers: { Authorization: `Bearer ${env.replicate.apiToken}` },
        timeout: 10000,
      }
    );
    prediction = pollRes.data;
    attempts++;
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || 'unknown error'}`);
  }

  return prediction.output;
}

// ─── POST /api/v1/generate-image ─────────────────────────────────────────────

router.post('/generate-image', generationLimiter, requireApiKey, async (req, res) => {
  const { prompt, width = 1024, height = 1024, negativePrompt = '' } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
  }
  if (prompt.length > 1000) {
    return res.status(400).json({ error: 'prompt must be 1000 characters or fewer' });
  }

  // Deduct credits before calling provider (fail fast if none left)
  const creditResult = await deductCredits(req.user.uid, req.apiKey, 'image');
  if (!creditResult.success) {
    return res.status(creditResult.status).json({
      error: creditResult.error,
      imageCreditsRemaining: req.user.imageCredits,
    });
  }

  try {
    const output = await runReplicatePrediction(env.replicate.imageModel, {
      prompt: prompt.trim(),
      negative_prompt: negativePrompt,
      width,
      height,
      num_inference_steps: 30,
      guidance_scale: 7.5,
    });

    const imageUrl = Array.isArray(output) ? output[0] : output;

    res.json({
      success: true,
      imageUrl,
      prompt: prompt.trim(),
      model: 'stable-diffusion-xl',
      creditsUsed: env.creditCost.image,
      imageCreditsRemaining: creditResult.user.imageCredits,
    });
  } catch (err) {
    console.error('Image generation error:', err.message);
    // Refund credit on provider failure
    const user = creditResult.user;
    const { updateUserCredits } = await import('../utils/firestore.js');
    await updateUserCredits(req.user.uid, user.imageCredits + env.creditCost.image, user.videoCredits);

    res.status(502).json({
      error: 'Image generation failed',
      detail: err.message,
    });
  }
});

// ─── POST /api/v1/generate-video ─────────────────────────────────────────────

router.post('/generate-video', generationLimiter, requireApiKey, async (req, res) => {
  const { prompt, fps = 24, numFrames = 24, negativePrompt = '' } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
  }
  if (prompt.length > 500) {
    return res.status(400).json({ error: 'prompt must be 500 characters or fewer' });
  }

  const creditResult = await deductCredits(req.user.uid, req.apiKey, 'video');
  if (!creditResult.success) {
    return res.status(creditResult.status).json({
      error: creditResult.error,
      videoCreditsRemaining: req.user.videoCredits,
    });
  }

  try {
    const output = await runReplicatePrediction(env.replicate.videoModel, {
      prompt: prompt.trim(),
      negative_prompt: negativePrompt,
      fps,
      num_frames: numFrames,
      num_inference_steps: 50,
      guidance_scale: 17.5,
    });

    const videoUrl = Array.isArray(output) ? output[0] : output;

    res.json({
      success: true,
      videoUrl,
      prompt: prompt.trim(),
      model: 'zeroscope-v2-xl',
      creditsUsed: env.creditCost.video,
      videoCreditsRemaining: creditResult.user.videoCredits,
    });
  } catch (err) {
    console.error('Video generation error:', err.message);
    const user = creditResult.user;
    const { updateUserCredits } = await import('../utils/firestore.js');
    await updateUserCredits(req.user.uid, user.imageCredits, user.videoCredits + env.creditCost.video);

    res.status(502).json({
      error: 'Video generation failed',
      detail: err.message,
    });
  }
});

export default router;
