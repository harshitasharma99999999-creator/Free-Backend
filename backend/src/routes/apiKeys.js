import { generateApiKey } from '../lib/apiKey.js';

export default async function apiKeysRoutes(fastify) {
  const apiKeys = fastify.mongo.db.collection('api_keys');

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
        },
        required: ['name'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            key: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const userId = request.user.id;
      const { name } = request.body;
      const key = generateApiKey();
      const { insertedId } = await apiKeys.insertOne({
        userId,
        name: name.trim(),
        key,
        createdAt: new Date(),
      });
      return reply.code(201).send({
        id: insertedId.toString(),
        name: name.trim(),
        key, // only shown once
        createdAt: new Date().toISOString(),
      });
    },
  });

  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            keys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  keyPreview: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request) => {
      const keys = await apiKeys
        .find({ userId: request.user.id })
        .project({ key: 0, userId: 0 })
        .toArray();
      return {
        keys: keys.map((k) => ({
          id: k._id.toString(),
          name: k.name,
          keyPreview: 'fk_••••••••••••',
          createdAt: k.createdAt.toISOString(),
        })),
      };
    },
  });

  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: { 204: { type: 'null' } },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const result = await apiKeys.deleteOne({
        _id: request.mongo.ObjectId(id),
        userId: request.user.id,
      });
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'API key not found' });
      }
      return reply.code(204).send();
    },
  });
}
