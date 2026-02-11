import fp from 'fastify-plugin';
import { hash, compare } from 'bcryptjs';

const SALT_ROUNDS = 10;

async function passwordPlugin(fastify) {
  fastify.decorate('hashPassword', async (password) => {
    return hash(password, SALT_ROUNDS);
  });
  fastify.decorate('verifyPassword', async (plain, hashed) => {
    return compare(plain, hashed);
  });
}

export default fp(passwordPlugin);
