// ====================================================================
// Holiday Master & Payroll Calendar Service (Reuses STORAGE_KEYS.HOLIDAYS)
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { Holiday } from '../../database/schema';
import { AuditService } from '../auditService';

export class HolidayPayrollService {
  /**
   * Retrieves all holidays for a tenant and optional branch/year
   */
  public static getAll(params?: { tenantId?: string; branchId?: string; year?: number }): Holiday[] {
    const targetTenant = params?.tenantId || StorageEngine.getActiveTenantId();
    const list = StorageEngine.getList<Holiday>(STORAGE_KEYS.HOLIDAYS);

    return list.filter(h => {
      // Multi-tenant check
      const matchesTenant = !h.organizationId || h.organizationId === targetTenant || h.organizationId === 'org-novapulse-01' || h.organizationId === 'NP-000001';
      if (!matchesTenant) return false;

      // Branch filter (if holiday is branch-specific)
      if (params?.branchId && params.branchId !== 'all' && h.branchId && h.branchId !== params.branchId) {
        return false;
      }

      // Year filter
      if (params?.year) {
        const holidayYear = new Date(h.date).getFullYear();
        if (holidayYear !== params.year) return false;
      }

      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Retrieves single holiday by ID
   */
  public static getById(id: string): Holiday | undefined {
    const list = StorageEngine.getList<Holiday>(STORAGE_KEYS.HOLIDAYS);
    return list.find(h => h.id === id);
  }

  /**
   * Creates a new Holiday (Stored directly into canonical HOLIDAYS table)
   */
  public static create(
    data: Omit<Holiday, 'id'>,
    user: string = 'Super Admin'
  ): Holiday {
    const newHoliday: Holiday = {
      ...data,
      id: `hol-${Date.now()}`,
    };

    StorageEngine.insert<Holiday>(STORAGE_KEYS.HOLIDAYS, newHoliday);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'CREATE',
      description: `Added company holiday: "${newHoliday.name}" on ${newHoliday.date}`,
      recordId: newHoliday.id,
    });

    return newHoliday;
  }

  /**
   * Updates an existing Holiday
   */
  public static update(
    id: string,
    updates: Partial<Holiday>,
    user: string = 'Super Admin'
  ): Holiday {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Holiday with ID "${id}" not found.`);
    }

    const updated: Holiday = {
      ...existing,
      ...updates,
    };

    StorageEngine.update<Holiday>(STORAGE_KEYS.HOLIDAYS, id, updated);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'UPDATE',
      description: `Updated holiday: "${updated.name}" (${updated.date})`,
      recordId: id,
    });

    return updated;
  }

  /**
   * Deletes a holiday
   */
  public static delete(
    id: string,
    user: string = 'Super Admin'
  ): { success: boolean; message: string } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, message: 'Holiday not found.' };
    }

    StorageEngine.remove(STORAGE_KEYS.HOLIDAYS, id);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'DELETE',
      description: `Deleted holiday "${existing.name}" (${existing.date})`,
      recordId: id,
    });

    return { success: true, message: `Holiday "${existing.name}" deleted successfully.` };
  }

  /**
   * Calculates total paid holidays falling within a payroll period date window
   */
  public static getHolidaysInPeriod(
    startDate: string,
    endDate: string,
    tenantId?: string,
    branchId?: string
  ): Holiday[] {
    const all = this.getAll({ tenantId, branchId });
    return all.filter(h => h.date >= startDate && h.date <= endDate);
  }
}
