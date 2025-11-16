import { AppDataSource } from '../config/database.js';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';
import { Menu } from '../models/Menu.js';
import { AdminUser } from '../models/AdminUser.js';
import { AuditLog } from '../models/AuditLog.js';
import { MoreThan, LessThan, Between, In } from 'typeorm';
import bcrypt from 'bcrypt';

/**
 * AdminService - User Management & Administrative Operations
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Handles:
 * - User listing and search
 * - User suspension and ban workflows
 * - Password resets
 * - Admin user creation and management
 * - Audit logging for all actions
 */
export class AdminService {
  private static userRepo = AppDataSource.getRepository(User);
  private static businessRepo = AppDataSource.getRepository(Business);
  private static orderRepo = AppDataSource.getRepository(Order);
  private static menuRepo = AppDataSource.getRepository(Menu);
  private static adminUserRepo = AppDataSource.getRepository(AdminUser);
  private static auditLogRepo = AppDataSource.getRepository(AuditLog);

  /**
   * List all users with filtering and pagination
   */
  static async listUsers(params: {
    page?: number;
    limit?: number;
    search?: string; // Search by email or name
    subscription_tier?: string;
    status?: string; // 'active', 'suspended', 'banned'
    signup_date_from?: Date;
    signup_date_to?: Date;
  }) {
    const { page = 1, limit = 50, search, subscription_tier, status, signup_date_from, signup_date_to } = params;

    const queryBuilder = this.userRepo.createQueryBuilder('user');

    // Search filter
    if (search) {
      queryBuilder.where(
        '(user.email ILIKE :search OR user.full_name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Subscription tier filter
    if (subscription_tier) {
      queryBuilder.andWhere('user.subscription_tier = :tier', { tier: subscription_tier });
    }

    // Status filter (not banned, suspended, etc.)
    if (status === 'active') {
      queryBuilder.andWhere('user.is_banned = false AND user.suspended_until IS NULL');
    } else if (status === 'suspended') {
      queryBuilder.andWhere('user.suspended_until > NOW()');
    } else if (status === 'banned') {
      queryBuilder.andWhere('user.is_banned = true');
    }

    // Date range filter
    if (signup_date_from) {
      queryBuilder.andWhere('user.created_at >= :from', { from: signup_date_from });
    }
    if (signup_date_to) {
      queryBuilder.andWhere('user.created_at <= :to', { to: signup_date_to });
    }

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by created_at DESC
    queryBuilder.orderBy('user.created_at', 'DESC');

    // Execute query
    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed user information
   */
  static async getUserDetails(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get associated business
    const business = await this.businessRepo.findOne({
      where: { owner_id: userId },
    });

    // Get order stats
    const orderStats = business
      ? await this.orderRepo
          .createQueryBuilder('order')
          .select('COUNT(*)', 'total_orders')
          .addSelect('SUM(order.total_cents)', 'total_gmv_cents')
          .where('order.business_id = :businessId', { businessId: business.id })
          .getRawOne()
      : { total_orders: 0, total_gmv_cents: 0 };

    // Get menu count
    const menuCount = business
      ? await this.menuRepo.count({
          where: { business_id: business.id },
        })
      : 0;

    return {
      user,
      business,
      stats: {
        total_orders: parseInt(orderStats.total_orders) || 0,
        total_gmv_cents: parseInt(orderStats.total_gmv_cents) || 0,
        total_menus: menuCount,
      },
    };
  }

  /**
   * Suspend user account (temporary)
   */
  static async suspendUser(params: {
    user_id: string;
    admin_user_id: string;
    reason: string;
    duration_days: number; // 7, 30, or permanent (999999)
    ip_address: string;
  }) {
    const { user_id, admin_user_id, reason, duration_days, ip_address } = params;

    const user = await this.userRepo.findOne({ where: { id: user_id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Calculate suspension end date
    const suspended_until = new Date();
    suspended_until.setDate(suspended_until.getDate() + duration_days);

    // Update user
    user.suspended_until = duration_days >= 999999 ? null : suspended_until; // Null = permanent suspension
    user.suspension_reason = reason;
    await this.userRepo.save(user);

    // Hide business from public view
    const business = await this.businessRepo.findOne({ where: { owner_id: user_id } });
    if (business) {
      business.is_published = false;
      await this.businessRepo.save(business);
    }

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'suspend_user',
      target_type: 'user',
      target_id: user_id,
      details: {
        reason,
        duration_days,
        suspended_until: suspended_until.toISOString(),
        email: user.email,
      },
      ip_address,
    });

    // TODO: Send email notification to user
    // await EmailService.sendSuspensionNotification(user.email, reason, suspended_until);

    return { success: true, suspended_until };
  }

  /**
   * Unsuspend user account
   */
  static async unsuspendUser(params: { user_id: string; admin_user_id: string; ip_address: string }) {
    const { user_id, admin_user_id, ip_address } = params;

    const user = await this.userRepo.findOne({ where: { id: user_id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Update user
    const previous_reason = user.suspension_reason;
    user.suspended_until = null;
    user.suspension_reason = null;
    await this.userRepo.save(user);

    // Restore business visibility (if was published before)
    const business = await this.businessRepo.findOne({ where: { owner_id: user_id } });
    if (business) {
      // Note: We don't auto-publish; user needs to re-publish manually for safety
      // business.is_published = true;
      // await this.businessRepo.save(business);
    }

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'unsuspend_user',
      target_type: 'user',
      target_id: user_id,
      details: {
        previous_reason,
        email: user.email,
      },
      ip_address,
    });

    // TODO: Send email notification to user
    // await EmailService.sendUnsuspensionNotification(user.email);

    return { success: true };
  }

  /**
   * Ban user account (permanent)
   */
  static async banUser(params: { user_id: string; admin_user_id: string; reason: string; ip_address: string }) {
    const { user_id, admin_user_id, reason, ip_address } = params;

    const user = await this.userRepo.findOne({ where: { id: user_id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Update user
    user.is_banned = true;
    user.ban_reason = reason;
    user.banned_at = new Date();
    await this.userRepo.save(user);

    // Soft-delete business and hide from public
    const business = await this.businessRepo.findOne({ where: { owner_id: user_id } });
    if (business) {
      business.is_published = false;
      business.deleted_at = new Date();
      await this.businessRepo.save(business);
    }

    // Unpublish all menus
    await this.menuRepo.update({ business_id: business?.id }, { status: 'draft' });

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'ban_user',
      target_type: 'user',
      target_id: user_id,
      details: {
        reason,
        email: user.email,
        business_id: business?.id,
      },
      ip_address,
    });

    // TODO: Send email notification to user
    // await EmailService.sendBanNotification(user.email, reason);

    return { success: true };
  }

  /**
   * Reset user password (admin-initiated)
   */
  static async resetUserPassword(params: {
    user_id: string;
    admin_user_id: string;
    new_password: string;
    ip_address: string;
  }) {
    const { user_id, admin_user_id, new_password, ip_address } = params;

    const user = await this.userRepo.findOne({ where: { id: user_id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Hash new password
    const password_hash = await bcrypt.hash(new_password, 10);

    // Update user
    user.password_hash = password_hash;
    await this.userRepo.save(user);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'reset_user_password',
      target_type: 'user',
      target_id: user_id,
      details: {
        email: user.email,
        initiated_by: 'admin',
      },
      ip_address,
    });

    // TODO: Send email notification to user
    // await EmailService.sendPasswordResetNotification(user.email);

    return { success: true };
  }

  /**
   * Create admin user
   */
  static async createAdminUser(params: {
    email: string;
    password: string;
    full_name: string;
    role: 'super_admin' | 'moderator' | 'support_agent';
    created_by_admin_id: string;
    ip_address: string;
  }) {
    const { email, password, full_name, role, created_by_admin_id, ip_address } = params;

    // Check if admin user already exists
    const existing = await this.adminUserRepo.findOne({ where: { email } });
    if (existing) {
      throw new Error('Admin user with this email already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create admin user
    const adminUser = this.adminUserRepo.create({
      email,
      password_hash,
      full_name,
      role,
      two_factor_enabled: false, // Must be enabled after creation
      is_active: true,
    });

    await this.adminUserRepo.save(adminUser);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id: created_by_admin_id,
      action: 'create_admin_user',
      target_type: 'admin_user',
      target_id: adminUser.id,
      details: {
        email: adminUser.email,
        role,
        full_name,
      },
      ip_address,
    });

    return { admin_user: adminUser };
  }

  /**
   * Update admin user role
   */
  static async updateAdminRole(params: {
    admin_user_id: string;
    new_role: 'super_admin' | 'moderator' | 'support_agent';
    updated_by_admin_id: string;
    ip_address: string;
  }) {
    const { admin_user_id, new_role, updated_by_admin_id, ip_address } = params;

    const adminUser = await this.adminUserRepo.findOne({ where: { id: admin_user_id } });
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    const previous_role = adminUser.role;
    adminUser.role = new_role;
    await this.adminUserRepo.save(adminUser);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id: updated_by_admin_id,
      action: 'update_admin_role',
      target_type: 'admin_user',
      target_id: admin_user_id,
      details: {
        email: adminUser.email,
        previous_role,
        new_role,
      },
      ip_address,
    });

    return { success: true };
  }

  /**
   * Deactivate admin user
   */
  static async deactivateAdminUser(params: {
    admin_user_id: string;
    deactivated_by_admin_id: string;
    ip_address: string;
  }) {
    const { admin_user_id, deactivated_by_admin_id, ip_address } = params;

    const adminUser = await this.adminUserRepo.findOne({ where: { id: admin_user_id } });
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    adminUser.is_active = false;
    await this.adminUserRepo.save(adminUser);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id: deactivated_by_admin_id,
      action: 'deactivate_admin_user',
      target_type: 'admin_user',
      target_id: admin_user_id,
      details: {
        email: adminUser.email,
        role: adminUser.role,
      },
      ip_address,
    });

    return { success: true };
  }

  /**
   * Get activity log for a user
   */
  static async getUserActivityLog(userId: string, limit: number = 50) {
    const logs = await this.auditLogRepo.find({
      where: {
        target_type: 'user',
        target_id: userId,
      },
      order: { created_at: 'DESC' },
      take: limit,
    });

    return { logs };
  }
}
