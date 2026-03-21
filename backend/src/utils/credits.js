import { getUser, updateUserCredits, logUsage, incrementKeyUsage } from './firestore.js';
import { env } from '../config/env.js';

/**
 * Deduct credits for a generation request.
 * Returns { success, error, user } — if success is false, the caller should respond with 402.
 */
export async function deductCredits(uid, apiKey, type) {
  const user = await getUser(uid);
  if (!user) return { success: false, error: 'User not found', status: 404 };

  const cost = env.creditCost[type];
  if (cost === undefined) return { success: false, error: 'Unknown generation type', status: 400 };

  if (type === 'image') {
    if (user.imageCredits <= 0) {
      return { success: false, error: 'No image credits remaining. Please upgrade your plan.', status: 402 };
    }
    const newImageCredits = user.imageCredits - cost;
    await updateUserCredits(uid, newImageCredits, user.videoCredits);

    await logUsage({ userId: uid, apiKey, type: 'image', provider: 'replicate', cost });
    await incrementKeyUsage(apiKey);

    return { success: true, user: { ...user, imageCredits: newImageCredits } };
  }

  if (type === 'video') {
    if (user.videoCredits <= 0) {
      return { success: false, error: 'No video credits remaining. Please upgrade your plan.', status: 402 };
    }
    const newVideoCredits = user.videoCredits - cost;
    await updateUserCredits(uid, user.imageCredits, newVideoCredits);

    await logUsage({ userId: uid, apiKey, type: 'video', provider: 'replicate', cost });
    await incrementKeyUsage(apiKey);

    return { success: true, user: { ...user, videoCredits: newVideoCredits } };
  }

  return { success: false, error: 'Unknown type', status: 400 };
}
