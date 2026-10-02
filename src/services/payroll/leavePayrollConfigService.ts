// ====================================================================
// Payroll Configuration: Leave Configuration & Entitlement Service
// Central rules engine for Paid & Unpaid leave types, accrual & payroll LOP impact
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { LeaveType, LeaveBalance, LeaveApplication } from '../../database/schema';
import { AuditService } from '../auditService';
import { EmployeeService } from '../employeeService';

export interface LeaveImpactResult {
  leaveType: LeaveType;
  isPaid: boolean;
  requestedDays: number;
  availableBalance: number;
  paidDays: number;
  lopDays: number; // Converted to LWP / Loss of Pay if balance exhausted or unpaid
  salaryDeductionApplies: boolean;
  statusMessage: string;
}

export class LeavePayrollConfigService {
  /**
   * Retrieves all leave types configured for the active tenant
   */
  public static getAll(tenantId?: string): LeaveType[] {
    const targetTenant = tenantId || StorageEngine.getActiveTenantId();
    const list = StorageEngine.getList<LeaveType>(STORAGE_KEYS.LEAVE_TYPES);
    const tenantTypes = list.filter(
      t => !t.organizationId || t.organizationId === targetTenant || t.organizationId === 'org-novapulse-01' || t.organizationId === 'NP-000001'
    );
    return tenantTypes.length > 0 ? tenantTypes : list;
  }

  /**
   * Retrieves a single leave type by its ID
   */
  public static getById(id: string): LeaveType | undefined {
    const list = StorageEngine.getList<LeaveType>(STORAGE_KEYS.LEAVE_TYPES);
    return list.find(t => t.id === id);
  }

  /**
   * Retrieves a leave type by its uppercase code (e.g. "SL", "CL", "EL", "LOP", "LWP")
   */
  public static getByCode(code: string, tenantId?: string): LeaveType | undefined {
    const list = this.getAll(tenantId);
    return list.find(t => t.code.toUpperCase() === code.trim().toUpperCase());
  }

  /**
   * Create a new leave type rule configuration
   */
  public static create(
    data: Omit<LeaveType, 'id' | 'createdAt' | 'updatedAt'>,
    user: string = 'Super Admin'
  ): LeaveType {
    const tenantId = data.organizationId || StorageEngine.getActiveTenantId();
    const annualQuota = Number(data.annualQuota) || Number(data.annualEntitlement) || 0;
    const monthlyEntitlement = data.monthlyEntitlement !== undefined 
      ? Number(data.monthlyEntitlement) 
      : Number((annualQuota / 12).toFixed(2));

    const newType: LeaveType = {
      ...data,
      id: `lt-${data.code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`,
      organizationId: tenantId,
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      description: data.description || '',
      annualQuota,
      annualEntitlement: annualQuota,
      monthlyEntitlement,
      accrualFrequency: data.accrualFrequency || 'monthly',
      carryForwardMax: Number(data.carryForwardMax) || Number(data.maxCarryForwardDays) || 0,
      maxCarryForwardDays: Number(data.carryForwardMax) || Number(data.maxCarryForwardDays) || 0,
      maxBalance: data.maxBalance ? Number(data.maxBalance) : annualQuota * 2,
      isHalfDayAllowed: !!data.isHalfDayAllowed,
      requiresDoc: !!data.requiresDoc,
      isPaid: data.isPaid !== undefined ? !!data.isPaid : true,
      status: data.status || 'Active',
      color: data.color || (data.isPaid ? '#10b981' : '#f59e0b'),
      createdBy: user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = StorageEngine.insert<LeaveType>(STORAGE_KEYS.LEAVE_TYPES, newType);

    // Automatically initialize balances for all active employees
    this.syncBalancesForNewLeaveType(created, tenantId);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'CREATE',
      description: `Created Leave Rule "${created.name}" (${created.code}) — Classification: ${created.isPaid ? 'PAID' : 'UNPAID / LWP'}, Quota: ${created.annualQuota} days/yr`,
      recordId: created.id,
    });

