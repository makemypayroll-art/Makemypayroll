// Ticket & Helpdesk Management Service
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import { Ticket, TicketComment, TicketStatus, TicketPriority, TicketCategory } from '../database/schema';
import { AuditService } from './auditService';

export class TicketService {
  public static getAll(): Ticket[] {
    return StorageEngine.getList<Ticket>(STORAGE_KEYS.TICKETS);
  }

  public static getById(id: string): Ticket | undefined {
    return this.getAll().find(t => t.id === id);
  }

  public static getByEmployee(employeeId: string): Ticket[] {
    return this.getAll().filter(t => t.employeeId === employeeId);
  }

  public static getByDepartment(departmentId: string): Ticket[] {
    return this.getAll().filter(t => t.assignedDepartmentId === departmentId);
  }

  public static createTicket(params: {
    employeeId: string;
    category: TicketCategory;
    subject: string;
    description: string;
    priority: TicketPriority;
    assignedDepartmentId?: string;
    attachments?: string[];
  }): Ticket {
    const codeNum = this.getAll().length + 80;
    const ticketCode = `TKT-2026-${codeNum.toString().padStart(3, '0')}`;
    
    // SLA hours based on priority
    const slaHoursMap: Record<TicketPriority, number> = {
      Urgent: 12,
      High: 24,
      Medium: 48,
      Low: 72,
    };

    const newTicket: Ticket = {
      id: `tkt-${Date.now()}`,
      organizationId: StorageEngine.getActiveTenantId(),
      ticketCode,
      employeeId: params.employeeId,
      category: params.category,
      subject: params.subject,
      description: params.description,
      priority: params.priority,
      status: 'Open',
      assignedDepartmentId: params.assignedDepartmentId,
      attachments: params.attachments || [],
      slaHours: slaHoursMap[params.priority] || 48,
      isSlaBreached: false,
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return StorageEngine.insert<Ticket>(STORAGE_KEYS.TICKETS, newTicket);
  }

  public static updateStatus(
    id: string,
    status: TicketStatus,
    resolutionNotes?: string,
    user?: { id: string; name: string; role: string }
  ): Ticket | undefined {
    const isClosing = status === 'Closed' || status === 'Resolved';
    const updated = StorageEngine.update<Ticket>(STORAGE_KEYS.TICKETS, id, {
      status,
      resolutionNotes,
      resolvedAt: status === 'Resolved' ? new Date().toISOString() : undefined,
      closedAt: status === 'Closed' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    });

    if (user && updated) {
      AuditService.log(
        'UPDATE',
        'Ticket Management',
        `Changed ticket ${updated.ticketCode} status to ${status}`,
        user,
        { recordId: id, newValue: status }
      );
    }

    return updated;
  }

  public static assignTicket(
    id: string,
    assignedToEmployeeId: string,
    user?: { id: string; name: string; role: string }
  ): Ticket | undefined {
    return StorageEngine.update<Ticket>(STORAGE_KEYS.TICKETS, id, {
      assignedToEmployeeId,
      status: 'In Progress',
      updatedAt: new Date().toISOString(),
    });
  }

  public static resolveTicket(
    id: string,
    resolutionNotes?: string,
    user?: { id: string; name: string; role: string }
  ): Ticket | undefined {
    return this.updateStatus(id, 'Resolved', resolutionNotes, user);
  }

  public static addComment(
    ticketId: string,
    comment: {
      authorUserId: string;
      authorName: string;
      authorRole: string;
      message: string;
      isInternalOnly: boolean;
      attachments?: string[];
    }
  ): Ticket | undefined {
    const ticket = this.getById(ticketId);
    if (!ticket) return undefined;

    const newComment: TicketComment = {
      id: `tcom-${Date.now()}`,
      ticketId,
      ...comment,
      createdAt: new Date().toISOString(),
    };

    const comments = [...(ticket.comments || []), newComment];
    return StorageEngine.update<Ticket>(STORAGE_KEYS.TICKETS, ticketId, {
      comments,
      updatedAt: new Date().toISOString(),
    });
  }
}
