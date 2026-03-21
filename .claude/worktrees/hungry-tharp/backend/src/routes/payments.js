import { config } from '../config.js';

/**
 * Payment routes — checkout session creation and webhook handler.
 * This is a placeholder integration. Replace the simulated logic with
 * your actual payment provider (Stripe, Razorpay, Lemon Squeezy, etc.).
 */
export default async function paymentRoutes(fastify) {
  const getUsers = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return db.collection('users');
  };

  // ─── POST /create-checkout-session ─────────────────────────────────
  // Called by the frontend when user clicks "Upgrade to Pro"
  fastify.post('/create-checkout-session', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['plan'],
        properties: {
          plan: { type: 'string', enum: ['pro', 'enterprise'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            checkoutUrl: { type: 'string' },
            sessionId: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { plan } = request.body;
      const userId = request.user.id;

      // TODO: Replace with actual payment provider integration
      // Example with Stripe:
      //   const session = await stripe.checkout.sessions.create({
      //     mode: 'subscription',
      //     line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      //     success_url: `${config.apiBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      //     cancel_url: `${config.apiBaseUrl}/pricing`,
      //     metadata: { userId, plan },
      //   });
      //   return { checkoutUrl: session.url, sessionId: session.id };

      // Simulated checkout — returns a fake session URL
      const sessionId = `sim_${Date.now()}_${userId}`;
      const frontendUrl = config.cors.origins[0] || 'http://localhost:3000';
      const checkoutUrl = `${frontendUrl}/billing/success?session_id=${sessionId}&plan=${plan}`;

      return reply.send({ checkoutUrl, sessionId });
    },
  });

  // ─── POST /webhook/payment-success ─────────────────────────────────
  // Called by the payment provider on successful payment.
  // In production, verify the webhook signature from your provider.
  fastify.post('/webhook/payment-success', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'plan'],
        properties: {
          userId: { type: 'string' },
          plan: { type: 'string', enum: ['pro', 'enterprise'] },
          sessionId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                plan: { type: 'string' },
                imageCredits: { type: 'number' },
                videoCredits: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      let users;
      try {
        users = getUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const { userId, plan } = request.body;

      // TODO: Verify webhook signature from your payment provider
      // Example with Stripe:
      //   const sig = request.headers['stripe-signature'];
      //   const event = stripe.webhooks.constructEvent(request.rawBody, sig, WEBHOOK_SECRET);

      const planConfig = config.plans[plan];
      if (!planConfig) {
        return reply.code(400).send({ error: `Unknown plan: ${plan}` });
      }

      // Upgrade user plan and add credits
      let oid;
      try {
        oid = fastify.mongo.ObjectId(userId);
      } catch {
        return reply.code(400).send({ error: 'Invalid userId' });
      }

      const result = await users.updateOne(
        { _id: oid },
        {
          $set: {
            plan,
            imageCredits: planConfig.imageCredits,
            videoCredits: planConfig.videoCredits,
            upgradedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return reply.send({
        success: true,
        user: {
          plan,
          imageCredits: planConfig.imageCredits,
          videoCredits: planConfig.videoCredits,
        },
      });
    },
  });

  // ─── POST /simulate-upgrade ────────────────────────────────────────
  // Dev-only: instantly upgrade the authenticated user's plan (for testing)
  fastify.post('/simulate-upgrade', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['plan'],
        properties: {
          plan: { type: 'string', enum: ['pro', 'enterprise'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            plan: { type: 'string' },
            imageCredits: { type: 'number' },
            videoCredits: { type: 'number' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      let users;
      try {
        users = getUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const { plan } = request.body;
      const planConfig = config.plans[plan];
      if (!planConfig) {
        return reply.code(400).send({ error: `Unknown plan: ${plan}` });
      }

      let oid;
      try {
        oid = fastify.mongo.ObjectId(request.user.id);
      } catch {
        return reply.code(400).send({ error: 'Invalid user id' });
      }

      await users.updateOne(
        { _id: oid },
        {
          $set: {
            plan,
            imageCredits: planConfig.imageCredits,
            videoCredits: planConfig.videoCredits,
            upgradedAt: new Date(),
          },
        }
      );

      return reply.send({
        success: true,
        plan,
        imageCredits: planConfig.imageCredits,
        videoCredits: planConfig.videoCredits,
      });
    },
  });
}
