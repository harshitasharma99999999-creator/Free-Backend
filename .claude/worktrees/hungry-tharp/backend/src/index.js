import { config } from './config.js';
import { buildApp } from './app.js';

async function start() {
  try {
    const fastify = await buildApp();
    const port = config.port;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server running at http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
