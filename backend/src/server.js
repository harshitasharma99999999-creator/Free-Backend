import { buildApp } from './app.js';

/**
 * Serverless-compatible server export for Vercel
 * This creates a Fastify app instance that can handle serverless requests
 */

let appInstance = null;

async function getApp() {
  if (!appInstance) {
    try {
      appInstance = await buildApp();
      console.log('✅ Fastify app initialized for serverless');
    } catch (error) {
      console.error('❌ Failed to initialize Fastify app:', error);
      throw error;
    }
  }
  return appInstance;
}

// Export the app getter for serverless environments
export default getApp;