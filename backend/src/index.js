import { buildApp } from './app.js';
import { config } from './config.js';

/**
 * Main entry point for the EIOR API server
 * Supports both local development and serverless deployment
 */

async function start() {
  try {
    const app = await buildApp();
    
    const port = process.env.PORT || config.port || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    
    console.log(`🚀 EIOR API Server running on http://${host}:${port}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   - Health: http://${host}:${port}/api`);
    console.log(`   - Public API: http://${host}:${port}/api/public/v1/*`);
    console.log(`   - OpenAI Compatible: http://${host}:${port}/v1/*`);
    console.log(`   - EIOR OpenAI: http://${host}:${port}/eior/v1/*`);
    console.log(`   - Integration Config: http://${host}:${port}/api/integration-config`);
    
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { start };