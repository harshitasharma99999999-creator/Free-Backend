import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config.js';

async function authPlugin(fastify) {
  await fastify.register(fastifyJwt, {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.expiresIn },
  });

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
      const payload = request.user;
      request.user = {
        id: payload.sub || payload.id,
        email: payload.email,
      };
      if (!request.user.id) {
        return reply.code(401).send({ error: 'Invalid token' });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized', message: err.message });
    }
  });
}

export default fp(authPlugin);
