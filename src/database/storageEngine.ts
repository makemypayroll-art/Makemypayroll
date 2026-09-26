// NovaPulse HRMS — Storage Engine (Persistent Local / IndexedDB Bridge)
import {
  INITIAL_ORGANIZATION,
  INITIAL_BRANCHES,
  INITIAL_DEPARTMENTS,
  INITIAL_DESIGNATIONS,
  INITIAL_ROLES,
  INITIAL_EMPLOYEES,
  INITIAL_USERS,
  INITIAL_SHIFTS,
  INITIAL_LEAVE_TYPES,
  INITIAL_LEAVE_BALANCES,
  INITIAL_LEAVE_APPLICATIONS,
  INITIAL_SHIFT_SWAPS,
  INITIAL_TICKETS,
  INITIAL_ONBOARDING_INVITES,
  INITIAL_ASSETS,
  INITIAL_GEO_LOCATIONS,
  INITIAL_HOLIDAYS,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_TENANTS,
  INITIAL_TENANT_SUBSCRIPTIONS,
  INITIAL_TENANT_LICENSE_CHANGES,
  INITIAL_TENANT_PAYMENTS,
  generateSeedAttendance,
} from './seedData';
import { Tenant, TenantSubscription, TenantLicenseChange, TenantPayment, AdminImpersonationSession } from './schema';

const STORAGE_PREFIX = 'novapulse_hrms_v1_';

export const STORAGE_KEYS = {
  TENANTS: `${STORAGE_PREFIX}tenants`,
  SUBSCRIPTIONS: `${STORAGE_PREFIX}subscriptions`,
  LICENSE_CHANGES: `${STORAGE_PREFIX}license_changes`,
  PAYMENTS: `${STORAGE_PREFIX}payments`,
  ACTIVE_TENANT_ID: `${STORAGE_PREFIX}active_tenant_id`,
  APP_ENVIRONMENT: `${STORAGE_PREFIX}app_environment`, // 'super_admin' | 'client'
  IMPERSONATION_SESSION: `${STORAGE_PREFIX}impersonation_session`,
  ORGANIZATION: `${STORAGE_PREFIX}organization`,
  BRANCHES: `${STORAGE_PREFIX}branches`,
  DEPARTMENTS: `${STORAGE_PREFIX}departments`,
  DESIGNATIONS: `${STORAGE_PREFIX}designations`,
  ROLES: `${STORAGE_PREFIX}roles`,
  EMPLOYEES: `${STORAGE_PREFIX}employees`,
  USERS: `${STORAGE_PREFIX}users`,
  SHIFTS: `${STORAGE_PREFIX}shifts`,
  SHIFT_ROSTERS: `${STORAGE_PREFIX}shift_rosters`,
  SHIFT_SWAPS: `${STORAGE_PREFIX}shift_swaps`,
  ATTENDANCE: `${STORAGE_PREFIX}attendance`,
  REGULARIZATIONS: `${STORAGE_PREFIX}regularizations`,
  LEAVE_TYPES: `${STORAGE_PREFIX}leave_types`,
  LEAVE_BALANCES: `${STORAGE_PREFIX}leave_balances`,
  LEAVE_APPLICATIONS: `${STORAGE_PREFIX}leave_applications`,
  TICKETS: `${STORAGE_PREFIX}tickets`,
  ONBOARDING_INVITES: `${STORAGE_PREFIX}onboarding_invites`,
  ASSETS: `${STORAGE_PREFIX}assets`,
  ASSET_HISTORY: `${STORAGE_PREFIX}asset_history`,
  GEO_LOCATIONS: `${STORAGE_PREFIX}geo_locations`,
  PAYROLL_PERIODS: `${STORAGE_PREFIX}payroll_periods`,
  PAYSLIPS: `${STORAGE_PREFIX}payslips`,
  PAYROLL_STATUTORY_CONFIG: `${STORAGE_PREFIX}payroll_statutory_config`,
  EMPLOYEE_TAX_PROFILES: `${STORAGE_PREFIX}employee_tax_profiles`,
  EMPLOYEE_PF_PROFILES: `${STORAGE_PREFIX}employee_pf_profiles`,
  EMPLOYEE_ESI_PROFILES: `${STORAGE_PREFIX}employee_esi_profiles`,
  EMPLOYEE_LOANS: `${STORAGE_PREFIX}employee_loans`,
  EMPLOYEE_ADVANCES: `${STORAGE_PREFIX}employee_advances`,
  EMPLOYEE_REIMBURSEMENTS: `${STORAGE_PREFIX}employee_reimbursements`,
  LEAVE_ENCASHMENTS: `${STORAGE_PREFIX}leave_encashments`,
  EMPLOYEE_OVERTIME: `${STORAGE_PREFIX}employee_overtime`,
  MMP_DATASETS: `${STORAGE_PREFIX}mmp_datasets`,
  MMP_DATASET_ROWS: `${STORAGE_PREFIX}mmp_dataset_rows`,
  MMP_SAVED_INSIGHTS: `${STORAGE_PREFIX}mmp_saved_insights`,
  MMP_AI_USAGE: `${STORAGE_PREFIX}mmp_ai_usage`,
  MMP_AI_SETTINGS: `${STORAGE_PREFIX}mmp_ai_settings`,
  HOLIDAYS: `${STORAGE_PREFIX}holidays`,
  SYSTEM_SETTINGS: `${STORAGE_PREFIX}system_settings`,
  NOTIFICATIONS: `${STORAGE_PREFIX}notifications`,
  AUDIT_LOGS: `${STORAGE_PREFIX}audit_logs`,
  CURRENT_USER_ID: `${STORAGE_PREFIX}current_user_id`,
  ACTIVE_BRANCH_ID: `${STORAGE_PREFIX}active_branch_id`,
  IS_AUTHENTICATED: `${STORAGE_PREFIX}is_authenticated`,
};

