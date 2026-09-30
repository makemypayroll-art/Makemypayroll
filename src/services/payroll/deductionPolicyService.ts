// ====================================================================
// Deductions & Penalties Master & Calculation Service
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { DeductionPolicy } from '../../database/schema';
import { AuditService } from '../auditService';
import { EmployeeService } from '../employeeService';

export class DeductionPolicyService {
  /**
   * Retrieves all deduction policies for a tenant
   */
  public static getAll(tenantId?: string): DeductionPolicy[] {
    const targetTenant = tenantId || StorageEngine.getActiveTenantId();
    const list = StorageEngine.getList<DeductionPolicy>(STORAGE_KEYS.DEDUCTION_POLICIES);
    const tenantDeductions = list.filter(
      d => !d.organizationId || d.organizationId === targetTenant || d.organizationId === 'NP-000001'
    );
    return tenantDeductions.length > 0 ? tenantDeductions : list;
  }

  /**
   * Retrieves a single deduction policy by ID
   */
  public static getById(id: string): DeductionPolicy | undefined {
    const list = StorageEngine.getList<DeductionPolicy>(STORAGE_KEYS.DEDUCTION_POLICIES);
    return list.find(d => d.id === id);
  }

  /**
   * Creates a new Deduction Policy
   */
  public static create(
    data: Omit<DeductionPolicy, 'id' | 'createdAt' | 'updatedAt'>,
    user: string = 'Super Admin'
  ): DeductionPolicy {
    const newPolicy: DeductionPolicy = {
      ...data,
      id: `ded-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageEngine.insert<DeductionPolicy>(STORAGE_KEYS.DEDUCTION_POLICIES, newPolicy);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'CREATE',
      description: `Created deduction policy "${newPolicy.name}" (${newPolicy.deductionType}, Method: ${newPolicy.calculationMethod})`,
      recordId: newPolicy.id,
    });

    return newPolicy;
  }

  /**
   * Updates an existing Deduction Policy
   */
  public static update(
    id: string,
    updates: Partial<DeductionPolicy>,
    user: string = 'Super Admin'
  ): DeductionPolicy {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Deduction policy with ID "${id}" not found.`);
    }

    const updated: DeductionPolicy = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    StorageEngine.update<DeductionPolicy>(STORAGE_KEYS.DEDUCTION_POLICIES, id, updated);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'UPDATE',
      description: `Updated deduction policy "${updated.name}"`,
      recordId: id,
    });

    return updated;
  }

  /**
   * Deletes a Deduction Policy with dependency protection
   */
  public static delete(
    id: string,
    tenantId?: string,
    user: string = 'Super Admin'
  ): { success: boolean; message: string } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, message: 'Deduction policy not found.' };
    }

    // Check if assigned in any employee record
    const employees = EmployeeService.getAll();
    const isAssigned = employees.some(e => {
      const custom = e.salaryStructure?.customDeductions;
      return custom && custom[id] !== undefined;
    });

    if (isAssigned) {
      return {
        success: false,
        message: `Cannot delete "${existing.name}". It is assigned to one or more employee payroll records.`,
      };
    }

    StorageEngine.remove(STORAGE_KEYS.DEDUCTION_POLICIES, id);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'DELETE',
      description: `Deleted deduction policy "${existing.name}"`,
      recordId: id,
    });

    return { success: true, message: `Deduction policy "${existing.name}" deleted successfully.` };
  }

  /**
   * Calculates deduction amount based on policy rule and salary metrics
   */
  public static calculateDeductionAmount(params: {
    policy: DeductionPolicy;
    basicSalary: number;
    grossSalary: number;
    dailyGrossRate?: number;
    occurrencesOrDays?: number;
    overrideValue?: number;
  }): number {
    const {
      policy,
      basicSalary,
      grossSalary,
      dailyGrossRate = 1000,
      occurrencesOrDays = 1,
      overrideValue,
    } = params;

    const val = overrideValue !== undefined ? overrideValue : (Number(policy.value) || 0);

    switch (policy.calculationMethod) {
      case 'PERCENT_BASIC':
        return Math.round((basicSalary * val) / 100);

      case 'PERCENT_GROSS':
        return Math.round((grossSalary * val) / 100);

      case 'DAYS_LOP':
        return Math.round(dailyGrossRate * val * occurrencesOrDays);

      case 'FIXED':
      default:
        return Math.round(val * occurrencesOrDays);
    }
  }
}
