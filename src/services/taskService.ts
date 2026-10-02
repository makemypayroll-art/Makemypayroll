// NovaPulse HRMS — Task Management & Sequential Project Workflow Service
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import {
  TaskItem,
  TaskSubtask,
  TaskComment,
  TaskActivity,
  TaskAttachment,
  TaskPriority,
  TaskStatus,
  TeamProject,
  ProjectStage,
  ProjectComment,
  ProjectActivity,
  ProjectStatus,
  ProjectStageStatus,
  WorkflowTemplate,
  Employee,
  Department,
  Designation,
  User,
  Notification,
} from '../database/schema';
import { AuditService } from './auditService';

export class TaskService {
  // -------------------------------------------------------------
  // NOTIFICATION & AUDIT HELPERS
  // -------------------------------------------------------------
  private static sendNotification(params: {
    recipientUserId?: string;
    recipientEmployeeId?: string;
    title: string;
    message: string;
    type: 'task' | 'project';
    link?: string;
    tenantId?: string;
  }) {
    const orgId = params.tenantId || StorageEngine.getActiveTenantId();
    const newNotif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      organizationId: orgId,
      recipientUserId: params.recipientUserId,
      recipientEmployeeId: params.recipientEmployeeId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    StorageEngine.insert<Notification>(STORAGE_KEYS.NOTIFICATIONS, newNotif);
  }

  private static isMatchingTenant(itemOrgId?: string, itemTenantId?: string, targetTenantId?: string): boolean {
    const active = targetTenantId || StorageEngine.getActiveTenantId();
    if (!active || active === 'NP-000001' || active === 'org-novapulse-01' || active === 'all') return true;
    return itemOrgId === active || itemTenantId === active;
  }

  // -------------------------------------------------------------
  // REPORTING HIERARCHY SECURITY RESOLVER
  // -------------------------------------------------------------
  public static getAssignableEmployees(
    currentUser: User,
    currentEmployee?: Employee,
    tenantId?: string
  ): Employee[] {
    const activeTenantId = tenantId || StorageEngine.getActiveTenantId();
    const allEmployees = StorageEngine.getList<Employee>(STORAGE_KEYS.EMPLOYEES).filter(
      e => this.isMatchingTenant(e.organizationId, (e as any).tenantId, activeTenantId) &&
           e.employmentStatus === 'Active'
    );
    const allDepartments = StorageEngine.getList<Department>(STORAGE_KEYS.DEPARTMENTS).filter(
      d => this.isMatchingTenant(d.organizationId, undefined, activeTenantId)
    );

    const isSuperOrHR =
      currentUser.roleName === 'Super Admin' ||
      (currentUser.roleName as string) === 'Tenant Admin' ||
      currentUser.roleName === 'HR Admin' ||
      (currentUser.roleName as string) === 'HR Manager';

    if (isSuperOrHR || !currentEmployee) {
      return allEmployees;
    }

    // Check if current employee is Department Head
    const isDeptHead = allDepartments.some(
      d => d.headEmployeeId === currentEmployee.id || d.headEmployeeName === `${currentEmployee.firstName} ${currentEmployee.lastName}`
    );

    const assignableIds = new Set<string>();
    assignableIds.add(currentEmployee.id); // Can always assign to self

    // If Department Head: all employees in their department
    if (isDeptHead) {
      allEmployees
        .filter(e => e.departmentId === currentEmployee.departmentId)
        .forEach(e => assignableIds.add(e.id));
    }

    // Recursive helper to get downstream direct/indirect reportees
    const addDownstreamReportees = (managerId: string) => {
      const directReportees = allEmployees.filter(e => e.reportingManagerId === managerId);
      for (const rep of directReportees) {
        if (!assignableIds.has(rep.id)) {
          assignableIds.add(rep.id);
          addDownstreamReportees(rep.id);
        }
      }
    };

    addDownstreamReportees(currentEmployee.id);

    return allEmployees.filter(e => assignableIds.has(e.id));
  }

  // -------------------------------------------------------------
  // TASK CRUD & QUERIES
  // -------------------------------------------------------------
  public static getAllTasks(tenantId?: string): TaskItem[] {
    const activeTenantId = tenantId || StorageEngine.getActiveTenantId();
    return StorageEngine.getList<TaskItem>(STORAGE_KEYS.TASKS).filter(
      t => this.isMatchingTenant(t.organizationId, t.tenantId, activeTenantId)
    );
  }

  public static getTaskById(id: string): TaskItem | undefined {
    return StorageEngine.getList<TaskItem>(STORAGE_KEYS.TASKS).find(t => t.id === id);
  }

  public static getMyTasks(employeeId: string, tenantId?: string): TaskItem[] {
    const tasks = this.getAllTasks(tenantId);
    return tasks.filter(t => t.assignedToId === employeeId);
  }

