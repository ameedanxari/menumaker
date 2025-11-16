import { FastifyInstance } from 'fastify';
import { AuthService } from '../services/AuthService.js';
import { ReferralService } from '../services/ReferralService.js';
import { validateSchema } from '../utils/validation.js';
import { SignupSchema, LoginSchema } from '@menumaker/shared';
import { authenticate } from '../middleware/auth.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService();

  // POST /auth/signup
  fastify.post('/signup', async (request, reply) => {
    const data = validateSchema(SignupSchema, request.body);
    const referralCode = (request.body as any).referral_code;

    const { user, tokens } = await authService.signup(data.email, data.password);

    // Apply referral code if provided (Phase 2.5)
    if (referralCode) {
      const signupIp = request.ip;
      await ReferralService.applyReferralOnSignup({
        referral_code: referralCode,
        referee_id: user.id,
        referee_email: user.email,
        signup_ip: signupIp,
      }).catch((error) => {
        // Log but don't fail signup if referral fails
        console.error('Failed to apply referral on signup:', error);
      });
    }

    // Don't return password hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPassword } = user;

    reply.send({
      success: true,
      data: {
        user: userWithoutPassword,
      },
    });
  });
}
