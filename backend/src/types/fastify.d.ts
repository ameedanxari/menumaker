import 'fastify';
import { DataSource } from 'typeorm';
import { JWTPayload } from '../utils/jwt.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    orm: DataSource;
  }

  interface FastifyRequest {
    user?: JWTPayload;
  }

  interface FastifyReply {
    user?: JWTPayload;
  }
}