    return created;
  }

  /**
   * Update an existing leave type rule
   */
  public static update(
    id: string,
    updates: Partial<LeaveType>,
    user: string = 'Super Admin'
  ): LeaveType | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const annualQuota = updates.annualQuota !== undefined 
      ? Number(updates.annualQuota) 
      : (updates.annualEntitlement !== undefined ? Number(updates.annualEntitlement) : existing.annualQuota);

    const monthlyEntitlement = updates.monthlyEntitlement !== undefined
      ? Number(updates.monthlyEntitlement)
      : (updates.annualQuota !== undefined ? Number((annualQuota / 12).toFixed(2)) : existing.monthlyEntitlement);

    const carryForwardMax = updates.carryForwardMax !== undefined
      ? Number(updates.carryForwardMax)
      : (updates.maxCarryForwardDays !== undefined ? Number(updates.maxCarryForwardDays) : existing.carryForwardMax);

    const updated = StorageEngine.update<LeaveType>(STORAGE_KEYS.LEAVE_TYPES, id, {
      ...updates,
      annualQuota,
      annualEntitlement: annualQuota,
      monthlyEntitlement,
      carryForwardMax,
      maxCarryForwardDays: carryForwardMax,
      updatedAt: new Date().toISOString(),
    });

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'UPDATE',
      description: `Updated Leave Rule "${existing.name}" (${existing.code}) — Classification: ${updated?.isPaid ? 'PAID' : 'UNPAID / LWP'}`,
      recordId: id,
    });

    return updated;
  }

  /**
   * Delete a leave type
   */
  public static delete(id: string, user: string = 'Super Admin'): { success: boolean; message: string } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, message: 'Leave type not found.' };
    }

    // Check if active applications exist
    const apps = StorageEngine.getList<LeaveApplication>(STORAGE_KEYS.LEAVE_APPLICATIONS);
    const activeUsage = apps.filter(a => a.leaveTypeId === id && a.status === 'approved');
    if (activeUsage.length > 0) {
      return {
        success: false,
        message: `Cannot delete "${existing.name}" because it is referenced in ${activeUsage.length} approved leave application(s). Please deactivate it instead.`,
      };
    }

    StorageEngine.remove(STORAGE_KEYS.LEAVE_TYPES, id);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'DELETE',
      description: `Deleted Leave Rule "${existing.name}" (${existing.code})`,
      recordId: id,
    });

    return { success: true, message: `Leave Rule "${existing.name}" deleted successfully.` };
  }

  /**
   * Synchronize / initialize leave balances for a newly created leave type across all employees
   */
  private static syncBalancesForNewLeaveType(leaveType: LeaveType, tenantId: string): void {
    const employees = EmployeeService.getAll().filter(
      e => (e.organizationId === tenantId || (e as any).tenantId === tenantId) && e.employmentStatus === 'Active'
    );
    const balances = StorageEngine.getList<LeaveBalance>(STORAGE_KEYS.LEAVE_BALANCES);
    const currentYear = new Date().getFullYear();

    employees.forEach(emp => {
      const exists = balances.some(b => b.employeeId === emp.id && b.leaveTypeId === leaveType.id && b.year === currentYear);
      if (!exists) {
        balances.push({
          id: `lb-${emp.id}-${leaveType.id}-${currentYear}`,
          organizationId: tenantId,
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          year: currentYear,
          allocated: leaveType.isPaid ? leaveType.annualQuota : 0,
          used: 0,
          pending: 0,
          balance: leaveType.isPaid ? leaveType.annualQuota : 0,
        });
      }
    });

    StorageEngine.setList(STORAGE_KEYS.LEAVE_BALANCES, balances);
  }

  /**
   * Retrieves leave balance bucket for an employee
   */
  public static getEmployeeBalances(employeeId: string, year: number = 2026): LeaveBalance[] {
    const list = StorageEngine.getList<LeaveBalance>(STORAGE_KEYS.LEAVE_BALANCES);
    return list.filter(b => b.employeeId === employeeId && b.year === year);
  }

  /**
   * CORE PAYROLL CALCULATION RULE:
   * Leave Bucket -> Leave Availability -> Payroll Deduction
   * 
   * Case 1 (Paid Available): Employee takes Paid Leave, has balance >= days -> 0 salary deduction (0 LOP days).
   * Case 2 (Paid Exhausted): Employee has 0 balance, takes Paid Leave -> excess days treated as Unpaid / LOP (salary deduction applied).
   * Case 3 (Explicit Unpaid / LWP): Day is treated as unpaid, salary deduction is calculated, paid balance untouched.
   */
  public static evaluateLeaveImpact(params: {
    employeeId: string;
    leaveTypeId: string;
    totalDays: number;
    year?: number;
  }): LeaveImpactResult {
    const { employeeId, leaveTypeId, totalDays, year = 2026 } = params;
    const leaveType = this.getById(leaveTypeId) || {
      id: leaveTypeId,
      organizationId: StorageEngine.getActiveTenantId(),
      name: 'Unspecified Leave',
      code: 'LEAVE',
      description: '',
      annualQuota: 0,
      accrualFrequency: 'annual',
      carryForwardMax: 0,
      isHalfDayAllowed: true,
      requiresDoc: false,
      isPaid: true,
      color: '#3b82f6',
    };

    // Case 3: Explicit Unpaid / LWP Leave
    if (!leaveType.isPaid || leaveType.code.toUpperCase() === 'LOP' || leaveType.code.toUpperCase() === 'LWP') {
      return {
        leaveType,
        isPaid: false,
        requestedDays: totalDays,
        availableBalance: 0,
        paidDays: 0,
        lopDays: totalDays,
        salaryDeductionApplies: true,
        statusMessage: `Explicit Unpaid Leave (${leaveType.name}): ${totalDays} day(s) deducted as LOP from payroll.`,
      };
    }

    // Check Employee Paid Balance Bucket
    const balances = this.getEmployeeBalances(employeeId, year);
    const balanceRecord = balances.find(b => b.leaveTypeId === leaveTypeId);
    const availableBalance = balanceRecord ? Math.max(0, balanceRecord.balance) : 0;

    // Case 1: Paid Available
    if (availableBalance >= totalDays) {
      return {
        leaveType,
        isPaid: true,
        requestedDays: totalDays,
        availableBalance,
        paidDays: totalDays,
        lopDays: 0,
        salaryDeductionApplies: false,
        statusMessage: `Paid Leave Available: ${totalDays} day(s) covered by ${leaveType.name} balance (${availableBalance} left). 0 salary deduction.`,
      };
    }

    // Case 2: Paid Exhausted or Partial Exhaustion
    const coveredPaidDays = availableBalance;
    const excessLopDays = totalDays - coveredPaidDays;

    return {
      leaveType,
      isPaid: true,
      requestedDays: totalDays,
      availableBalance,
      paidDays: coveredPaidDays,
      lopDays: excessLopDays,
      salaryDeductionApplies: excessLopDays > 0,
      statusMessage: `Paid Balance Exhausted: ${coveredPaidDays} day(s) paid, ${excessLopDays} excess day(s) converted to Unpaid / LOP deduction.`,
    };
  }
}
