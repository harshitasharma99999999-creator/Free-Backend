import { Router } from 'express';
import { requireFirebaseAuth } from '../middleware/auth.js';
import { upgradePlan, getUser } from '../utils/firestore.js';
import { env } from '../config/env.js';

const router = Router();

// POST /api/payments/create-checkout-session
// In production: integrate Stripe and return a real checkout URL.
// Currently: returns a simulated session with a mock checkout URL.
router.post('/create-checkout-session', requireFirebaseAuth, async (req, res) => {
  try {
    const { plan = 'pro' } = req.body;
    const validPlans = ['pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose pro or enterprise.' });
    }

    const user = await getUser(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // TODO: Replace with real Stripe checkout
    // const stripe = new Stripe(env.stripe.secretKey);
    // const session = await stripe.checkout.sessions.create({
    //   mode: 'subscription',
    //   payment_method_types: ['card'],
    //   line_items: [{ price: env.stripe.proPriceId, quantity: 1 }],
    //   success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${process.env.FRONTEND_URL}/pricing`,
    //   metadata: { userId: req.user.uid, plan },
    // });
    // return res.json({ checkoutUrl: session.url });

    // Simulated response for now
    const mockSessionId = 'mock_session_' + Date.now();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    res.json({
      checkoutUrl: `${frontendUrl}/billing/success?session_id=${mockSessionId}&plan=${plan}&simulated=true`,
      sessionId: mockSessionId,
      plan,
      note: 'This is a simulated checkout. Integrate Stripe to enable real payments.',
    });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/payments/webhook/success
// In production: verify Stripe webhook signature and upgrade user plan.
router.post('/webhook/success', async (req, res) => {
  try {
    // TODO: In production, verify Stripe signature:
    // const sig = req.headers['stripe-signature'];
    // const event = stripe.webhooks.constructEvent(req.rawBody, sig, env.stripe.webhookSecret);
    // const session = event.data.object;
    // const { userId, plan } = session.metadata;

    const { userId, plan, sessionId } = req.body;

    if (!userId || !plan) {
      return res.status(400).json({ error: 'Missing userId or plan in webhook payload' });
    }

    const validPlans = ['pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    await upgradePlan(userId, plan);

    console.log(`✓ User ${userId} upgraded to ${plan} (session: ${sessionId})`);
    res.json({ received: true, userId, plan });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// POST /api/payments/simulate-upgrade — dev-only simulated upgrade
router.post('/simulate-upgrade', requireFirebaseAuth, async (req, res) => {
  if (env.nodeEnv === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  const { plan = 'pro' } = req.body;
  await upgradePlan(req.user.uid, plan);
  const user = await getUser(req.user.uid);
  res.json({ message: `Upgraded to ${plan}`, user });
});

export default router;