const inMemoryStorage: Record<string, string> = {};

const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return inMemoryStorage[key] || null;
      }
    }
    return inMemoryStorage[key] || null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        inMemoryStorage[key] = value;
      }
    } else {
      inMemoryStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        delete inMemoryStorage[key];
      }
    } else {
      delete inMemoryStorage[key];
    }
  }
};

export class StorageEngine {
  private static initialized = false;

  public static init() {
    if (this.initialized) return;

    if (!safeStorage.getItem(STORAGE_KEYS.ORGANIZATION)) {
      this.resetToDefaults();
    }
    this.initialized = true;
  }

  public static resetToDefaults() {
    safeStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(INITIAL_TENANTS));
    safeStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(INITIAL_TENANT_SUBSCRIPTIONS));
    safeStorage.setItem(STORAGE_KEYS.LICENSE_CHANGES, JSON.stringify(INITIAL_TENANT_LICENSE_CHANGES));
    safeStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(INITIAL_TENANT_PAYMENTS));
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT_ID, JSON.stringify('NP-000001'));
    safeStorage.setItem(STORAGE_KEYS.APP_ENVIRONMENT, JSON.stringify('super_admin'));
    safeStorage.removeItem(STORAGE_KEYS.IMPERSONATION_SESSION);

    safeStorage.setItem(STORAGE_KEYS.ORGANIZATION, JSON.stringify(INITIAL_ORGANIZATION));
    safeStorage.setItem(STORAGE_KEYS.BRANCHES, JSON.stringify(INITIAL_BRANCHES));
    safeStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(INITIAL_DEPARTMENTS));
    safeStorage.setItem(STORAGE_KEYS.DESIGNATIONS, JSON.stringify(INITIAL_DESIGNATIONS));
    safeStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(INITIAL_ROLES));
    safeStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
    safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    safeStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(INITIAL_SHIFTS));
    safeStorage.setItem(STORAGE_KEYS.SHIFT_ROSTERS, JSON.stringify([]));
    safeStorage.setItem(STORAGE_KEYS.SHIFT_SWAPS, JSON.stringify(INITIAL_SHIFT_SWAPS));
    safeStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(generateSeedAttendance()));
    safeStorage.setItem(STORAGE_KEYS.REGULARIZATIONS, JSON.stringify([]));
    safeStorage.setItem(STORAGE_KEYS.LEAVE_TYPES, JSON.stringify(INITIAL_LEAVE_TYPES));
    safeStorage.setItem(STORAGE_KEYS.LEAVE_BALANCES, JSON.stringify(INITIAL_LEAVE_BALANCES));
    safeStorage.setItem(STORAGE_KEYS.LEAVE_APPLICATIONS, JSON.stringify(INITIAL_LEAVE_APPLICATIONS));
    safeStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(INITIAL_TICKETS));
    safeStorage.setItem(STORAGE_KEYS.ONBOARDING_INVITES, JSON.stringify(INITIAL_ONBOARDING_INVITES));
    safeStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(INITIAL_ASSETS));
    safeStorage.setItem(STORAGE_KEYS.ASSET_HISTORY, JSON.stringify([]));
    safeStorage.setItem(STORAGE_KEYS.GEO_LOCATIONS, JSON.stringify(INITIAL_GEO_LOCATIONS));
    safeStorage.setItem(STORAGE_KEYS.PAYROLL_PERIODS, JSON.stringify([]));
    safeStorage.setItem(STORAGE_KEYS.PAYSLIPS, JSON.stringify([]));
    safeStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(INITIAL_HOLIDAYS));
    safeStorage.setItem(STORAGE_KEYS.SYSTEM_SETTINGS, JSON.stringify(INITIAL_SYSTEM_SETTINGS));
    safeStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
    safeStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
    safeStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, JSON.stringify('user-001')); // Default Super Admin
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH_ID, JSON.stringify('all'));

    this.notifySubscribers('DATABASE_RESET');
  }

  public static getActiveTenantId(): string {
    return this.get<string>(STORAGE_KEYS.ACTIVE_TENANT_ID, 'NP-000001');
  }

  public static setActiveTenantId(tenantId: string): void {
    this.set(STORAGE_KEYS.ACTIVE_TENANT_ID, tenantId);
  }

  public static getAppEnvironment(): 'super_admin' | 'client' {
    return this.get<'super_admin' | 'client'>(STORAGE_KEYS.APP_ENVIRONMENT, 'super_admin');
  }

  public static setAppEnvironment(env: 'super_admin' | 'client'): void {
    this.set(STORAGE_KEYS.APP_ENVIRONMENT, env);
  }

  public static getImpersonationSession(): AdminImpersonationSession | null {
    return this.get<AdminImpersonationSession | null>(STORAGE_KEYS.IMPERSONATION_SESSION, null);
  }

  public static setImpersonationSession(session: AdminImpersonationSession | null): void {
    if (session) {
      this.set(STORAGE_KEYS.IMPERSONATION_SESSION, session);
    } else {
      safeStorage.removeItem(STORAGE_KEYS.IMPERSONATION_SESSION);
      this.notifySubscribers(STORAGE_KEYS.IMPERSONATION_SESSION);
    }
  }

  public static isAuthenticated(): boolean {
    return this.get<boolean>(STORAGE_KEYS.IS_AUTHENTICATED, true);
  }

  public static setAuthenticated(authenticated: boolean): void {
    this.set(STORAGE_KEYS.IS_AUTHENTICATED, authenticated);
  }

  public static get<T>(key: string, defaultValue: T): T {
    try {
      const item = safeStorage.getItem(key);
      if (item === null || item === undefined) return defaultValue;
      try {
        return JSON.parse(item);
      } catch {
        return item as unknown as T;
      }
    } catch (e) {
      return defaultValue;
    }
  }

  public static set<T>(key: string, value: T): void {
    try {
      safeStorage.setItem(key, JSON.stringify(value));
      this.notifySubscribers(key);
    } catch (e) {
      console.error(`Error writing ${key} to storage:`, e);
    }
  }

  public static getList<T extends { id: string }>(key: string): T[] {
    return this.get<T[]>(key, []);
  }

  public static setList<T extends { id: string }>(key: string, items: T[]): void {
    this.set(key, items);
  }

  public static insert<T extends { id: string }>(key: string, item: T): T {
    const list = this.getList<T>(key);
    const existingIndex = list.findIndex(x => x.id === item.id);
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.unshift(item);
    }
    this.setList(key, list);
    return item;
  }

  public static upsert<T extends { id: string }>(key: string, item: T): T {
    return this.insert<T>(key, item);
  }

  public static update<T extends { id: string }>(key: string, id: string, updates: Partial<T>): T | undefined {
    const list = this.getList<T>(key);
    const index = list.findIndex(x => x.id === id);
    if (index === -1) return undefined;
    const updated = { ...list[index], ...updates };
    list[index] = updated;
    this.setList(key, list);
    return updated;
  }

  public static remove<T extends { id: string }>(key: string, id: string): boolean {
    const list = this.getList<T>(key);
    const filtered = list.filter(x => x.id !== id);
    if (filtered.length === list.length) return false;
    this.setList(key, filtered);
    return true;
  }

  // Event dispatcher for reactive updates
  private static subscribers: Array<(event: string) => void> = [];

  public static subscribe(callback: (event: string) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private static notifySubscribers(event: string) {
    this.subscribers.forEach(cb => {
      try {
        cb(event);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    });
  }
}

// Auto-initialize on module load
StorageEngine.init();
