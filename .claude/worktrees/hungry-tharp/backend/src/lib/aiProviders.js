import axios from 'axios';
import { config } from '../config.js';

/**
 * Generate an image using Replicate's API.
 * Uses the Stable Diffusion XL model by default.
 * @param {string} prompt - Text prompt for image generation
 * @returns {Promise<{imageUrl: string, provider: string, model: string}>}
 */
export async function generateImageViaReplicate(prompt) {
  const token = config.replicate.apiToken;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  // Create a prediction using SDXL
  const createRes = await axios.post(
    'https://api.replicate.com/v1/predictions',
    {
      // Stable Diffusion XL model
      version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      input: {
        prompt,
        width: 1024,
        height: 1024,
        num_outputs: 1,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  const predictionId = createRes.data.id;

  // Poll for completion (max 120 seconds)
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const pollRes = await axios.get(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      }
    );

    const { status, output, error } = pollRes.data;

    if (status === 'succeeded' && output?.length > 0) {
      return {
        imageUrl: output[0],
        provider: 'replicate',
        model: 'sdxl',
      };
    }

    if (status === 'failed' || status === 'canceled') {
      throw new Error(error || `Prediction ${status}`);
    }
  }

  throw new Error('Image generation timed out');
}

/**
 * Generate an image using HuggingFace Inference API.
 * Uses Stable Diffusion v2-1 by default.
 * @param {string} prompt - Text prompt for image generation
 * @returns {Promise<{imageUrl: string, provider: string, model: string}>}
 */
export async function generateImageViaHuggingFace(prompt) {
  const token = config.huggingface.apiToken;
  if (!token) {
    throw new Error('HUGGINGFACE_API_TOKEN is not configured');
  }

  const res = await axios.post(
    'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
    { inputs: prompt },
    {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
      timeout: 120000,
    }
  );

  // Convert buffer to base64 data URL
  const base64 = Buffer.from(res.data).toString('base64');
  const imageUrl = `data:image/png;base64,${base64}`;

  return {
    imageUrl,
    provider: 'huggingface',
    model: 'stable-diffusion-2-1',
  };
}

/**
 * Generate a video using Replicate's API.
 * Uses the Stable Video Diffusion model.
 * @param {string} prompt - Text prompt for video generation
 * @returns {Promise<{videoUrl: string, provider: string, model: string}>}
 */
export async function generateVideoViaReplicate(prompt) {
  const token = config.replicate.apiToken;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  // Use a text-to-video model (minimax video-01)
  const createRes = await axios.post(
    'https://api.replicate.com/v1/predictions',
    {
      version: 'c8bcc4751328608bb75043b3af6e3fcc65c2ff75a9dbbf3e6c81a008a5a969c9',
      input: {
        prompt,
        num_frames: 25,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  const predictionId = createRes.data.id;

  // Poll for completion (max 300 seconds — video takes longer)
  const maxAttempts = 150;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const pollRes = await axios.get(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      }
    );

    const { status, output, error } = pollRes.data;

    if (status === 'succeeded') {
      const videoUrl = typeof output === 'string' ? output : output?.[0] || output;
      return {
        videoUrl,
        provider: 'replicate',
        model: 'text-to-video',
      };
    }

    if (status === 'failed' || status === 'canceled') {
      throw new Error(error || `Prediction ${status}`);
    }
  }

  throw new Error('Video generation timed out');
}

/**
 * Pick the best available provider for image generation.
 * Prefers Replicate, falls back to HuggingFace.
 */
export async function generateImage(prompt) {
  if (config.replicate.apiToken) {
    return generateImageViaReplicate(prompt);
  }
  if (config.huggingface.apiToken) {
    return generateImageViaHuggingFace(prompt);
  }
  throw new Error('No AI provider configured. Set REPLICATE_API_TOKEN or HUGGINGFACE_API_TOKEN.');
}

/**
 * Pick the best available provider for video generation.
 */
export async function generateVideo(prompt) {
  if (config.replicate.apiToken) {
    return generateVideoViaReplicate(prompt);
  }
  throw new Error('No video provider configured. Set REPLICATE_API_TOKEN.');
}