  public static getAssignedTasks(
    currentEmpId: string,
    isSuperOrHR: boolean,
    currentUserId: string,
    tenantId?: string
  ): TaskItem[] {
    const tasks = this.getAllTasks(tenantId);
    if (isSuperOrHR) {
      return tasks;
    }

    // Return tasks assigned by current user/employee or assigned to employees reporting to them
    const currentEmp = StorageEngine.getList<Employee>(STORAGE_KEYS.EMPLOYEES).find(e => e.id === currentEmpId);
    const mockUser: User = { id: currentUserId, roleName: 'Manager' } as any;
    const permittedEmployees = this.getAssignableEmployees(mockUser, currentEmp, tenantId);
    const permittedIds = new Set(permittedEmployees.map(e => e.id));

    return tasks.filter(
      t =>
        t.assignedById === currentEmpId ||
        t.assignedById === currentUserId ||
        (t.assignedToId && permittedIds.has(t.assignedToId))
    );
  }

  public static createTask(
    params: {
      title: string;
      description: string;
      assignedToId: string;
      priority: TaskPriority;
      category: string;
      startDate: string;
      dueDate: string;
      designationId?: string;
      designationTitle?: string;
      departmentId?: string;
      departmentName?: string;
      additionalInstructions?: string;
      attachments?: TaskAttachment[];
      subtasks?: Array<{ title: string; isCompleted?: boolean }>;
    },
    currentUser: User,
    currentEmployee?: Employee
  ): TaskItem {
    const activeTenantId = StorageEngine.getActiveTenantId();
    const allTasks = StorageEngine.getList<TaskItem>(STORAGE_KEYS.TASKS);
    
    // Auto-generate code e.g. TSK-1001
    const nextNum = allTasks.length + 1001;
    const taskCode = `TSK-${nextNum}`;

    // Resolve assignee details
    const allEmployees = StorageEngine.getList<Employee>(STORAGE_KEYS.EMPLOYEES);
    const allDepartments = StorageEngine.getList<Department>(STORAGE_KEYS.DEPARTMENTS);
    const allDesignations = StorageEngine.getList<Designation>(STORAGE_KEYS.DESIGNATIONS);

    const assignee = allEmployees.find(e => e.id === params.assignedToId);
    const assigneeDept = assignee ? allDepartments.find(d => d.id === assignee.departmentId) : undefined;
    const assigneeDesig = assignee ? allDesignations.find(d => d.id === assignee.designationId) : undefined;

    const assignerName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'System Admin';

    const assignerId = currentEmployee?.id || currentUser.id;
    const nowIso = new Date().toISOString();

    // Prepare subtasks
    const subtasksList: TaskSubtask[] = (params.subtasks || []).map((s, idx) => ({
      id: `sub-${Date.now()}-${idx + 1}`,
      taskId: '',
      title: s.title.trim(),
      isCompleted: !!s.isCompleted,
      completedAt: s.isCompleted ? nowIso : undefined,
      completedBy: s.isCompleted ? assignerName : undefined,
    }));

    const completedSub = subtasksList.filter(s => s.isCompleted).length;
    const initialProgress = subtasksList.length > 0 ? Math.round((completedSub / subtasksList.length) * 100) : 0;
    const initialStatus: TaskStatus = initialProgress === 100 ? 'Completed' : 'Not Started';

    const newTask: TaskItem = {
      id: `tsk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskCode,
      organizationId: activeTenantId,
      tenantId: activeTenantId,
      title: params.title.trim(),
      description: params.description.trim(),
      assignedById: assignerId,
      assignedByName: assignerName,
      assignedToId: params.assignedToId,
      assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned',
      assignedToAvatar: assignee?.avatarUrl || (assignee as any)?.photo,
      departmentId: params.departmentId || assignee?.departmentId,
      departmentName: params.departmentName || assigneeDept?.name || 'General',
      designationId: params.designationId || assignee?.designationId,
      designationTitle: params.designationTitle || assigneeDesig?.title || '',
      priority: params.priority || 'Medium',
      category: params.category || 'General',
      startDate: params.startDate || new Date().toISOString().split('T')[0],
      dueDate: params.dueDate || new Date().toISOString().split('T')[0],
      status: initialStatus,
      progress: initialProgress,
      subtasks: subtasksList,
      attachments: params.attachments || [],
      additionalInstructions: params.additionalInstructions,
      comments: [],
      activities: [
        {
          id: `act-${Date.now()}`,
          taskId: '',
          userId: currentUser.id,
          userName: assignerName,
          action: 'Task Created',
          details: `Created task "${params.title}" and assigned to ${assignee ? assignee.firstName + ' ' + assignee.lastName : 'employee'} with ${params.priority} priority.`,
          timestamp: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    newTask.subtasks.forEach(s => (s.taskId = newTask.id));
    newTask.activities[0].taskId = newTask.id;

    StorageEngine.insert<TaskItem>(STORAGE_KEYS.TASKS, newTask);

    // Audit Logging
    AuditService.log(
      'CREATE',
      'Task Management',
      `Created task ${taskCode}: "${newTask.title}" assigned to ${newTask.assignedToName}`,
      { id: currentUser.id, name: assignerName, role: currentUser.roleName },
      { recordId: newTask.id, newValue: newTask }
    );

    // In-App Notification
    if (params.assignedToId) {
      this.sendNotification({
        recipientEmployeeId: params.assignedToId,
        title: `New Task Assigned: ${taskCode}`,
        message: `${assignerName} assigned you "${newTask.title}" (Due: ${newTask.dueDate}).`,
        type: 'task',
        link: '/tasks',
        tenantId: activeTenantId,
      });
    }

    return newTask;
  }

  public static updateTask(
    id: string,
    updates: Partial<Omit<TaskItem, 'id' | 'taskCode' | 'organizationId' | 'createdAt'>>,
    currentUser: User,
    currentEmployee?: Employee
  ): TaskItem | undefined {
    const task = this.getTaskById(id);
    if (!task) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const nowIso = new Date().toISOString();
    const prevStatus = task.status;
    const prevProgress = task.progress;

    const newActivities = [...(task.activities || [])];

    // Log progress/status activity
    if (updates.status && updates.status !== prevStatus) {
      newActivities.push({
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        taskId: id,
        userId: currentUser.id,
        userName,
        action: 'Status Changed',
        details: `Status updated from "${prevStatus}" to "${updates.status}".`,
        timestamp: nowIso,
      });
    }

    if (updates.progress !== undefined && updates.progress !== prevProgress) {
      newActivities.push({
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        taskId: id,
        userId: currentUser.id,
        userName,
        action: 'Progress Updated',
        details: `Progress adjusted from ${prevProgress}% to ${updates.progress}%.`,
        timestamp: nowIso,
      });
    }

    if (updates.assignedToId && updates.assignedToId !== task.assignedToId) {
      const allEmployees = StorageEngine.getList<Employee>(STORAGE_KEYS.EMPLOYEES);
      const newAssignee = allEmployees.find(e => e.id === updates.assignedToId);
      if (newAssignee) {
        updates.assignedToName = `${newAssignee.firstName} ${newAssignee.lastName}`;
        updates.assignedToAvatar = newAssignee.avatarUrl || (newAssignee as any).photo;
        newActivities.push({
          id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          taskId: id,
          userId: currentUser.id,
          userName,
          action: 'Reassigned',
          details: `Reassigned to ${updates.assignedToName}.`,
          timestamp: nowIso,
        });
      }
    }

    // Auto-mark completed date and 100% progress if status is Completed
    let completedAt = task.completedAt;
    let progress = updates.progress !== undefined ? updates.progress : task.progress;
    if (updates.status === 'Completed') {
      completedAt = completedAt || nowIso;
      progress = 100;
    } else if (updates.status) {
      completedAt = undefined;
    }

    const updatedTask: TaskItem = {
      ...task,
      ...updates,
      progress,
      completedAt,
      activities: newActivities,
      updatedAt: nowIso,
    };

    StorageEngine.update<TaskItem>(STORAGE_KEYS.TASKS, id, updatedTask);

    AuditService.log(
      'UPDATE',
      'Task Management',
      `Updated task ${task.taskCode}: "${task.title}"`,
      { id: currentUser.id, name: userName, role: currentUser.roleName },
      { recordId: id, previousValue: task, newValue: updatedTask }
    );

    // Notify assigner if task status changed by assignee
    if (updates.status && updates.status !== prevStatus && task.assignedById !== currentEmployee?.id) {
      this.sendNotification({
        recipientEmployeeId: task.assignedById,
        title: `Task Status Update: ${task.taskCode}`,
        message: `${userName} updated status to "${updates.status}" for "${task.title}".`,
        type: 'task',
        link: '/tasks',
        tenantId: task.organizationId,
      });
    }

    return updatedTask;
  }

  public static deleteTask(id: string, currentUser: User, currentEmployee?: Employee): boolean {
    const task = this.getTaskById(id);
    if (!task) return false;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const removed = StorageEngine.remove<TaskItem>(STORAGE_KEYS.TASKS, id);
    if (removed) {
      AuditService.log(
        'DELETE',
        'Task Management',
        `Deleted task ${task.taskCode}: "${task.title}"`,
        { id: currentUser.id, name: userName, role: currentUser.roleName },
        { recordId: id, previousValue: task }
      );
    }
    return removed;
  }

  public static addTaskComment(
    taskId: string,
    content: string,
    currentUser: User,
    currentEmployee?: Employee,
    attachments?: string[]
  ): TaskItem | undefined {
    const task = this.getTaskById(taskId);
    if (!task || !content.trim()) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const nowIso = new Date().toISOString();

    const newComment: TaskComment = {
      id: `tcm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      authorId: currentEmployee?.id || currentUser.id,
      authorName: userName,
      authorRole: currentUser.roleName,
      departmentName: task.departmentName,
      content: content.trim(),
      attachments: attachments || [],
      createdAt: nowIso,
    };

    const newActivity: TaskActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      userId: currentUser.id,
      userName,
      action: 'Comment Added',
      details: `${userName} commented: "${content.length > 50 ? content.slice(0, 47) + '...' : content}"`,
      timestamp: nowIso,
    };

