import { FastifyRequest, FastifyReply } from 'fastify';
declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            id: string;
            firebaseUid: string;
            email: string;
            plan: string;
        };
        apiKey?: {
            id: string;
            userId: string;
            name: string;
        };
    }
}
export declare function verifyFirebaseToken(request: FastifyRequest, reply: FastifyReply): Promise<void>;
