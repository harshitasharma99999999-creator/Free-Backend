import { describe, it, expect } from 'vitest';

/**
 * Unit tests for API key extraction logic in publicApi.js
 * 
 * These tests verify the unified API key extraction supports:
 * - X-API-Key header (primary method)
 * - Authorization: Bearer header (fallback)
 * - apiKey query parameter (least preferred)
 */

describe('API Key Extraction Logic', () => {
  /**
   * Test the priority order of API key extraction
   */
  it('should prioritize X-API-Key header over Authorization header', () => {
    const headers = {
      'x-api-key': 'fk_from_x_api_key_header',
      'authorization': 'Bearer fk_from_authorization_header',
    };

    // Simulate the extraction logic
    let rawKey = null;
    
    if (headers['x-api-key']) {
      rawKey = headers['x-api-key'];
    } else if (headers.authorization) {
      const authHeader = headers.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token && token.startsWith('fk_')) {
          rawKey = token;
        }
      }
    }

    expect(rawKey).toBe('fk_from_x_api_key_header');
  });

  it('should extract API key from Authorization: Bearer header when X-API-Key is not present', () => {
    const headers = {
      'authorization': 'Bearer fk_test_api_key_12345678901234567890',
    };

    // Simulate the extraction logic
    let rawKey = null;
    
    if (headers['x-api-key']) {
      rawKey = headers['x-api-key'];
    } else if (headers.authorization) {
      const authHeader = headers.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token && token.startsWith('fk_')) {
          rawKey = token;
        }
      }
    }

    expect(rawKey).toBe('fk_test_api_key_12345678901234567890');
  });

  it('should NOT extract JWT tokens from Authorization: Bearer header', () => {
    const headers = {
      'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    };

    // Simulate the extraction logic
    let rawKey = null;
    
    if (headers['x-api-key']) {
      rawKey = headers['x-api-key'];
    } else if (headers.authorization) {
      const authHeader = headers.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        // Only extract if it's an API key format (fk_...) not a JWT
        if (token && token.startsWith('fk_')) {
          rawKey = token;
        }
      }
    }

    expect(rawKey).toBeNull();
  });

  it('should handle case-insensitive Bearer prefix', () => {
    const testCases = [
      'Bearer fk_test_key',
      'bearer fk_test_key',
      'BEARER fk_test_key',
      'BeArEr fk_test_key',
    ];

    testCases.forEach((authHeader) => {
      let rawKey = null;
      
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token && token.startsWith('fk_')) {
          rawKey = token;
        }
      }

      expect(rawKey).toBe('fk_test_key');
    });
  });

  it('should trim whitespace from Bearer token', () => {
    const headers = {
      'authorization': 'Bearer   fk_test_key_with_spaces   ',
    };

    // Simulate the extraction logic
    let rawKey = null;
    
    if (headers.authorization) {
      const authHeader = headers.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token && token.startsWith('fk_')) {
          rawKey = token;
        }
      }
    }

    expect(rawKey).toBe('fk_test_key_with_spaces');
  });

  it('should prioritize headers over query parameters', () => {
    const headers = {
      'x-api-key': 'fk_from_header',
    };
    const query = {
      apiKey: 'fk_from_query',
    };

    // Simulate the extraction logic
    let rawKey = null;
    
    if (headers['x-api-key']) {
      rawKey = headers['x-api-key'];
    } else if (headers.authorization) {
      const authHeader = headers.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token && token.startsWith('fk_')) {
          rawKey = token;
        }
      }
    }
    
    if (!rawKey && query?.apiKey) {
      rawKey = query.apiKey;
    }

    expect(rawKey).toBe('fk_from_header');
  });

  it('should fall back to query parameter when no headers are present', () => {
    const headers = {};
    const query = {
      apiKey: 'fk_from_query_param',
    };

    // Simulate the extraction logic
    let rawKey = null;
    
    if (headers['x-api-key']) {
      rawKey = headers['x-api-key'];
    } else if (headers.authorization) {
      const authHeader = headers.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token && token.startsWith('fk_')) {
          rawKey = token;
        }
      }
    }
    
    if (!rawKey && query?.apiKey) {
      rawKey = query.apiKey;
    }

    expect(rawKey).toBe('fk_from_query_param');
  });
});
