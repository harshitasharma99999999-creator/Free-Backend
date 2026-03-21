# API External Integration Fix - Bugfix Design

## Overview

The API platform currently fails when external backend applications attempt to make server-to-server API calls. The system is designed to provide AI generation capabilities through a public API that external applications can integrate with using API keys. However, the current implementation has critical issues preventing backend-to-backend integration:

1. **CORS misconfiguration**: CORS is applied to all routes including server-to-server endpoints, blocking legitimate backend requests
2. **Authentication header conflict**: The public API routes expect `X-API-Key` header but some middleware checks for `Authorization: Bearer` format
3. **Mixed authentication patterns**: Inconsistent handling between API key authentication and JWT token authentication

This bugfix addresses these integration issues to enable external backends to successfully call the API endpoints for image generation, video generation, and other public API operations.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when external backend applications attempt to make API calls using API keys
- **Property (P)**: The desired behavior when backend-to-backend API calls are made - successful authentication and request processing
- **Preservation**: Existing frontend JWT authentication and browser-based API key usage that must remain unchanged
- **publicApiRoutes**: The route handler in `backend/src/routes/publicApi.js` that processes public API v1 endpoints
- **CORS (Cross-Origin Resource Sharing)**: Browser security mechanism that should NOT apply to server-to-server communication
- **API Key**: Authentication credential in format `fk_<32-char-nanoid>` used for public API access
- **JWT Token**: JSON Web Token used for frontend user authentication with Firebase
- **preHandler hook**: Fastify middleware that runs before route handlers to validate API keys

## Bug Details

### Bug Condition

The bug manifests when external backend applications attempt to call the public API endpoints from server-side code. The system incorrectly applies browser-specific security mechanisms (CORS) to server-to-server communication and has inconsistent authentication header handling.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type HTTPRequest
  OUTPUT: boolean
  
  RETURN input.origin IS "backend-application"
         AND input.endpoint MATCHES "/api/public/v1/*" OR "/api/developer/v1/*"
         AND input.headers CONTAINS "X-API-Key" OR "Authorization: Bearer <api_key>"
         AND NOT (request successfully authenticated AND processed)
END FUNCTION
```

### Examples

- **Backend cURL request**: `curl -H "X-API-Key: fk_abc123..." https://api.example.com/api/public/v1/health` - Expected: 200 OK, Actual: May fail due to CORS preflight or authentication issues
- **Node.js fetch from backend**: `fetch(url, { headers: { 'X-API-Key': 'fk_...' } })` - Expected: Successful response, Actual: CORS error or 401 authentication failure
- **Python requests from backend**: `requests.get(url, headers={'X-API-Key': 'fk_...'})` - Expected: JSON response, Actual: CORS or authentication error
- **Authorization header format**: `Authorization: Bearer fk_abc123...` - Expected: Should work as alternative to X-API-Key, Actual: May conflict with JWT middleware expectations

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Frontend web application JWT authentication must continue to work exactly as before
- Browser-based requests from allowed CORS origins must continue to be accepted
- Authenticated endpoints (`/api/auth/*`, `/api/keys/*`, `/api/usage/*`) must continue to require JWT tokens
- Rate limiting enforcement (100 requests per 60 seconds) must continue to apply
- Credit validation for generation endpoints must continue to work
- Health check endpoint (`/api`) must continue to work without authentication

**Scope:**
All inputs that do NOT involve backend-to-backend API calls to public endpoints should be completely unaffected by this fix. This includes:
- Frontend browser requests with JWT tokens
- Frontend browser requests with API keys from allowed origins
- Internal API routes that use Firebase authentication
- Admin and management endpoints

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **CORS Applied to Server-to-Server Routes**: The CORS middleware in `backend/src/app.js` is registered globally, applying browser security restrictions to `/api/public/*` and `/api/developer/*` endpoints. Server-to-server requests don't send Origin headers and shouldn't be subject to CORS checks.

2. **Authentication Header Inconsistency**: The `publicApi.js` preHandler hook checks for `X-API-Key` header or `apiKey` query parameter, but doesn't properly handle `Authorization: Bearer <api_key>` format. Meanwhile, other middleware (`apiKeyAuth.js`) expects `Authorization: Bearer` format, creating confusion.

3. **CORS Preflight Handling**: OPTIONS requests for CORS preflight may not be properly handled for public API routes, causing backend clients that send preflight requests to fail.

4. **Missing CORS Bypass for Server Requests**: The CORS configuration doesn't distinguish between browser requests (which need CORS) and server requests (which don't), causing legitimate backend requests to be blocked.

## Correctness Properties

Property 1: Bug Condition - Backend API Calls Succeed

