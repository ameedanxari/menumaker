import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source.js';
import { AdminUser } from '../models/AdminUser.js';

/**
 * Admin Authentication & Authorization Middleware
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Verifies:
 * - JWT token is valid
 * - User is an admin
 * - Admin is active
 * - Admin has required role permissions
 * - IP whitelist (if configured)
 */

interface AdminJWTPayload {
  adminUserId: string;
  role: string;
  email: string;
}

/**
 * Authenticate admin user (verify JWT)
 */
export async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'JWT secret not configured',
      });
    }

    // Verify JWT
    const payload = jwt.verify(token, jwtSecret) as AdminJWTPayload;

    // Fetch admin user from database
    const adminUserRepo = AppDataSource.getRepository(AdminUser);
    const adminUser = await adminUserRepo.findOne({
      where: { id: payload.adminUserId },
    });

    if (!adminUser) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Admin user not found',
      });
    }

    // Check if admin is active
    if (!adminUser.is_active) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Admin account is deactivated',
      });
    }

    // Check IP whitelist (if configured)
    if (adminUser.whitelisted_ips && adminUser.whitelisted_ips.length > 0) {
      const clientIp = request.ip;
      if (!adminUser.whitelisted_ips.includes(clientIp)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied from this IP address',
        });
      }
    }

    // Check 2FA requirement (mandatory for all admin users)
    if (!adminUser.two_factor_enabled) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: '2FA must be enabled for admin accounts',
      });
    }

    // Update last login
    adminUser.last_login_at = new Date();
    adminUser.last_login_ip = request.ip;
    await adminUserRepo.save(adminUser);

    // Attach admin user to request
    (request as any).adminUser = adminUser;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Authorize admin user by role (RBAC - Role-Based Access Control)
 *
 * Roles hierarchy:
 * - super_admin: Full access (all actions)
 * - moderator: Content moderation, view analytics, view users (no ban/suspend)
 * - support_agent: Support tickets, view users (no ban/suspend/moderation)
 */
export function authorizeAdminRole(requiredRoles: string | string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const adminUser = (request as any).adminUser as AdminUser;

    if (!adminUser) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Admin authentication required',
      });
    }

    // Convert to array if single role provided
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    // Check if admin has one of the required roles
    if (!roles.includes(adminUser.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${roles.join(', ')}`,
        your_role: adminUser.role,
      });
    }
  };
}

/**
 * Super admin only middleware
 */
export const requireSuperAdmin = authorizeAdminRole('super_admin');

/**
 * Moderator or super admin middleware
 */
export const requireModerator = authorizeAdminRole(['super_admin', 'moderator']);

/**
 * Support agent, moderator, or super admin middleware
 */
export const requireSupportAgent = authorizeAdminRole(['super_admin', 'moderator', 'support_agent']);
