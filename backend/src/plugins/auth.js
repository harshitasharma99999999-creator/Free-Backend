import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config.js';
import { verifyFirebaseToken } from '../lib/firebaseAdmin.js';

async function authPlugin(fastify) {
  await fastify.register(fastifyJwt, {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.expiresIn },
  });

  // Enhanced authentication that supports both JWT and Firebase tokens
  fastify.decorate('authenticate', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ 
        error: 'Authentication required',
        message: 'Missing or invalid Authorization header. Please provide: Bearer <token>' 
      });
    }

    const token = authHeader.slice(7).trim();
    
    // Try Firebase token first (for frontend users)
    try {
      const decoded = await verifyFirebaseToken(token);
      
      // Get or create user in database
      const db = fastify.mongo?.db;
      if (!db) {
        // Allow auth to succeed without DB so features like free chat can work even
        // when Mongo isn't configured. DB-backed routes should guard separately.
        request.user = {
          id: decoded.uid,
          email: (decoded.email || '').toLowerCase(),
          firebaseUid: decoded.uid,
          dbUser: false,
        };
        return;
      }
      
      const users = db.collection('users');
      let user = await users.findOne({ firebaseUid: decoded.uid });
      
      if (!user) {
        // Create user if doesn't exist
        const { insertedId } = await users.insertOne({
          firebaseUid: decoded.uid,
          email: (decoded.email || '').toLowerCase() || null,
          name: decoded.name || 'User',
          password: null,
          createdAt: new Date(),
        });
        user = await users.findOne({ _id: insertedId });
      }
      
      request.user = {
        id: user._id.toString(),
        email: user.email || decoded.email || '',
        firebaseUid: decoded.uid,
      };
      
      return; // Successfully authenticated with Firebase
    } catch (firebaseError) {
      // Firebase token validation failed, try JWT fallback
      try {
        await request.jwtVerify();
        const payload = request.user;
        request.user = {
          id: payload.sub || payload.id,
          email: payload.email,
        };
        if (!request.user.id) {
          return reply.code(401).send({ 
            error: 'Invalid token',
            message: 'Token payload missing required user ID' 
          });
        }
        return; // Successfully authenticated with JWT
      } catch (jwtError) {
        // Both authentication methods failed
        return reply.code(401).send({ 
          error: 'Authentication failed',
          message: 'Invalid or expired token. Please sign in again.',
          details: {
            firebase: firebaseError.message,
            jwt: jwtError.message
          }
        });
      }
    }
  });

  // Firebase-only authentication for routes that specifically need Firebase tokens
  fastify.decorate('authenticateFirebase', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ 
        error: 'Authentication required',
        message: 'Missing or invalid Authorization header. Please provide: Bearer <Firebase ID token>' 
      });
    }

    const token = authHeader.slice(7).trim();
    
    try {
      const decoded = await verifyFirebaseToken(token);
      
      // Get or create user in database
      const db = fastify.mongo?.db;
      if (!db) {
        request.user = {
          id: decoded.uid,
          email: (decoded.email || '').toLowerCase(),
          firebaseUid: decoded.uid,
          dbUser: false,
        };
        return;
      }
      
      const users = db.collection('users');
      let user = await users.findOne({ firebaseUid: decoded.uid });
      
      if (!user) {
        // Create user if doesn't exist
        const { insertedId } = await users.insertOne({
          firebaseUid: decoded.uid,
          email: (decoded.email || '').toLowerCase() || null,
          name: decoded.name || 'User',
          password: null,
          createdAt: new Date(),
        });
        user = await users.findOne({ _id: insertedId });
      }
      
      request.user = {
        id: user._id.toString(),
        email: user.email || decoded.email || '',
        firebaseUid: decoded.uid,
      };
      
    } catch (error) {
      return reply.code(401).send({ 
        error: 'Invalid Firebase token',
        message: 'Firebase token validation failed. Please sign in again.',
        details: error.message
      });
    }
  });
}

export default fp(authPlugin);
