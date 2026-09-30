// Master Payroll Cycle Configuration & Calculation Service
import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { PayrollCycle, Employee } from '../../database/schema';
import { AuditService } from '../auditService';
import { EmployeeService } from '../employeeService';

export interface CalculatedPayrollPeriodDates {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalDays: number;
  periodLabel: string;
  startDay: number;
  endDay: number;
}

export class PayrollCycleService {
  /**
   * Retrieves all payroll cycles for a tenant
   */
  public static getAll(tenantId?: string): PayrollCycle[] {
    const targetTenant = tenantId || StorageEngine.getActiveTenantId();
    const list = StorageEngine.getList<PayrollCycle>(STORAGE_KEYS.PAYROLL_CYCLES);
    const tenantCycles = list.filter(c => !c.organizationId || c.organizationId === targetTenant || c.organizationId === 'NP-000001');
    if (tenantCycles.length === 0) {
      return list;
    }
    return tenantCycles;
  }

  /**
   * Retrieves a single payroll cycle by ID
   */
  public static getById(id: string): PayrollCycle | undefined {
    const list = StorageEngine.getList<PayrollCycle>(STORAGE_KEYS.PAYROLL_CYCLES);
    return list.find(c => c.id === id);
  }

  /**
   * Retrieves the default cycle for a tenant (or falls back to first active cycle)
   */
  public static getDefaultCycle(tenantId?: string): PayrollCycle {
    const cycles = this.getAll(tenantId);
    const def = cycles.find(c => c.isDefault && c.status === 'Active');
    if (def) return def;
    const active = cycles.find(c => c.status === 'Active');
    if (active) return active;
    if (cycles.length > 0) return cycles[0];

    // Fallback default
    return {
      id: 'cycle-001',
      organizationId: tenantId || StorageEngine.getActiveTenantId(),
      name: 'Monthly Standard (1st to End of Month)',
      startDay: 1,
      endDay: 31,
      isDefault: true,
      status: 'Active',
      description: 'Standard calendar month payroll cycle from 1st to 30th/31st.',
      createdBy: 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a new Payroll Cycle
   */
  public static create(
    data: Omit<PayrollCycle, 'id' | 'createdAt' | 'updatedAt'>,
    user: string = 'Super Admin'
  ): PayrollCycle {
    const tenantId = data.organizationId || StorageEngine.getActiveTenantId();
    const newCycle: PayrollCycle = {
      ...data,
      id: `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      organizationId: tenantId,
      startDay: Math.max(1, Math.min(31, Number(data.startDay))),
      endDay: Math.max(1, Math.min(31, Number(data.endDay))),
      status: data.status || 'Active',
      createdBy: user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (newCycle.isDefault) {
      // Unset other defaults in the same tenant
      const all = StorageEngine.getList<PayrollCycle>(STORAGE_KEYS.PAYROLL_CYCLES);
      const updatedList = all.map(c =>
        c.organizationId === tenantId ? { ...c, isDefault: false } : c
      );
      StorageEngine.setList(STORAGE_KEYS.PAYROLL_CYCLES, updatedList);
    }

    const created = StorageEngine.insert<PayrollCycle>(STORAGE_KEYS.PAYROLL_CYCLES, newCycle);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'CREATE',
      description: `Created new payroll cycle: "${created.name}" (${created.startDay}th to ${created.endDay}th)`,
      recordId: created.id,
    });

    return created;
  }

  /**
   * Update an existing Payroll Cycle
   */
  public static update(
    id: string,
    updates: Partial<PayrollCycle>,
    user: string = 'Super Admin'
  ): PayrollCycle | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    if (updates.isDefault) {
      const all = StorageEngine.getList<PayrollCycle>(STORAGE_KEYS.PAYROLL_CYCLES);
      const updatedList = all.map(c =>
        c.organizationId === existing.organizationId ? { ...c, isDefault: false } : c
      );
      StorageEngine.setList(STORAGE_KEYS.PAYROLL_CYCLES, updatedList);
    }

    const updated = StorageEngine.update<PayrollCycle>(STORAGE_KEYS.PAYROLL_CYCLES, id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      AuditService.log({
        userId: 'user-001',
        userName: user,
        userRole: 'Super Admin',
        module: 'Payroll Configuration',
        action: 'UPDATE',
        description: `Updated payroll cycle "${updated.name}" (${updated.startDay}th to ${updated.endDay}th)`,
        recordId: updated.id,
      });
    }

    return updated;
  }

  /**
   * Toggle Active / Inactive status
   */
  public static toggleStatus(id: string, user: string = 'Super Admin'): PayrollCycle | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const newStatus = existing.status === 'Active' ? 'Inactive' : 'Active';
    return this.update(id, { status: newStatus }, user);
  }

  /**
   * Safe Delete Payroll Cycle
   */
  public static delete(id: string, user: string = 'Super Admin'): { success: boolean; message: string } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, message: 'Payroll cycle not found.' };
    }

    if (existing.isDefault) {
      return { success: false, message: 'Cannot delete the default payroll cycle. Please designate another default cycle first.' };
    }

    // Check employee mapping
    const employees = EmployeeService.getAll();
    const mappedEmployees = employees.filter(e => e.payrollCycleId === id);
    if (mappedEmployees.length > 0) {
      return {
        success: false,
        message: `Cannot delete "${existing.name}" because it is currently assigned to ${mappedEmployees.length} employee(s). Please reassign them or deactivate this cycle instead.`,
      };
    }

    StorageEngine.remove(STORAGE_KEYS.PAYROLL_CYCLES, id);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'DELETE',
      description: `Deleted payroll cycle "${existing.name}" (ID: ${id})`,
      recordId: id,
    });

    return { success: true, message: `Payroll cycle "${existing.name}" deleted successfully.` };
  }

  /**
   * Get employee count assigned to this cycle
   */
  public static getAssignedEmployeeCount(cycleId: string, tenantId?: string): number {
    const employees = EmployeeService.getAll();
    return employees.filter(e => e.payrollCycleId === cycleId).length;
  }

  /**
   * CALCULATE EXACT PERIOD DATES FOR ATTENDANCE RETRIEVAL
   * Correctly handles:
   * 1. 1st to End of Month (1st to 30th/31st/28th/29th)
   * 2. Mid-month (e.g. 20th to 19th / 20th)
   * 3. Custom cutoffs (e.g. 26th to 25th, 15th to 14th)
   * 4. February 28/29 leap year boundaries
   * 5. Year transitions (December -> January)
   */
  public static calculatePeriodDates(
    cycle: PayrollCycle,
    year: number,
    month: number
  ): CalculatedPayrollPeriodDates {
    const startDay = cycle.startDay || 1;
    const endDay = cycle.endDay || 31;

    // Standard Monthly: 1st of month to end of month
    if (startDay === 1) {
      const daysInMonth = new Date(year, month, 0).getDate();
      const actualEndDay = Math.min(endDay, daysInMonth);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${actualEndDay.toString().padStart(2, '0')}`;
      const totalDays = actualEndDay;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      return {
        startDate,
        endDate,
        totalDays,
        periodLabel: `1 ${monthNames[month - 1]} ${year} – ${actualEndDay} ${monthNames[month - 1]} ${year}`,
        startDay: 1,
        endDay: actualEndDay,
      };
    }

    // Cross-Month Cycle (e.g. 20th of prev month to 19th of target month, or 26th to 25th)
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const prevMonthDays = new Date(prevYear, prevMonth, 0).getDate();
    const targetMonthDays = new Date(year, month, 0).getDate();

    const actualStartDay = Math.min(startDay, prevMonthDays);
    const actualEndDay = Math.min(endDay, targetMonthDays);

    const startDate = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${actualStartDay.toString().padStart(2, '0')}`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${actualEndDay.toString().padStart(2, '0')}`;

    const startObj = new Date(prevYear, prevMonth - 1, actualStartDay);
    const endObj = new Date(year, month - 1, actualEndDay);
    const diffTime = Math.abs(endObj.getTime() - startObj.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const periodLabel = `${actualStartDay} ${monthNames[prevMonth - 1]} ${prevYear} – ${actualEndDay} ${monthNames[month - 1]} ${year}`;

    return {
      startDate,
      endDate,
      totalDays,
      periodLabel,
      startDay: actualStartDay,
      endDay: actualEndDay,
    };
  }
}
