import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/AuthService.js';
import { ReferralService } from '../services/ReferralService.js';
import { validateSchema } from '../utils/validation.js';
import { SignupSchema, LoginSchema } from '@menumaker/shared';
import { authenticate } from '../middleware/auth.js';
import { refreshSessionStore } from '../models/RefreshSession.js';
import type { JWTPayload } from '../utils/jwt.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService();

  // POST /auth/signup
  fastify.post('/signup', async (request, reply) => {
    const data = validateSchema(SignupSchema, request.body);
    const referralCode = (request.body as any).referral_code;

    const { user } = await authService.signup(data.email, data.password);

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

    const session = await issueRouteSession(reply, {
      userId: user.id,
      email: user.email,
      businessId: (user as any).business?.id,
    }, request);

    reply.status(201).send({
      success: true,
      data: {
        user: userWithoutPassword,
        tokens: sessionTokensForClient(session, isNativeClient(request)),
      },
    });
  });

  // POST /auth/login
  fastify.post('/login', async (request, reply) => {
    const data = validateSchema(LoginSchema, request.body);

    const { user } = await authService.login(data.email, data.password);

    // Don't return password hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPassword } = user;

    const session = await issueRouteSession(reply, {
      userId: user.id,
      email: user.email,
      businessId: (user as any).business?.id,
    }, request);

    reply.send({
      success: true,
      data: {
        user: userWithoutPassword,
        tokens: sessionTokensForClient(session, isNativeClient(request)),
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

  // POST /auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refresh_token } = (request.body ?? {}) as { refresh_token?: string };
    const refreshToken = refresh_token ?? refreshCookie(request.headers.cookie);

    if (!refreshToken) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
        },
      });
    }

    try {
      const session = await refreshSessionStore.rotate(refreshToken, undefined, {
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      });
      setRefreshCookie(reply, session.refreshToken);

      reply.send({
        success: true,
        data: { tokens: sessionTokensForClient(session, isNativeClient(request)) },
      });
    } catch (error) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        },
      });
    }
  });

  // PATCH /auth/profile
  fastify.patch('/profile', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { name, phone, address } = request.body as {
      name?: string;
      phone?: string;
      address?: string;
    };

    const user = await authService.updateProfile(request.user!.userId, {
      name,
      phone,
      address,
    });

    // Don't return password hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPassword } = user;

    reply.send({
      success: true,
      data: {
        user: userWithoutPassword,
      },
      message: 'Profile updated successfully',
    });
  });

  // POST /auth/change-password
  fastify.post('/change-password', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { current_password, new_password } = request.body as {
      current_password: string;
      new_password: string;
    };

    if (!current_password || !new_password) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Current password and new password are required',
        },
      });
    }

    try {
      await authService.changePassword(request.user!.userId, current_password, new_password);
      await refreshSessionStore.revokeUser(request.user!.userId);
      expireRefreshCookie(reply);

      reply.send({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Current password is incorrect')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: error.message,
          },
        });
      }
      throw error;
    }
  });

  // POST /auth/photo
  fastify.post('/photo', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { photo_url } = request.body as { photo_url: string };

    if (!photo_url) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_PHOTO_URL',
          message: 'Photo URL is required',
        },
      });
    }

    const user = await authService.updateProfilePhoto(request.user!.userId, photo_url);

    // Don't return password hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPassword } = user;

    reply.send({
      success: true,
      data: {
        user: userWithoutPassword,
      },
      message: 'Profile photo updated successfully',
    });
  });

  // POST /auth/forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body as { email: string };

    if (!email) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_EMAIL',
          message: 'Email is required',
        },
      });
    }

    await authService.forgotPassword(email);

    reply.send({
      success: true,
      message: 'Password reset email sent (if email exists)',
    });
  });

  // POST /auth/logout
  fastify.post('/logout', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { refresh_token } = (request.body ?? {}) as { refresh_token?: string };
    const refreshToken = refresh_token ?? refreshCookie(request.headers.cookie);
    if (refreshToken) {
      await refreshSessionStore.revokeSessionByToken(refreshToken);
    }
    if (request.user?.userId) {
      await refreshSessionStore.revokeUser(request.user.userId);
    }
    expireRefreshCookie(reply);

    reply.send({
      success: true,
      message: 'Logged out successfully',
    });
  });
}

type RouteSession = Awaited<ReturnType<typeof refreshSessionStore.issue>>;

async function issueRouteSession(
  reply: FastifyReply,
  payload: JWTPayload,
  request: FastifyRequest,
): Promise<RouteSession> {
  const session = await refreshSessionStore.issue(payload, {
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  });
  setRefreshCookie(reply, session.refreshToken);
  return session;
}

export function sessionTokensForClient(session: RouteSession, native: boolean) {
  return native
    ? { accessToken: session.accessToken, refreshToken: session.refreshToken }
    : { accessToken: session.accessToken };
}

export function isNativeClient(request: { headers: Record<string, any> }): boolean {
  return /^(android|ios|native)$/i.test(String(request.headers['x-client-platform'] ?? ''));
}

export function setRefreshCookie(reply: { header: (name: string, value: string | string[]) => unknown }, refreshToken: string): void {
  reply.header('set-cookie', [
    `__Host-menumaker_refresh=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}Priority=High`,
    `menumaker_csrf=${csrfFromRefresh(refreshToken)}; Path=/; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}Priority=High`,
  ]);
}

export function expireRefreshCookie(reply: { header: (name: string, value: string | string[]) => unknown }): void {
  reply.header('set-cookie', [
    '__Host-menumaker_refresh=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
    'menumaker_csrf=; Path=/; SameSite=Strict; Max-Age=0',
  ]);
}

export function refreshCookie(cookieHeader?: string): string | undefined {
  return cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('__Host-menumaker_refresh='))
    ?.split('=')
    .slice(1)
    .join('=');
}

export function csrfFromRefresh(refreshToken: string): string {
  return Buffer.from(refreshToken).toString('base64url').slice(0, 32);
}
