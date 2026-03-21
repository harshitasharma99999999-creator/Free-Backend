/**
 * Eior Assistants API — OpenAI-compatible
 * Implements: Assistants, Threads, Messages, Runs, Files
 *
 * All endpoints require Firebase auth (Bearer token from portal) OR API key.
 */
import { FastifyInstance } from 'fastify';
export declare function assistantsRoutes(app: FastifyInstance): Promise<void>;
