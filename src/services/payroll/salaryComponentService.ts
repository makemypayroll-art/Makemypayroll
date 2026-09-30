// ====================================================================
// Salary Components Master & Calculation Service
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { SalaryComponent } from '../../database/schema';
import { AuditService } from '../auditService';
import { EmployeeService } from '../employeeService';

export class SalaryComponentService {
  /**
   * Retrieves all salary components for a tenant
   */
  public static getAll(tenantId?: string): SalaryComponent[] {
    const targetTenant = tenantId || StorageEngine.getActiveTenantId();
    const list = StorageEngine.getList<SalaryComponent>(STORAGE_KEYS.SALARY_COMPONENTS);
    const tenantComponents = list.filter(
      c => !c.organizationId || c.organizationId === targetTenant || c.organizationId === 'NP-000001'
    );
    return tenantComponents.length > 0 ? tenantComponents : list;
  }

  /**
   * Retrieves a single salary component by ID
   */
  public static getById(id: string): SalaryComponent | undefined {
    const list = StorageEngine.getList<SalaryComponent>(STORAGE_KEYS.SALARY_COMPONENTS);
    return list.find(c => c.id === id);
  }

  /**
   * Creates a new Salary Component
   */
  public static create(
    data: Omit<SalaryComponent, 'id' | 'createdAt' | 'updatedAt'>,
    user: string = 'Super Admin'
  ): SalaryComponent {
    const newComponent: SalaryComponent = {
      ...data,
      id: `comp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageEngine.insert<SalaryComponent>(STORAGE_KEYS.SALARY_COMPONENTS, newComponent);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'CREATE',
      description: `Created salary component "${newComponent.name}" (${newComponent.componentType}, Method: ${newComponent.calculationMethod})`,
      recordId: newComponent.id,
    });

    return newComponent;
  }

  /**
   * Updates an existing Salary Component
   */
  public static update(
    id: string,
    updates: Partial<SalaryComponent>,
    user: string = 'Super Admin'
  ): SalaryComponent {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Salary component with ID "${id}" not found.`);
    }

    const updated: SalaryComponent = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    StorageEngine.update<SalaryComponent>(STORAGE_KEYS.SALARY_COMPONENTS, id, updated);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'UPDATE',
      description: `Updated salary component "${updated.name}"`,
      recordId: id,
    });

    return updated;
  }

  /**
   * Deletes a Salary Component with dependency protection
   */
  public static delete(
    id: string,
    tenantId?: string,
    user: string = 'Super Admin'
  ): { success: boolean; message: string } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, message: 'Salary component not found.' };
    }

    // Check if assigned in any employee salary structure
    const employees = EmployeeService.getAll();
    const isAssigned = employees.some(e => {
      const custom = e.salaryStructure?.customComponents;
      return custom && custom[id] !== undefined;
    });

    if (isAssigned) {
      return {
        success: false,
        message: `Cannot delete "${existing.name}". It is assigned to one or more employee salary structures.`,
      };
    }

    StorageEngine.remove(STORAGE_KEYS.SALARY_COMPONENTS, id);

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'DELETE',
      description: `Deleted salary component "${existing.name}"`,
      recordId: id,
    });

    return { success: true, message: `Salary component "${existing.name}" deleted successfully.` };
  }

  /**
   * Calculates calculated rupee amount for a component given employee's basic & gross
   */
  public static calculateComponentAmount(
    component: SalaryComponent,
    basicSalary: number,
    grossSalary: number,
    overrideValue?: number
  ): number {
    const val = overrideValue !== undefined ? overrideValue : (Number(component.value) || 0);

    switch (component.calculationMethod) {
      case 'PERCENT_BASIC':
        return Math.round((basicSalary * val) / 100);
      case 'PERCENT_GROSS':
        return Math.round((grossSalary * val) / 100);
      case 'FIXED':
      default:
        return Math.round(val);
    }
  }
}