_For any_ HTTP request where the request originates from a backend application (no Origin header or non-browser User-Agent) and includes a valid API key in `X-API-Key` header or `Authorization: Bearer` header, the fixed system SHALL successfully authenticate the request and process it, returning appropriate responses (200, 201, etc.) without CORS errors.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Frontend Authentication Unchanged

_For any_ HTTP request that originates from a browser (has Origin header) or uses JWT tokens for authentication, the fixed system SHALL produce exactly the same authentication and CORS behavior as the original system, preserving all existing frontend functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/src/app.js`

**Function**: `buildApp`

**Specific Changes**:
1. **Conditional CORS Application**: Modify CORS registration to only apply to browser requests, not server-to-server requests
   - Add origin validation function that returns `false` for requests without Origin header (server requests)
   - Keep existing CORS configuration for browser requests from allowed origins

2. **CORS Configuration Enhancement**: Update CORS options to properly handle both browser and server scenarios
   - Add `origin: (origin, callback) => { ... }` function to conditionally apply CORS
   - Allow requests with no Origin header (server-to-server)
   - Maintain existing allowed origins for browser requests

**File**: `backend/src/routes/publicApi.js`

**Function**: `preHandler` hook

**Specific Changes**:
3. **Unified API Key Extraction**: Consolidate API key extraction to support multiple header formats
   - Check `X-API-Key` header first (primary method)
   - Fall back to `Authorization: Bearer <api_key>` format
   - Fall back to `apiKey` query parameter (least preferred)
   - Validate API key format regardless of source

4. **Remove Conflicting Authentication**: Ensure the preHandler doesn't conflict with other auth middleware
   - Keep API key validation in preHandler for public routes
   - Don't mix JWT token validation with API key validation in the same flow

5. **Better Error Messages**: Provide clear error messages for authentication failures
   - Distinguish between missing API key, invalid format, and invalid/revoked key
   - Include helpful hints about which headers to use

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate backend HTTP requests (without Origin headers) to public API endpoints with valid API keys. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Backend cURL Test**: Simulate `curl -H "X-API-Key: fk_test..." /api/public/v1/health` (will fail on unfixed code)
2. **Backend Node.js Fetch Test**: Simulate Node.js `fetch()` with X-API-Key header, no Origin (will fail on unfixed code)
3. **Authorization Bearer Format Test**: Simulate request with `Authorization: Bearer fk_test...` (will fail on unfixed code)
4. **Python Requests Test**: Simulate Python `requests.get()` with API key header (will fail on unfixed code)

**Expected Counterexamples**:
- CORS errors or authentication failures when valid API keys are provided
- Possible causes: CORS blocking server requests, authentication header format mismatch, missing CORS bypass logic

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handlePublicApiRequest_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases**:
1. **X-API-Key Header Success**: Backend request with `X-API-Key: fk_valid...` returns 200 OK
2. **Authorization Bearer Success**: Backend request with `Authorization: Bearer fk_valid...` returns 200 OK
3. **Query Parameter Success**: Backend request with `?apiKey=fk_valid...` returns 200 OK
4. **No Origin Header Accepted**: Request without Origin header is processed successfully
5. **Rate Limiting Applied**: Backend requests are still rate-limited correctly
6. **Invalid API Key Rejected**: Backend request with invalid key returns 401 with clear error message

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleRequest_original(input) = handleRequest_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for browser requests and JWT authentication, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Browser CORS Preservation**: Observe that browser requests from allowed origins work on unfixed code, then verify this continues after fix
2. **JWT Authentication Preservation**: Observe that `/api/auth/*` endpoints with JWT tokens work on unfixed code, then verify this continues after fix
3. **Frontend API Key Usage Preservation**: Observe that browser requests with API keys from allowed origins work on unfixed code, then verify this continues after fix
4. **Rate Limiting Preservation**: Observe that rate limiting works correctly on unfixed code, then verify this continues after fix

### Unit Tests

- Test API key extraction from different header formats (X-API-Key, Authorization Bearer, query param)
- Test CORS origin validation function (browser vs server requests)
- Test authentication error messages for different failure scenarios
- Test that requests without Origin header bypass CORS checks

### Property-Based Tests

- Generate random valid API keys and verify backend requests succeed
- Generate random browser origins and verify CORS behavior is preserved
- Generate random JWT tokens and verify authentication endpoints work correctly
- Test that all non-public endpoints continue to require JWT authentication

### Integration Tests

- Test full backend-to-backend API call flow with real HTTP requests
- Test browser-based requests continue to work with CORS
- Test mixed scenarios (some browser, some backend requests)
- Test rate limiting across both browser and backend requests
