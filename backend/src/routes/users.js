import { Router } from 'express';
import { requireFirebaseAuth } from '../middleware/auth.js';
import { getUser, getUserUsageLogs } from '../utils/firestore.js';

const router = Router();

// GET /api/users/me — get current user profile + credits
router.get('/me', requireFirebaseAuth, async (req, res) => {
  try {
    const user = await getUser(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('GET /users/me error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// GET /api/users/usage — last 50 usage logs for current user
router.get('/usage', requireFirebaseAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await getUserUsageLogs(req.user.uid, limit);
    res.json({ logs });
  } catch (err) {
    console.error('GET /users/usage error:', err);
    res.status(500).json({ error: 'Failed to fetch usage logs' });
  }
});

export default router;