    const updatedTask: TaskItem = {
      ...task,
      comments: [...(task.comments || []), newComment],
      activities: [...(task.activities || []), newActivity],
      updatedAt: nowIso,
    };

    StorageEngine.update<TaskItem>(STORAGE_KEYS.TASKS, taskId, updatedTask);

    // Notify the other party
    const isAuthorAssignee = currentEmployee?.id === task.assignedToId;
    const recipientId = isAuthorAssignee ? task.assignedById : task.assignedToId;

    if (recipientId && recipientId !== (currentEmployee?.id || currentUser.id)) {
      this.sendNotification({
        recipientEmployeeId: recipientId,
        title: `New Comment on Task ${task.taskCode}`,
        message: `${userName}: "${content.slice(0, 60)}"`,
        type: 'task',
        link: '/tasks',
        tenantId: task.organizationId,
      });
    }

    return updatedTask;
  }

  public static addTaskAttachment(
    taskId: string,
    attachment: { name: string; url: string; size?: string },
    currentUser: User,
    currentEmployee?: Employee
  ): TaskItem | undefined {
    const task = this.getTaskById(taskId);
    if (!task) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const nowIso = new Date().toISOString();

    const newAtt: TaskAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: attachment.name,
      url: attachment.url,
      size: attachment.size || '1.2 MB',
      uploadDate: nowIso.split('T')[0],
    };

    const newActivity: TaskActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      userId: currentUser.id,
      userName,
      action: 'Attachment Uploaded',
      details: `Uploaded file "${attachment.name}".`,
      timestamp: nowIso,
    };

    const updatedTask: TaskItem = {
      ...task,
      attachments: [...(task.attachments || []), newAtt],
      activities: [...(task.activities || []), newActivity],
      updatedAt: nowIso,
    };

    StorageEngine.update<TaskItem>(STORAGE_KEYS.TASKS, taskId, updatedTask);
    return updatedTask;
  }

  // -------------------------------------------------------------
  // SUBTASKS & INTERACTIVE CHECKLIST ENGINE
  // -------------------------------------------------------------
  public static toggleSubtask(
    taskId: string,
    subtaskId: string,
    currentUser: User,
    currentEmployee?: Employee
  ): TaskItem | undefined {
    const task = this.getTaskById(taskId);
    if (!task) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const nowIso = new Date().toISOString();
    const subtasks = [...(task.subtasks || [])];
    const target = subtasks.find(s => s.id === subtaskId);
    if (!target) return undefined;

    target.isCompleted = !target.isCompleted;
    if (target.isCompleted) {
      target.completedAt = nowIso;
      target.completedBy = userName;
    } else {
      target.completedAt = undefined;
      target.completedBy = undefined;
    }

    const totalSub = subtasks.length;
    const compSub = subtasks.filter(s => s.isCompleted).length;
    const newProgress = totalSub > 0 ? Math.round((compSub / totalSub) * 100) : task.progress;

    let newStatus = task.status;
    let completedAt = task.completedAt;

    if (newProgress === 100) {
      newStatus = 'Completed';
      completedAt = completedAt || nowIso;
    } else if (task.status === 'Completed' && newProgress < 100) {
      newStatus = 'In Progress';
      completedAt = undefined;
    } else if (compSub > 0 && (task.status === 'Not Started' || task.status === 'Pending')) {
      newStatus = 'In Progress';
    }

    const newActivities = [...(task.activities || [])];
    newActivities.push({
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      userId: currentUser.id,
      userName,
      action: target.isCompleted ? 'Subtask Completed' : 'Subtask Reopened',
      details: `${userName} ${target.isCompleted ? 'completed' : 'reopened'} checklist item "${target.title}" (Progress: ${newProgress}%).`,
      timestamp: nowIso,
    });

    const updatedTask: TaskItem = {
      ...task,
      subtasks,
      progress: newProgress,
      status: newStatus,
      completedAt,
      activities: newActivities,
      updatedAt: nowIso,
    };

    StorageEngine.update<TaskItem>(STORAGE_KEYS.TASKS, taskId, updatedTask);

    AuditService.log(
      'UPDATE',
      'Task Management',
      `Toggled checklist item "${target.title}" on ${task.taskCode} -> ${target.isCompleted ? 'Done' : 'Pending'} (${newProgress}%)`,
      { id: currentUser.id, name: userName, role: currentUser.roleName },
      { recordId: taskId, newValue: updatedTask }
    );

    return updatedTask;
  }

  public static addSubtask(
    taskId: string,
    title: string,
    currentUser: User,
    currentEmployee?: Employee
  ): TaskItem | undefined {
    const task = this.getTaskById(taskId);
    if (!task || !title.trim()) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const nowIso = new Date().toISOString();
    const newSub: TaskSubtask = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      title: title.trim(),
      isCompleted: false,
    };

    const subtasks = [...(task.subtasks || []), newSub];
    const totalSub = subtasks.length;
    const compSub = subtasks.filter(s => s.isCompleted).length;
    const newProgress = Math.round((compSub / totalSub) * 100);

    let newStatus = task.status;
    let completedAt = task.completedAt;
    if (task.status === 'Completed' && newProgress < 100) {
      newStatus = 'In Progress';
      completedAt = undefined;
    }

    const newActivities = [...(task.activities || [])];
    newActivities.push({
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      userId: currentUser.id,
      userName,
      action: 'Subtask Added',
      details: `${userName} added subtask item: "${title.trim()}".`,
      timestamp: nowIso,
    });

    const updatedTask: TaskItem = {
      ...task,
      subtasks,
      progress: newProgress,
      status: newStatus,
      completedAt,
      activities: newActivities,
      updatedAt: nowIso,
    };

    StorageEngine.update<TaskItem>(STORAGE_KEYS.TASKS, taskId, updatedTask);
    return updatedTask;
  }

  public static deleteSubtask(
    taskId: string,
    subtaskId: string,
    currentUser: User,
    currentEmployee?: Employee
  ): TaskItem | undefined {
    const task = this.getTaskById(taskId);
    if (!task) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const nowIso = new Date().toISOString();
    const deletedSub = (task.subtasks || []).find(s => s.id === subtaskId);
    const subtasks = (task.subtasks || []).filter(s => s.id !== subtaskId);
    const totalSub = subtasks.length;
    const compSub = subtasks.filter(s => s.isCompleted).length;
    const newProgress = totalSub > 0 ? Math.round((compSub / totalSub) * 100) : 0;

    let newStatus = task.status;
    let completedAt = task.completedAt;
    if (totalSub > 0 && newProgress === 100) {
      newStatus = 'Completed';
      completedAt = completedAt || nowIso;
    } else if (task.status === 'Completed' && newProgress < 100) {
      newStatus = 'In Progress';
      completedAt = undefined;
    }

    const newActivities = [...(task.activities || [])];
    newActivities.push({
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      userId: currentUser.id,
      userName,
      action: 'Subtask Removed',
      details: `${userName} deleted subtask "${deletedSub?.title || subtaskId}".`,
      timestamp: nowIso,
    });

    const updatedTask: TaskItem = {
      ...task,
      subtasks,
      progress: newProgress,
      status: newStatus,
      completedAt,
      activities: newActivities,
      updatedAt: nowIso,
    };

    StorageEngine.update<TaskItem>(STORAGE_KEYS.TASKS, taskId, updatedTask);
    return updatedTask;
  }

  public static isTaskOverdue(task: TaskItem): boolean {
    if (task.status === 'Completed' || task.status === 'Cancelled') return false;
    const today = new Date().toISOString().split('T')[0];
    return task.dueDate < today;
  }

  public static sortTasks(tasks: TaskItem[]): TaskItem[] {
    const priorityWeight: Record<TaskPriority, number> = {
      Urgent: 4,
      High: 3,
      Medium: 2,
      Low: 1,
    };

    return [...tasks].sort((a, b) => {
      const aOverdue = TaskService.isTaskOverdue(a);
      const bOverdue = TaskService.isTaskOverdue(b);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // Nearest due date first
      if (a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }

      // Higher priority first
      const aP = priorityWeight[a.priority] || 0;
      const bP = priorityWeight[b.priority] || 0;
      return bP - aP;
    });
  }

  // -------------------------------------------------------------
  // TEAM PROJECTS & SEQUENTIAL DEPARTMENT WORKFLOWS
  // -------------------------------------------------------------
  public static getProjects(tenantId?: string): TeamProject[] {
    const activeTenantId = tenantId || StorageEngine.getActiveTenantId();
    return StorageEngine.getList<TeamProject>(STORAGE_KEYS.PROJECTS).filter(
      p => this.isMatchingTenant(p.organizationId, p.tenantId, activeTenantId)
    );
  }

  public static getProjectById(id: string): TeamProject | undefined {
    return StorageEngine.getList<TeamProject>(STORAGE_KEYS.PROJECTS).find(p => p.id === id);
  }

  public static createProject(
    params: {
      name: string;
      description: string;
      client: string;
      priority: TaskPriority;
      startDate: string;
      targetDate: string;
      departmentSequence: Array<{
        departmentId: string;
        departmentName: string;
        departmentColor?: string;
        assignedEmployeeId?: string;
        assignedEmployeeName?: string;
      }>;
      attachments?: Array<{ id: string; name: string; url: string; uploadDate: string }>;
    },
    currentUser: User,
    currentEmployee?: Employee
  ): TeamProject {
    const activeTenantId = StorageEngine.getActiveTenantId();
    const allProjects = StorageEngine.getList<TeamProject>(STORAGE_KEYS.PROJECTS);
    const nextNum = allProjects.length + 1001;
    const projectCode = `PRJ-${nextNum}`;

    const ownerName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'Project Lead';

    const ownerId = currentEmployee?.id || currentUser.id;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    // Build stages in sequential locked order
    const stages: ProjectStage[] = params.departmentSequence.map((d, idx) => ({
      id: `stg-${Date.now()}-${idx + 1}`,
      projectId: '',
      departmentId: d.departmentId,
      departmentName: d.departmentName,
      departmentColor: d.departmentColor || '#6366f1',
      sequence: idx + 1,
      assignedEmployeeId: d.assignedEmployeeId,
      assignedEmployeeName: d.assignedEmployeeName,
      status: (idx === 0 ? 'Active' : 'Locked') as ProjectStageStatus,
      startDate: idx === 0 ? todayStr : undefined,
      dueDate: params.targetDate,
      progress: 0,
      attachments: [],
    }));

    const firstStage = stages[0];

    const newProject: TeamProject = {
      id: `prj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectCode,
      organizationId: activeTenantId,
      tenantId: activeTenantId,
      name: params.name.trim(),
      description: params.description.trim(),
      client: params.client.trim(),
      ownerEmployeeId: ownerId,
      ownerName,
      priority: params.priority || 'High',
      startDate: params.startDate || todayStr,
      targetDate: params.targetDate,
      status: 'In Progress',
      currentDepartmentId: firstStage ? firstStage.departmentId : '',
      currentDepartmentName: firstStage ? firstStage.departmentName : '',
      currentStageIndex: 0,
      stages,
      attachments: params.attachments || [],
      comments: [],
      activities: [
        {
          id: `pact-${Date.now()}`,
          projectId: '',
          userId: currentUser.id,
          userName: ownerName,
          departmentName: firstStage?.departmentName,
          action: 'Project Initiated',
          details: `Project "${params.name}" initiated for client "${params.client}". Initial stage assigned to ${firstStage?.departmentName}.`,
          timestamp: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Update internal stage & activity references
    newProject.stages.forEach(s => (s.projectId = newProject.id));
    newProject.activities[0].projectId = newProject.id;

    StorageEngine.insert<TeamProject>(STORAGE_KEYS.PROJECTS, newProject);

    AuditService.log(
      'CREATE',
      'Project Workflow',
      `Created project ${projectCode}: "${newProject.name}" with ${stages.length} sequential stages`,
      { id: currentUser.id, name: ownerName, role: currentUser.roleName },
      { recordId: newProject.id, newValue: newProject }
    );

    // Send notification to stage 0 department / assigned employee
    if (firstStage?.assignedEmployeeId) {
      this.sendNotification({
        recipientEmployeeId: firstStage.assignedEmployeeId,
        title: `Project Stage Active: ${projectCode}`,
        message: `${ownerName} initiated "${newProject.name}". Stage 1 (${firstStage.departmentName}) is now Active.`,
        type: 'project',
        link: '/tasks',
        tenantId: activeTenantId,
      });
    }

    return newProject;
  }

  public static updateProject(
    id: string,
    updates: Partial<Omit<TeamProject, 'id' | 'projectCode' | 'organizationId' | 'createdAt'>>,
    currentUser: User,
    currentEmployee?: Employee
  ): TeamProject | undefined {
    const project = this.getProjectById(id);
    if (!project) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const nowIso = new Date().toISOString();

    const updatedProject: TeamProject = {
      ...project,
      ...updates,
      updatedAt: nowIso,
    };

    StorageEngine.update<TeamProject>(STORAGE_KEYS.PROJECTS, id, updatedProject);

    AuditService.log(
      'UPDATE',
      'Project Workflow',
      `Updated project ${project.projectCode}: "${project.name}"`,
      { id: currentUser.id, name: userName, role: currentUser.roleName },
      { recordId: id, previousValue: project, newValue: updatedProject }
    );

    return updatedProject;
  }

  public static deleteProject(id: string, currentUser: User, currentEmployee?: Employee): boolean {
    const project = this.getProjectById(id);
    if (!project) return false;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser.fullName || 'User';

    const removed = StorageEngine.remove<TeamProject>(STORAGE_KEYS.PROJECTS, id);
    if (removed) {
      AuditService.log(
        'DELETE',
        'Project Workflow',
        `Deleted project ${project.projectCode}: "${project.name}"`,
        { id: currentUser.id, name: userName, role: currentUser.roleName },
        { recordId: id, previousValue: project }
      );
    }
    return removed;
  }

  // -------------------------------------------------------------
  // SEQUENTIAL STAGE ADVANCE & RETURN ENGINE
  // -------------------------------------------------------------
  public static advanceProjectStage(
    projectId: string,
    submissionNotes: string,
    attachments?: Array<{ id: string; name: string; url: string; uploadDate: string }>,
    currentUser?: User,
    currentEmployee?: Employee
  ): TeamProject | undefined {
    const project = this.getProjectById(projectId);
    if (!project || project.status === 'Completed' || project.status === 'Cancelled') return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser?.fullName || 'Department Lead';

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    const currIdx = project.currentStageIndex;
    const stages = [...project.stages];
    const currentStage = stages[currIdx];

    if (!currentStage) return undefined;

    // Mark current stage completed
    currentStage.status = 'Completed';
    currentStage.progress = 100;
    currentStage.completedDate = todayStr;
    currentStage.submissionNotes = submissionNotes || 'Completed and handed off to next department.';
    if (attachments && attachments.length > 0) {
      currentStage.attachments = [...(currentStage.attachments || []), ...attachments];
    }

    const nextIdx = currIdx + 1;
    let nextStage: ProjectStage | undefined = undefined;
    let newProjectStatus: ProjectStatus = project.status;

    const newActivities = [...(project.activities || [])];

    if (nextIdx < stages.length) {
      // Advance to next stage
      nextStage = stages[nextIdx];
      nextStage.status = 'Active';
      nextStage.startDate = nextStage.startDate || todayStr;
      nextStage.progress = nextStage.progress || 0;

      newActivities.push({
        id: `pact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        stageId: nextStage.id,
        userId: currentUser?.id || 'system',
        userName,
        departmentName: currentStage.departmentName,
        action: 'Stage Advanced',
        details: `Stage ${currIdx + 1} (${currentStage.departmentName}) submitted to Stage ${nextIdx + 1} (${nextStage.departmentName}). Notes: "${submissionNotes || 'No notes'}"`,
        timestamp: nowIso,
      });

      // Notify next department/assignee
      if (nextStage.assignedEmployeeId) {
        this.sendNotification({
          recipientEmployeeId: nextStage.assignedEmployeeId,
          title: `Action Required: Project ${project.projectCode}`,
          message: `${userName} (${currentStage.departmentName}) handed off "${project.name}" to your department (${nextStage.departmentName}).`,
          type: 'project',
          link: '/tasks',
          tenantId: project.organizationId,
        });
      }
    } else {
      // Final stage completed -> Entire project completed
      newProjectStatus = 'Completed';
      newActivities.push({
        id: `pact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        userId: currentUser?.id || 'system',
        userName,
        departmentName: currentStage.departmentName,
        action: 'Project Completed',
        details: `Final Stage (${currentStage.departmentName}) completed. Project "${project.name}" successfully delivered.`,
        timestamp: nowIso,
      });

      // Notify project owner
      this.sendNotification({
        recipientEmployeeId: project.ownerEmployeeId,
        title: `Project Completed: ${project.projectCode}`,
        message: `All stages completed for "${project.name}" (${project.client}).`,
        type: 'project',
        link: '/tasks',
        tenantId: project.organizationId,
      });
    }

    const updatedProject: TeamProject = {
      ...project,
      status: newProjectStatus,
      currentStageIndex: nextIdx < stages.length ? nextIdx : currIdx,
      currentDepartmentId: nextStage ? nextStage.departmentId : currentStage.departmentId,
      currentDepartmentName: nextStage ? nextStage.departmentName : currentStage.departmentName,
      stages,
      activities: newActivities,
      updatedAt: nowIso,
    };

    StorageEngine.update<TeamProject>(STORAGE_KEYS.PROJECTS, projectId, updatedProject);

    AuditService.log(
      'UPDATE',
      'Project Workflow',
      `Advanced project ${project.projectCode} to stage: ${nextStage ? nextStage.departmentName : 'Completed'}`,
      { id: currentUser?.id || 'system', name: userName, role: currentUser?.roleName || 'User' },
      { recordId: projectId, previousValue: project, newValue: updatedProject }
    );

    return updatedProject;
  }

  public static returnProjectStage(
    projectId: string,
    returnReason: string,
    currentUser?: User,
    currentEmployee?: Employee
  ): TeamProject | undefined {
    const project = this.getProjectById(projectId);
    if (!project || project.status === 'Completed' || project.status === 'Cancelled') return undefined;

    const currIdx = project.currentStageIndex;
    if (currIdx <= 0) {
      throw new Error('Cannot return from the initial stage.');
    }

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser?.fullName || 'Department Lead';

    const nowIso = new Date().toISOString();
    const stages = [...project.stages];
    const currentStage = stages[currIdx];
    const prevIdx = currIdx - 1;
    const prevStage = stages[prevIdx];

    // Current stage marked as Returned
    currentStage.status = 'Returned';
    currentStage.returnReason = returnReason.trim();

    // Previous stage reopened to Active
    prevStage.status = 'Active';
    prevStage.completedDate = undefined;
    prevStage.progress = Math.max(10, prevStage.progress - 20);

    const newActivities = [...(project.activities || [])];
    newActivities.push({
      id: `pact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectId,
      stageId: prevStage.id,
      userId: currentUser?.id || 'system',
      userName,
      departmentName: currentStage.departmentName,
      action: 'Stage Returned',
      details: `Returned from ${currentStage.departmentName} to ${prevStage.departmentName}. Reason: "${returnReason}"`,
      timestamp: nowIso,
    });

    const updatedProject: TeamProject = {
      ...project,
      currentStageIndex: prevIdx,
      currentDepartmentId: prevStage.departmentId,
      currentDepartmentName: prevStage.departmentName,
      stages,
      activities: newActivities,
      updatedAt: nowIso,
    };

    StorageEngine.update<TeamProject>(STORAGE_KEYS.PROJECTS, projectId, updatedProject);

    AuditService.log(
      'UPDATE',
      'Project Workflow',
      `Returned project ${project.projectCode} to stage: ${prevStage.departmentName}. Reason: ${returnReason}`,
      { id: currentUser?.id || 'system', name: userName, role: currentUser?.roleName || 'User' },
      { recordId: projectId, previousValue: project, newValue: updatedProject }
    );

    // Notify previous department / assignee
    if (prevStage.assignedEmployeeId) {
      this.sendNotification({
        recipientEmployeeId: prevStage.assignedEmployeeId,
        title: `Stage Returned: Project ${project.projectCode}`,
        message: `${userName} (${currentStage.departmentName}) returned "${project.name}" for revision. Reason: "${returnReason}".`,
        type: 'project',
        link: '/tasks',
        tenantId: project.organizationId,
      });
    }

    return updatedProject;
  }

  public static addProjectComment(
    projectId: string,
    content: string,
    stageId?: string,
    currentUser?: User,
    currentEmployee?: Employee,
    attachments?: string[]
  ): TeamProject | undefined {
    const project = this.getProjectById(projectId);
    if (!project || !content.trim()) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser?.fullName || 'User';

    const nowIso = new Date().toISOString();

    const newComment: ProjectComment = {
      id: `pcm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectId,
      stageId,
      authorId: currentEmployee?.id || currentUser?.id || 'user-001',
      authorName: userName,
      departmentName: project.currentDepartmentName,
      content: content.trim(),
      attachments: attachments || [],
      createdAt: nowIso,
    };

    const newActivity: ProjectActivity = {
      id: `pact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectId,
      stageId,
      userId: currentUser?.id || 'system',
      userName,
      action: 'Comment Added',
      details: `${userName} commented: "${content.length > 50 ? content.slice(0, 47) + '...' : content}"`,
      timestamp: nowIso,
    };

    const updatedProject: TeamProject = {
      ...project,
      comments: [...(project.comments || []), newComment],
      activities: [...(project.activities || []), newActivity],
      updatedAt: nowIso,
    };

    StorageEngine.update<TeamProject>(STORAGE_KEYS.PROJECTS, projectId, updatedProject);
    return updatedProject;
  }

  public static addProjectAttachment(
    projectId: string,
    stageId: string | undefined,
    attachment: { name: string; url: string },
    currentUser?: User,
    currentEmployee?: Employee
  ): TeamProject | undefined {
    const project = this.getProjectById(projectId);
    if (!project) return undefined;

    const userName = currentEmployee
      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
      : currentUser?.fullName || 'User';

    const nowIso = new Date().toISOString();
    const newAtt = {
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: attachment.name,
      url: attachment.url,
      uploadDate: nowIso.split('T')[0],
    };

    const stages = [...project.stages];
    if (stageId) {
      const targetStage = stages.find(s => s.id === stageId);
      if (targetStage) {
        targetStage.attachments = [...(targetStage.attachments || []), newAtt];
      }
    }

    const updatedProject: TeamProject = {
      ...project,
      stages,
      attachments: [...(project.attachments || []), newAtt],
      activities: [
        ...(project.activities || []),
        {
          id: `pact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          projectId,
          stageId,
          userId: currentUser?.id || 'system',
          userName,
          action: 'Attachment Uploaded',
          details: `Uploaded file "${attachment.name}".`,
          timestamp: nowIso,
        },
      ],
      updatedAt: nowIso,
    };

    StorageEngine.update<TeamProject>(STORAGE_KEYS.PROJECTS, projectId, updatedProject);
    return updatedProject;
  }

  public static getWorkflowTemplates(tenantId?: string): WorkflowTemplate[] {
    const activeTenantId = tenantId || StorageEngine.getActiveTenantId();
    return StorageEngine.getList<WorkflowTemplate>(STORAGE_KEYS.WORKFLOW_TEMPLATES).filter(
      w => !w.organizationId || w.organizationId === activeTenantId
    );
  }
}
