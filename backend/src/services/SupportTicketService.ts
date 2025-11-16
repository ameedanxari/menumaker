import { AppDataSource } from '../config/database.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { AdminUser } from '../models/AdminUser.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { MoreThan, LessThan, In } from 'typeorm';

/**
 * SupportTicketService - Customer Support & Ticket Management
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Handles:
 * - Ticket creation and management
 * - Ticket assignment (round-robin, manual)
 * - Conversation threading
 * - SLA tracking (24-hour first response target)
 * - Internal notes (admin-only)
 */
export class SupportTicketService {
  private static ticketRepo = AppDataSource.getRepository(SupportTicket);
  private static adminUserRepo = AppDataSource.getRepository(AdminUser);
  private static auditLogRepo = AppDataSource.getRepository(AuditLog);
  private static userRepo = AppDataSource.getRepository(User);

  private static readonly SLA_FIRST_RESPONSE_HOURS = 24; // 24-hour SLA

  /**
   * Create a new support ticket
   */
  static async createTicket(params: {
    user_id: string;
    subject: string;
    description: string;
    priority?: 'low' | 'medium' | 'high';
    category?: string;
  }) {
    const { user_id, subject, description, priority = 'medium', category } = params;

    const user = await this.userRepo.findOne({ where: { id: user_id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Create ticket
    const ticket = this.ticketRepo.create({
      user_id,
      subject,
      description,
      priority,
      category,
      status: 'open',
      conversation: [
        {
          from: 'user',
          message: description,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    await this.ticketRepo.save(ticket);

    // Auto-assign to support agent (round-robin)
    await this.autoAssignTicket(ticket.id);

    // TODO: Send email notification to assigned support agent
    // await EmailService.sendTicketCreatedNotification(ticket);

    return { ticket };
  }

  /**
   * Auto-assign ticket to next available support agent (round-robin)
   */
  static async autoAssignTicket(ticketId: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Find support agents with fewest assigned tickets
    const supportAgents = await this.adminUserRepo.find({
      where: {
        role: In(['support_agent', 'super_admin']),
        is_active: true,
      },
    });

    if (supportAgents.length === 0) {
      return; // No support agents available
    }

    // Count tickets per agent
    const agentTicketCounts = await Promise.all(
      supportAgents.map(async (agent) => {
        const count = await this.ticketRepo.count({
          where: {
            assigned_to_id: agent.id,
            status: In(['open', 'pending']),
          },
        });
        return { agent, count };
      })
    );

    // Sort by count (ascending) and assign to agent with fewest tickets
    agentTicketCounts.sort((a, b) => a.count - b.count);
    const selectedAgent = agentTicketCounts[0].agent;

    ticket.assigned_to_id = selectedAgent.id;
    await this.ticketRepo.save(ticket);

    return { assigned_to: selectedAgent };
  }

  /**
   * Get all tickets (with filtering and pagination)
   */
  static async listTickets(params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    assigned_to_id?: string;
    search?: string;
  }) {
    const { page = 1, limit = 50, status, priority, assigned_to_id, search } = params;

    const queryBuilder = this.ticketRepo.createQueryBuilder('ticket');

    // Filters
    if (status) {
      queryBuilder.where('ticket.status = :status', { status });
    }

    if (priority) {
      if (status) {
        queryBuilder.andWhere('ticket.priority = :priority', { priority });
      } else {
        queryBuilder.where('ticket.priority = :priority', { priority });
      }
    }

    if (assigned_to_id) {
      queryBuilder.andWhere('ticket.assigned_to_id = :assigned_to_id', { assigned_to_id });
    }

    if (search) {
      queryBuilder.andWhere('(ticket.subject ILIKE :search OR ticket.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    // Join relations
    queryBuilder.leftJoinAndSelect('ticket.user', 'user');
    queryBuilder.leftJoinAndSelect('ticket.assigned_to', 'assigned_to');

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by priority (high first), then created_at
    queryBuilder.orderBy('ticket.priority', 'DESC').addOrderBy('ticket.created_at', 'ASC');

    const [tickets, total] = await queryBuilder.getManyAndCount();

    return {
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ticket details
   */
  static async getTicketDetails(ticketId: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['user', 'assigned_to'],
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Calculate SLA metrics
    const slaDeadline = new Date(ticket.created_at);
    slaDeadline.setHours(slaDeadline.getHours() + this.SLA_FIRST_RESPONSE_HOURS);

    const slaMet = ticket.first_response_at ? ticket.first_response_at <= slaDeadline : false;
    const slaOverdue = !ticket.first_response_at && new Date() > slaDeadline;

    return {
      ticket,
      sla: {
        deadline: slaDeadline,
        met: slaMet,
        overdue: slaOverdue,
        hours_remaining: ticket.first_response_at
          ? 0
          : Math.max(0, Math.round((slaDeadline.getTime() - new Date().getTime()) / 1000 / 60 / 60)),
      },
    };
  }

  /**
   * Reply to ticket (admin response)
   */
  static async replyToTicket(params: {
    ticket_id: string;
    admin_user_id: string;
    message: string;
    internal_note?: boolean; // If true, add to internal_notes instead of conversation
    ip_address: string;
  }) {
    const { ticket_id, admin_user_id, message, internal_note, ip_address } = params;

    const ticket = await this.ticketRepo.findOne({
      where: { id: ticket_id },
      relations: ['user'],
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (internal_note) {
      // Add to internal notes (not visible to user)
      ticket.internal_notes = ticket.internal_notes
        ? `${ticket.internal_notes}\n\n---\n[${new Date().toISOString()}] Admin ${admin_user_id}: ${message}`
        : message;
    } else {
      // Add to conversation
      const conversation = ticket.conversation || [];
      conversation.push({
        from: 'admin',
        admin_id: admin_user_id,
        message,
        timestamp: new Date().toISOString(),
      });
      ticket.conversation = conversation;

      // Mark first response time if not already set
      if (!ticket.first_response_at) {
        ticket.first_response_at = new Date();
      }

      // Update status to pending if was open
      if (ticket.status === 'open') {
        ticket.status = 'pending';
      }
    }

    await this.ticketRepo.save(ticket);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: internal_note ? 'add_ticket_internal_note' : 'reply_to_ticket',
      target_type: 'ticket',
      target_id: ticket_id,
      details: {
        message_length: message.length,
        user_email: ticket.user?.email,
      },
      ip_address,
    });

    // TODO: Send email notification to user (if not internal note)
    // if (!internal_note) {
    //   await EmailService.sendTicketReplyNotification(ticket.user.email, message);
    // }

    return { success: true };
  }

  /**
   * Assign ticket to admin user
   */
  static async assignTicket(params: {
    ticket_id: string;
    assigned_to_id: string;
    assigned_by_admin_id: string;
    ip_address: string;
  }) {
    const { ticket_id, assigned_to_id, assigned_by_admin_id, ip_address } = params;

    const ticket = await this.ticketRepo.findOne({ where: { id: ticket_id } });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const adminUser = await this.adminUserRepo.findOne({ where: { id: assigned_to_id } });
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    const previous_assigned_to_id = ticket.assigned_to_id;
    ticket.assigned_to_id = assigned_to_id;
    await this.ticketRepo.save(ticket);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id: assigned_by_admin_id,
      action: 'assign_ticket',
      target_type: 'ticket',
      target_id: ticket_id,
      details: {
        previous_assigned_to_id,
        new_assigned_to_id: assigned_to_id,
        assigned_to_email: adminUser.email,
      },
      ip_address,
    });

    return { success: true };
  }

  /**
   * Close ticket
   */
  static async closeTicket(params: { ticket_id: string; admin_user_id: string; ip_address: string }) {
    const { ticket_id, admin_user_id, ip_address } = params;

    const ticket = await this.ticketRepo.findOne({ where: { id: ticket_id } });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.status = 'closed';
    ticket.resolved_at = new Date();
    await this.ticketRepo.save(ticket);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'close_ticket',
      target_type: 'ticket',
      target_id: ticket_id,
      details: {},
      ip_address,
    });

    return { success: true };
  }

  /**
   * Reopen ticket
   */
  static async reopenTicket(params: { ticket_id: string; admin_user_id: string; ip_address: string }) {
    const { ticket_id, admin_user_id, ip_address } = params;

    const ticket = await this.ticketRepo.findOne({ where: { id: ticket_id } });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.status = 'open';
    ticket.resolved_at = null;
    await this.ticketRepo.save(ticket);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'reopen_ticket',
      target_type: 'ticket',
      target_id: ticket_id,
      details: {},
      ip_address,
    });

    return { success: true };
  }

  /**
   * Get support metrics (SLA compliance, backlog, etc.)
   */
  static async getSupportMetrics(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total tickets created
    const totalTickets = await this.ticketRepo.count({
      where: {
        created_at: MoreThan(startDate),
      },
    });

    // Open tickets (backlog)
    const openTickets = await this.ticketRepo.count({
      where: {
        status: In(['open', 'pending']),
      },
    });

    // Resolved tickets
    const resolvedTickets = await this.ticketRepo.count({
      where: {
        status: In(['resolved', 'closed']),
        resolved_at: MoreThan(startDate),
      },
    });

    // SLA compliance (% of tickets responded within 24 hours)
    const ticketsWithFirstResponse = await this.ticketRepo.find({
      where: {
        created_at: MoreThan(startDate),
        first_response_at: MoreThan(startDate),
      },
      select: ['created_at', 'first_response_at'],
    });

    let slaMetCount = 0;
    ticketsWithFirstResponse.forEach((ticket) => {
      const responseTime = ticket.first_response_at!.getTime() - ticket.created_at.getTime();
      const responseTimeHours = responseTime / 1000 / 60 / 60;
      if (responseTimeHours <= this.SLA_FIRST_RESPONSE_HOURS) {
        slaMetCount++;
      }
    });

    const slaCompliancePercentage =
      ticketsWithFirstResponse.length > 0
        ? Math.round((slaMetCount / ticketsWithFirstResponse.length) * 100)
        : 0;

    // Average response time
    let avgResponseTimeHours = 0;
    if (ticketsWithFirstResponse.length > 0) {
      const totalResponseTime = ticketsWithFirstResponse.reduce((sum, ticket) => {
        return sum + (ticket.first_response_at!.getTime() - ticket.created_at.getTime());
      }, 0);
      avgResponseTimeHours = totalResponseTime / ticketsWithFirstResponse.length / 1000 / 60 / 60;
    }

    return {
      period_days: days,
      total_tickets: totalTickets,
      open_tickets: openTickets,
      resolved_tickets: resolvedTickets,
      sla_compliance_percentage: slaCompliancePercentage,
      avg_response_time_hours: Math.round(avgResponseTimeHours * 10) / 10,
    };
  }
}
