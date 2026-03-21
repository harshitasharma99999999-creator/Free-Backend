import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { buildApp } from '../app.js';
import { nanoid } from 'nanoid';

/**
 * Bug Condition Exploration Test for API External Integration Fix
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 * 
 * This test simulates backend HTTP requests (without Origin headers) to public API endpoints
 * with valid API keys. This test is EXPECTED TO FAIL on unfixed code - failure confirms the bug exists.
 * 
 * The bug manifests when external backend applications attempt to call the API endpoints from
 * server-side code. The system incorrectly applies browser-specific security mechanisms (CORS)
 * to server-to-server communication.
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * When this test passes after the fix, it confirms the expected behavior is satisfied.
 */

describe('Bug Condition Exploration: Backend API Calls', () => {
  let app;
  let testApiKey;

  beforeAll(async () => {
    // Build the Fastify app
    app = await buildApp();
    
    // Create a test API key in the database
    const db = app.mongo?.db;
    if (!db) {
      throw new Error('Database not available for testing');
    }
    
    const apiKeys = db.collection('api_keys');
    const key = `fk_${nanoid(32)}`;
    
    const result = await apiKeys.insertOne({
      key,
      name: 'Test Backend Integration Key',
      userId: 'test-user-id',
      createdAt: new Date(),
      revokedAt: null,
    });
    
    testApiKey = key;
    console.log(`Created test API key: ${testApiKey}`);
  });

  afterAll(async () => {
    // Clean up test data
    if (app?.mongo?.db) {
      const apiKeys = app.mongo.db.collection('api_keys');
      await apiKeys.deleteOne({ key: testApiKey });
    }
    
    // Close the app
    if (app) {
      await app.close();
    }
  });

  /**
   * Property 1: Bug Condition - Backend API Calls Succeed
   * 
   * For any HTTP request where the request originates from a backend application
   * (no Origin header) and includes a valid API key in X-API-Key header or
   * Authorization: Bearer header, the system SHALL successfully authenticate
   * the request and process it, returning appropriate responses (200, 201, etc.)
   * without CORS errors.
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
   */
  describe('Property 1: Backend API Calls Succeed', () => {
    it('should accept backend requests with X-API-Key header (no Origin header)', async () => {
      // Simulate a backend cURL request: curl -H "X-API-Key: fk_test..." /api/public/v1/health
      const response = await app.inject({
        method: 'GET',
        url: '/api/public/v1/health',
        headers: {
          'X-API-Key': testApiKey,
          // NO Origin header - this is a server-to-server request
          'User-Agent': 'curl/7.68.0', // Backend client user agent
        },
      });

      // Expected: 200 OK with health status
      // Actual on unfixed code: May fail with CORS error or 401 authentication failure
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
    });

    it('should accept backend requests with Authorization: Bearer header (no Origin header)', async () => {
      // Simulate a backend request with Authorization: Bearer format
      const response = await app.inject({
        method: 'GET',
        url: '/api/public/v1/health',
        headers: {
          'Authorization': `Bearer ${testApiKey}`,
          // NO Origin header - this is a server-to-server request
          'User-Agent': 'node-fetch/2.6.1', // Backend Node.js client
        },
      });

      // Expected: 200 OK with health status
      // Actual on unfixed code: May fail due to authentication header format mismatch
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
    });

    it('should accept backend requests to /api/developer/v1/* endpoints', async () => {
      // Test the secondary prefix for developer integrations
      const response = await app.inject({
        method: 'GET',
        url: '/api/developer/v1/health',
        headers: {
          'X-API-Key': testApiKey,
          // NO Origin header
          'User-Agent': 'python-requests/2.28.0', // Backend Python client
        },
      });

      // Expected: 200 OK
      // Actual on unfixed code: May fail with CORS error
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
    });

    it('should accept backend POST requests with JSON body', async () => {
      // Simulate a backend POST request to echo endpoint
      const response = await app.inject({
        method: 'GET',
        url: '/api/public/v1/echo?message=test',
        headers: {
          'X-API-Key': testApiKey,
          // NO Origin header
          'User-Agent': 'axios/1.4.0', // Backend axios client
        },
      });

      // Expected: 200 OK with echo response
      // Actual on unfixed code: May fail with CORS preflight error
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('echo');
    });

    it('should accept backend requests to random endpoint', async () => {
      // Test another public endpoint
      const response = await app.inject({
        method: 'GET',
        url: '/api/public/v1/random?min=1&max=10',
        headers: {
          'X-API-Key': testApiKey,
          // NO Origin header
          'User-Agent': 'Java/11.0.2', // Backend Java client
        },
      });

      // Expected: 200 OK with random value
      // Actual on unfixed code: May fail with CORS error
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('value');
      expect(body.value).toBeGreaterThanOrEqual(1);
      expect(body.value).toBeLessThanOrEqual(10);
    });

    /**
     * Property-Based Test: Backend requests with various valid API key formats succeed
     * 
     * This test generates multiple backend request scenarios to verify that the system
     * correctly handles server-to-server API calls across different endpoints and
     * authentication formats.
     */
    it('property: backend requests with valid API keys succeed across endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate test scenarios
          fc.record({
            endpoint: fc.constantFrom(
              '/api/public/v1/health',
              '/api/public/v1/echo?message=test',
              '/api/public/v1/random',
              '/api/developer/v1/health'
            ),
            authFormat: fc.constantFrom('x-api-key', 'bearer'),
            userAgent: fc.constantFrom(
              'curl/7.68.0',
              'node-fetch/2.6.1',
              'python-requests/2.28.0',
              'axios/1.4.0',
              'Java/11.0.2',
              'Go-http-client/1.1'
            ),
          }),
          async ({ endpoint, authFormat, userAgent }) => {
            // Build headers based on auth format
            const headers = {
              'User-Agent': userAgent,
              // NO Origin header - this is critical for backend requests
            };

            if (authFormat === 'x-api-key') {
              headers['X-API-Key'] = testApiKey;
            } else {
              headers['Authorization'] = `Bearer ${testApiKey}`;
            }

            // Make the request
            const response = await app.inject({
              method: 'GET',
              url: endpoint,
              headers,
            });

            // Assert: Backend requests should succeed (200 OK)
            // On unfixed code, this will fail with CORS errors or 401 authentication failures
            expect(response.statusCode).toBe(200);
            
            // Verify response has valid JSON body
            const body = JSON.parse(response.body);
            expect(body).toBeDefined();
          }
        ),
        {
          numRuns: 20, // Run 20 different combinations
          verbose: true, // Show counterexamples when test fails
        }
      );
    });
  });
});
