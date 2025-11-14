import { FastifyInstance } from 'fastify';
import { AuthService } from '../services/AuthService.js';
import { validateSchema } from '../utils/validation.js';
import { SignupSchema, LoginSchema } from '@menumaker/shared';
import { authenticate } from '../middleware/auth.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService();

  // POST /auth/signup
  fastify.post('/signup', async (request, reply) => {
    const data = validateSchema(SignupSchema, request.body);

    const { user, tokens } = await authService.signup(data.email, data.password);

    // Don't return password hash
    const { password_hash, ...userWithoutPassword } = user;

    reply.status(201).send({
      success: true,
      data: {
        user: userWithoutPassword,
        tokens,
      },
    });
  });

  // POST /auth/login
  fastify.post('/login', async (request, reply) => {
    const data = validateSchema(LoginSchema, request.body);

    const { user, tokens } = await authService.login(data.email, data.password);

    // Don't return password hash
    const { password_hash, ...userWithoutPassword } = user;

    reply.send({
      success: true,
      data: {
        user: userWithoutPassword,
        tokens,
      },
    });
  });

  // GET /auth/me
  fastify.get('/me', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const user = await authService.getCurrentUser(request.user!.userId);

    // Don't return password hash
    const { password_hash, ...userWithoutPassword } = user;

    reply.send({
      success: true,
      data: {
        user: userWithoutPassword,
      },
    });
  });
}
