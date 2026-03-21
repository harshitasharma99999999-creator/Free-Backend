const {onRequest} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");

// Your Vercel backend URL
const VERCEL_API_URL = "https://backend-eta-lyart-87.vercel.app";

// Main API proxy function
exports.api = onRequest({cors: true}, async (req, res) => {
  try {
    // Log the incoming request
    logger.info(`Proxying ${req.method} ${req.url} to Vercel`);
    
    // Build the target URL
    const targetUrl = `${VERCEL_API_URL}${req.url}`;
    
    // Forward all headers except host
    const headers = {...req.headers};
    delete headers.host;
    delete headers['x-forwarded-for'];
    delete headers['x-forwarded-proto'];
    
    // Make request to Vercel backend
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });
    
    // Forward response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Forward response
    res.status(response.status);
    const responseText = await response.text();
    res.send(responseText);
    
  } catch (error) {
    logger.error('Proxy error:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      hint: 'Check Firebase Functions logs for details'
    });
  }
});