// Organization Settings & Policy Administration Service
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import {
  Organization,
  Branch,
  Department,
  Designation,
  Role,
  Holiday,
  SystemPolicySettings,
} from '../database/schema';

export class SettingsService {
  public static getOrganization(): Organization {
    const activeTenantId = StorageEngine.getActiveTenantId();
    const stored = StorageEngine.get<Organization>(STORAGE_KEYS.ORGANIZATION, {} as any);
    const tenants = StorageEngine.getList<any>(STORAGE_KEYS.TENANTS);
    const currentTenant = tenants.find(t => t.id === activeTenantId || t.tenantId === activeTenantId);

    if (currentTenant) {
      return {
        id: currentTenant.tenantId,
        name: currentTenant.companyName || stored.name || 'Silaris Information Technologies',
        slug: currentTenant.slug || 'silaris',
        logo: currentTenant.logo || stored.logo || '/logo.png',
        website: stored.website || 'https://www.silaris.in/',
        email: currentTenant.email || stored.email || 'admin@silaris.in',
        phone: currentTenant.phone || stored.phone || '+91 98111 55667',
        address: currentTenant.address || stored.address || 'A-24/5, Mohan Cooperative Industrial Estate, Mathura Road, New Delhi - 110044',
        gstNumber: currentTenant.gstin || stored.gstNumber || '07AAACS5678Q1Z2',
        udyamNumber: stored.udyamNumber || 'UDYAM-DL-06-0034821',
        panNumber: stored.panNumber || 'AAACS5678Q',
        createdAt: currentTenant.createdAt || stored.createdAt || '2024-01-01T00:00:00Z',
      };
    }
    return stored;
  }

  public static updateOrganization(updates: Partial<Organization>): Organization {
    const current = this.getOrganization();
    const updated = { ...current, ...updates };
    StorageEngine.set(STORAGE_KEYS.ORGANIZATION, updated);
    return updated;
  }

  // --- Branches ---
  public static getBranches(): Branch[] {
    return StorageEngine.getList<Branch>(STORAGE_KEYS.BRANCHES);
  }

  public static createBranch(branch: Omit<Branch, 'id'>): Branch {
    const newBranch: Branch = { ...branch, id: `branch-${Date.now()}` };
    return StorageEngine.insert<Branch>(STORAGE_KEYS.BRANCHES, newBranch);
  }

  public static updateBranch(id: string, updates: Partial<Branch>): Branch | undefined {
    return StorageEngine.update<Branch>(STORAGE_KEYS.BRANCHES, id, updates);
  }

  public static deleteBranch(id: string): boolean {
    return StorageEngine.remove<Branch>(STORAGE_KEYS.BRANCHES, id);
  }

  // --- Departments ---
  public static getDepartments(): Department[] {
    return StorageEngine.getList<Department>(STORAGE_KEYS.DEPARTMENTS);
  }

  public static createDepartment(dept: Omit<Department, 'id'>): Department {
    const newDept: Department = { ...dept, id: `dept-${Date.now()}` };
    return StorageEngine.insert<Department>(STORAGE_KEYS.DEPARTMENTS, newDept);
  }

  public static updateDepartment(id: string, updates: Partial<Department>): Department | undefined {
    return StorageEngine.update<Department>(STORAGE_KEYS.DEPARTMENTS, id, updates);
  }

  // --- Designations ---
  public static getDesignations(): Designation[] {
    return StorageEngine.getList<Designation>(STORAGE_KEYS.DESIGNATIONS);
  }

  public static createDesignation(desig: Omit<Designation, 'id'>): Designation {
    const newDesig: Designation = { ...desig, id: `desig-${Date.now()}` };
    return StorageEngine.insert<Designation>(STORAGE_KEYS.DESIGNATIONS, newDesig);
  }

  // --- Roles & Permissions ---
  public static getRoles(): Role[] {
    return StorageEngine.getList<Role>(STORAGE_KEYS.ROLES);
  }

  public static updateRolePermissions(roleId: string, permissions: Role['permissions']): Role | undefined {
    return StorageEngine.update<Role>(STORAGE_KEYS.ROLES, roleId, { permissions });
  }

  // --- Holidays ---
  public static getHolidays(): Holiday[] {
    return StorageEngine.getList<Holiday>(STORAGE_KEYS.HOLIDAYS);
  }

  public static createHoliday(holiday: Omit<Holiday, 'id'>): Holiday {
    const newHol: Holiday = { ...holiday, id: `hol-${Date.now()}` };
    return StorageEngine.insert<Holiday>(STORAGE_KEYS.HOLIDAYS, newHol);
  }

  public static deleteHoliday(id: string): boolean {
    return StorageEngine.remove<Holiday>(STORAGE_KEYS.HOLIDAYS, id);
  }

  // --- System Policies ---
  public static getSystemPolicies(): SystemPolicySettings {
    return StorageEngine.get<SystemPolicySettings>(STORAGE_KEYS.SYSTEM_SETTINGS, {} as any);
  }

  public static updateSystemPolicies(policies: Partial<SystemPolicySettings>): SystemPolicySettings {
    const current = this.getSystemPolicies();
    const updated = { ...current, ...policies };
    StorageEngine.set(STORAGE_KEYS.SYSTEM_SETTINGS, updated);
    return updated;
  }
}
