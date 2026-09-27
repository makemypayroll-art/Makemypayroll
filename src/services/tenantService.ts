// Multi-Tenant SaaS Master Management Service
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import {
  Tenant,
  TenantStatus,
  TenantSubscription,
  TenantLicenseChange,
  TenantPayment,
  SubscriptionPlan,
  PaymentStatus,
  User,
  AuditLog
} from '../database/schema';
import { EmployeeService } from './employeeService';
import { AuditService } from './auditService';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getTenantLoginUrl, getTenantSubdomainUrl } from '../config/appConfig';
import { normalizeSlug, isValidSlugFormat, isReservedSlug } from './tenantResolver';

export class TenantService {
  public static getAll(includeDeleted: boolean = false): Tenant[] {
    const list = StorageEngine.getList<Tenant>(STORAGE_KEYS.TENANTS);
    if (includeDeleted) return list;
    return list.filter(t => !t.isDeleted);
  }

  public static getById(idOrTenantId: string): Tenant | undefined {
    if (!idOrTenantId) return undefined;
    const list = this.getAll(true);
    const clean = idOrTenantId.toLowerCase().trim();
    return list.find(
      t =>
        (t.id && t.id.toLowerCase() === clean) ||
        (t.tenantId && t.tenantId.toLowerCase() === clean) ||
        (t.slug && t.slug.toLowerCase() === clean) ||
        (t.subdomain && t.subdomain.toLowerCase() === clean)
    );
  }

  public static getBySlug(slug: string): Tenant | undefined {
    if (!slug) return undefined;
    const list = this.getAll(true);
    const cleanSlug = slug.toLowerCase().trim();
    return list.find(
      t =>
        (t.slug && t.slug.toLowerCase() === cleanSlug) ||
        (t.subdomain && t.subdomain.toLowerCase() === cleanSlug) ||
        (t.tenantId && t.tenantId.toLowerCase() === cleanSlug) ||
        (t.id && t.id.toLowerCase() === cleanSlug) ||
        (t.clientCode && t.clientCode.toLowerCase() === cleanSlug)
    );
  }

  public static getBySubdomain(subdomain: string): Tenant | undefined {
    return this.getBySlug(subdomain);
  }

  public static getByCode(code: string): Tenant | undefined {
    if (!code) return undefined;
    const list = this.getAll(true);
    const cleanCode = code.toLowerCase().trim();
    return list.find(
      t =>
        (t.clientCode && t.clientCode.toLowerCase() === cleanCode) ||
        (t.tenantId && t.tenantId.toLowerCase() === cleanCode) ||
        (t.slug && t.slug.toLowerCase() === cleanCode)
    );
  }

  /**
   * Asynchronously fetch tenant from Supabase database by slug, subdomain, or tenant ID
   * and cache into StorageEngine for fast subsequent synchronous access
   */
  public static async fetchTenantBySlugFromSupabase(slugOrSubdomain: string): Promise<Tenant | null> {
    if (!slugOrSubdomain) return null;
    const clean = slugOrSubdomain.toLowerCase().trim();

    // First check local cache
    const cached = this.getBySlug(clean);
    if (cached) return cached;

    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      // 1. Query tenants table directly with canonical slug / identifier filter
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .or(`slug.ilike.${clean},login_slug.ilike.%${clean}%,tenant_id.ilike.${clean},client_code.ilike.${clean}`)
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        const mappedTenant: Tenant = {
          id: data.tenant_id || data.id,
          tenantId: data.tenant_id,
          companyName: data.company_name,
          legalName: data.legal_name || data.company_name,
          email: data.email,
          phone: data.phone,
          address: data.address || '',
          city: data.city || 'Noida',
          state: data.state || 'Uttar Pradesh',
          country: data.country || 'India',
          gstin: data.gstin,
          industry: data.industry || 'Information Technology',
          logo: data.logo_url || '/logo.png',
          clientCode: data.client_code || data.tenant_id,
          slug: data.slug || clean,
          subdomain: data.slug || clean,
          loginSlug: data.login_slug || getTenantSubdomainUrl(data.slug || clean),
          status: data.status || 'ACTIVE',
          licensedEmployees: data.licensed_employees || 20,
          subscriptionPlan: data.subscription_plan || 'Monthly',
          subscriptionStartDate: data.subscription_start_date || new Date().toISOString().split('T')[0],
          subscriptionEndDate: data.subscription_end_date || new Date().toISOString().split('T')[0],
          paymentStatus: data.payment_status || 'PAID',
          enabledModules: [
            'dashboard',
            'shifts',
            'attendance',
            'leaves',
            'employees',
            'tickets',
            'onboarding',
            'inventory',
            'geolocation',
            'payroll',
            'settings',
          ],
          primaryAdmin: {
            name: 'Administrator',
            email: data.email,
            phone: data.phone,
          },
          setupCompleted: true,
          setupStep: 10,
          createdAt: data.created_at || new Date().toISOString(),
          updatedAt: data.updated_at || new Date().toISOString(),
        };

        StorageEngine.upsert<Tenant>(STORAGE_KEYS.TENANTS, mappedTenant);
        return mappedTenant;
      }
    } catch (err) {
      console.warn('Supabase tenant resolution error:', err);
    }

    return null;
  }

  public static slugExists(slug: string, excludeTenantId?: string): boolean {
    if (!slug) return false;
    const list = this.getAll(true);
    const cleanSlug = slug.toLowerCase().trim();
    return list.some(
      t =>
        t.id !== excludeTenantId &&
        t.tenantId !== excludeTenantId &&
        ((t.slug && t.slug.toLowerCase() === cleanSlug) || (t.subdomain && t.subdomain.toLowerCase() === cleanSlug) || t.tenantId.toLowerCase() === cleanSlug)
    );
  }

  public static subdomainExists(subdomain: string, excludeTenantId?: string): boolean {
    return this.slugExists(subdomain, excludeTenantId);
  }

  public static generateSlug(companyName: string): string {
    const stripped = companyName
      .replace(/\b(pvt|ltd|limited|private|llp|inc|solutions|technologies|services|infotech|group|corp|corporation)\b/gi, '')
      .trim();
    const base = normalizeSlug(stripped) || normalizeSlug(companyName) || 'client';

    let candidate = base;
    let counter = 1;
    while (this.slugExists(candidate) || isReservedSlug(candidate)) {
      counter++;
      candidate = `${base}-${counter}`;
    }
    return candidate;
  }

  public static generateSubdomain(companyName: string): string {
    return this.generateSlug(companyName);
  }

  public static validateSlug(slug: string, excludeTenantId?: string): { valid: boolean; error?: string } {
    if (!slug || typeof slug !== 'string') {
      return { valid: false, error: 'Subdomain / slug is required.' };
    }
    const clean = slug.toLowerCase().trim();
    if (clean.length < 2) {
      return { valid: false, error: 'Subdomain must be at least 2 characters long.' };
    }
    if (clean.length > 63) {
      return { valid: false, error: 'Subdomain cannot exceed 63 characters.' };
    }
    if (!isValidSlugFormat(clean)) {
      return { valid: false, error: 'Subdomain must contain only lowercase letters, numbers, and single hyphens.' };
    }
    if (isReservedSlug(clean)) {
      return { valid: false, error: `"${clean}" is a reserved system subdomain and cannot be used.` };
    }
    if (this.slugExists(clean, excludeTenantId)) {
      return { valid: false, error: 'Subdomain already exists. Please choose another.' };
    }
    return { valid: true };
  }

  public static validateSubdomain(subdomain: string, excludeTenantId?: string): { valid: boolean; error?: string } {
    return this.validateSlug(subdomain, excludeTenantId);
  }

  public static generateNextTenantId(): string {
    const tenants = this.getAll(true);
    let maxNum = 0;
    tenants.forEach(t => {
      const match = t.tenantId.match(/^NP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return `NP-${String(nextNum).padStart(6, '0')}`;
  }

  public static generateClientCode(companyName: string): string {
    const words = companyName.trim().split(/\s+/);
    let initials = '';
    if (words.length >= 2) {
      initials = (words[0].slice(0, 2) + words[1].slice(0, 1)).toUpperCase();
    } else {
      initials = companyName.slice(0, 3).toUpperCase();
    }
    const count = this.getAll(true).length + 1;
    return `CLI-${initials}-${String(count).padStart(2, '0')}`;
  }

  public static create(data: {
    companyName: string;
    legalName: string;
    slug?: string;
    subdomain?: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    country: string;
    gstin?: string;
    industry: string;
    logo?: string;
    licensedEmployees: number;
    subscriptionPlan: SubscriptionPlan;
    subscriptionStartDate: string;
    subscriptionEndDate: string;
    trialEndDate?: string;
    paymentStatus?: PaymentStatus;
    enabledModules?: string[];
    primaryAdmin: {
      name: string;
      email: string;
      phone: string;
    };
  }): { tenant: Tenant; adminUser: User } {
    const tenantId = this.generateNextTenantId();
    const clientCode = this.generateClientCode(data.companyName);
    
    // Resolve slug / subdomain
    const rawSubdomain = data.subdomain || data.slug;
    let slug = rawSubdomain ? normalizeSlug(rawSubdomain) : this.generateSlug(data.companyName);
    const slugValidation = this.validateSlug(slug);
    if (!slugValidation.valid) {
      if (rawSubdomain) {
        throw new Error(slugValidation.error || 'Invalid subdomain');
      }
      slug = this.generateSlug(data.companyName);
    }

    const loginSlug = getTenantSubdomainUrl(slug);
    const now = new Date().toISOString();

    const defaultModules = [
      'dashboard',
      'shifts',
      'attendance',
      'leaves',
      'employees',
      'tickets',
      'onboarding',
      'inventory',
      'geolocation',
      'payroll',
      'settings'
    ];

    const newTenant: Tenant = {
      id: tenantId,
      tenantId: tenantId,
      companyName: data.companyName,
      legalName: data.legalName || data.companyName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country || 'India',
      gstin: data.gstin,
      industry: data.industry || 'Information Technology',
      logo: data.logo || '/logo.png',
      clientCode: clientCode,
      slug: slug,
      subdomain: slug,
      loginSlug: loginSlug,
      status: data.subscriptionPlan === 'Trial' ? 'TRIAL' : 'ACTIVE',
      licensedEmployees: Number(data.licensedEmployees) || 20,
      subscriptionPlan: data.subscriptionPlan,
      subscriptionStartDate: data.subscriptionStartDate || now.split('T')[0],
      subscriptionEndDate: data.subscriptionEndDate || now.split('T')[0],
      trialEndDate: data.trialEndDate,
      paymentStatus: data.paymentStatus || (data.subscriptionPlan === 'Trial' ? 'PENDING' : 'PAID'),
      enabledModules: data.enabledModules && data.enabledModules.length > 0 ? data.enabledModules : undefined,
      primaryAdmin: {
        name: data.primaryAdmin.name,
        email: data.primaryAdmin.email,
        phone: data.primaryAdmin.phone,
        userId: `user-admin-${tenantId.toLowerCase()}`
      },
      setupCompleted: false,
      setupStep: 1,
      createdAt: now,
      updatedAt: now
    };

    StorageEngine.insert<Tenant>(STORAGE_KEYS.TENANTS, newTenant);

    // Create Tenant Primary Admin User
    const adminUser: User = {
      id: newTenant.primaryAdmin.userId || `user-${Date.now()}`,
      organizationId: tenantId,
      employeeId: `emp-adm-${tenantId.toLowerCase()}`,
      email: data.primaryAdmin.email,
      fullName: data.primaryAdmin.name,
      roleId: 'role-hr-admin',
      roleName: 'HR Admin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      status: 'active'
    };
    StorageEngine.insert<User>(STORAGE_KEYS.USERS, adminUser);

    // Create Initial Subscription Record
    const newSub: TenantSubscription = {
      id: `sub-${Date.now()}`,
      tenantId: tenantId,
      companyName: data.companyName,
      planName: data.subscriptionPlan,
      billingCycle: data.subscriptionPlan === 'Annual' ? 'Annual' : data.subscriptionPlan === 'Quarterly' ? 'Quarterly' : 'Monthly',
      startDate: newTenant.subscriptionStartDate,
      endDate: newTenant.subscriptionEndDate,
      licensedEmployees: newTenant.licensedEmployees,
      amount: data.subscriptionPlan === 'Trial' ? 0 : newTenant.licensedEmployees * 120 * (data.subscriptionPlan === 'Annual' ? 12 : 1),
      currency: 'INR',
      paymentStatus: newTenant.paymentStatus,
      renewalDate: newTenant.subscriptionEndDate,
      notes: 'Initial account provisioning',
      createdAt: now
    };
    StorageEngine.insert<TenantSubscription>(STORAGE_KEYS.SUBSCRIPTIONS, newSub);

    // Create License Change Record
    const newLicChange: TenantLicenseChange = {
      id: `lic-${Date.now()}`,
      tenantId: tenantId,
      companyName: data.companyName,
      previousLimit: 0,
      newLimit: newTenant.licensedEmployees,
      changedBy: 'Super Admin',
      reason: 'Initial Account Provisioning',
      timestamp: now
    };
    StorageEngine.insert<TenantLicenseChange>(STORAGE_KEYS.LICENSE_CHANGES, newLicChange);

    // Log Global SaaS Audit
    AuditService.log({
      userId: 'user-001',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      module: 'Client Provisioning',
      action: 'CREATE',
      description: `Created new customer tenant ${newTenant.companyName} (${tenantId}) with ${newTenant.licensedEmployees} licences [${newTenant.subscriptionPlan} Plan]`,
      recordId: tenantId
    });

    // Sync to Supabase PostgreSQL database if configured
    if (isSupabaseConfigured()) {
      supabase.from('tenants').insert({
        tenant_id: tenantId,
        company_name: newTenant.companyName,
        legal_name: newTenant.legalName,
        email: newTenant.email,
        phone: newTenant.phone,
        address: newTenant.address,
        city: newTenant.city,
        state: newTenant.state,
        country: newTenant.country,
        gstin: newTenant.gstin,
        industry: newTenant.industry,
        licensed_employees: newTenant.licensedEmployees,
        subscription_plan: newTenant.subscriptionPlan,
        subscription_start_date: newTenant.subscriptionStartDate,
        subscription_end_date: newTenant.subscriptionEndDate,
        payment_status: newTenant.paymentStatus,
        status: newTenant.status,
        login_slug: newTenant.loginSlug,
        slug: newTenant.slug,
        client_code: newTenant.clientCode,
      }).then(({ error }) => {
        if (error) console.error('Supabase tenant insert error:', error);
      });

      supabase.from('subscriptions').insert({
        tenant_id: tenantId,
        plan_name: newSub.planName,
        billing_cycle: newSub.billingCycle,
        start_date: newSub.startDate,
        end_date: newSub.endDate,
        licensed_employees: newSub.licensedEmployees,
        amount: newSub.amount,
        currency: newSub.currency,
        payment_status: newSub.paymentStatus,
        renewal_date: newSub.renewalDate,
        notes: newSub.notes,
      }).then(({ error }) => {
        if (error) console.error('Supabase subscription insert error:', error);
      });

      supabase.from('tenant_licenses').insert({
        tenant_id: tenantId,
        previous_limit: newLicChange.previousLimit,
        new_limit: newLicChange.newLimit,
        changed_by: newLicChange.changedBy,
        reason: newLicChange.reason,
      }).then(({ error }) => {
        if (error) console.error('Supabase license insert error:', error);
      });
    }

    return { tenant: newTenant, adminUser };
  }

  public static update(id: string, updates: Partial<Tenant>): Tenant | undefined {
    const updated = StorageEngine.update<Tenant>(STORAGE_KEYS.TENANTS, id, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    return updated;
  }

  public static updateLicence(
    tenantId: string,
    newLimit: number,
    changedBy: string,
    reason: string
  ): { success: boolean; message: string; tenant?: Tenant } {
    const tenant = this.getById(tenantId);
    if (!tenant) return { success: false, message: 'Tenant not found.' };

    const activeEmployees = EmployeeService.getAll().filter(
      e => (e.organizationId === tenantId || (e as any).tenantId === tenantId) && e.employmentStatus === 'Active'
    );

    if (newLimit < activeEmployees.length) {
      return {
        success: false,
        message: `Cannot reduce licence to ${newLimit}. Client currently has ${activeEmployees.length} active employees.`
      };
    }

    const prev = tenant.licensedEmployees;
    const updated = this.update(tenant.id, { licensedEmployees: newLimit });

    // Record change log
    const changeLog: TenantLicenseChange = {
      id: `lic-${Date.now()}`,
      tenantId: tenant.tenantId,
      companyName: tenant.companyName,
      previousLimit: prev,
      newLimit: newLimit,
      changedBy: changedBy || 'Super Admin',
      reason: reason || 'Licence quota update',
      timestamp: new Date().toISOString()
    };
    StorageEngine.insert<TenantLicenseChange>(STORAGE_KEYS.LICENSE_CHANGES, changeLog);

    AuditService.log({
      userId: 'user-001',
      userName: changedBy || 'Super Admin',
      userRole: 'Super Admin',
      module: 'Licence Management',
      action: 'UPDATE',
      description: `Updated licence limit for ${tenant.companyName} (${tenant.tenantId}) from ${prev} to ${newLimit}. Reason: ${reason}`,
      recordId: tenantId,
      previousValue: `${prev}`,
      newValue: `${newLimit}`
    });

    return { success: true, message: `Successfully updated licence limit to ${newLimit}`, tenant: updated };
  }

  public static putOnHold(tenantId: string, reason: string, adminName: string = 'Super Admin'): Tenant | undefined {
    const tenant = this.getById(tenantId);
    if (!tenant) return undefined;

    const now = new Date().toISOString();
    const updated = this.update(tenant.id, {
      status: 'ON_HOLD',
      holdDetails: {
        heldAt: now,
        heldBy: adminName,
        reason: reason || 'Account put on hold by administrator'
      }
    });

    AuditService.log({
      userId: 'user-001',
      userName: adminName,
      userRole: 'Super Admin',
      module: 'Account Lifecycle',
      action: 'UPDATE',
      description: `Account placed ON HOLD for ${tenant.companyName} (${tenantId}). Reason: ${reason}`,
      recordId: tenantId,
      previousValue: tenant.status,
      newValue: 'ON_HOLD'
    });

    return updated;
  }

  public static updateStatus(
    tenantId: string,
    status: TenantStatus,
    reason?: string,
    adminName: string = 'Super Admin'
  ): Tenant | undefined {
    const tenant = this.getById(tenantId);
    if (!tenant) return undefined;

    const prev = tenant.status;
    const now = new Date().toISOString();
    const updated = this.update(tenant.id, {
      status,
      holdDetails: (status === 'ON_HOLD' || status === 'SUSPENDED') ? {
        heldAt: now,
        heldBy: adminName,
        reason: reason || `Status updated to ${status}`
      } : undefined
    });

    AuditService.log({
      userId: 'user-001',
      userName: adminName,
      userRole: 'Super Admin',
      module: 'Account Lifecycle',
      action: 'UPDATE',
      description: `Tenant status updated for ${tenant.companyName} (${tenantId}) from ${prev} to ${status}${reason ? `. Reason: ${reason}` : ''}`,
      recordId: tenantId,
      previousValue: prev,
      newValue: status
    });

    return updated;
  }

  public static reactivate(tenantId: string, adminName: string = 'Super Admin'): Tenant | undefined {
    const tenant = this.getById(tenantId);
    if (!tenant) return undefined;

    const updated = this.update(tenant.id, {
      status: 'ACTIVE',
      holdDetails: undefined
    });

    AuditService.log({
      userId: 'user-001',
      userName: adminName,
      userRole: 'Super Admin',
      module: 'Account Lifecycle',
      action: 'UPDATE',
      description: `Account REACTIVATED for ${tenant.companyName} (${tenantId})`,
      recordId: tenantId,
      previousValue: tenant.status,
      newValue: 'ACTIVE'
    });

    return updated;
  }

  public static suspend(tenantId: string, reason: string, adminName: string = 'Super Admin'): Tenant | undefined {
    const tenant = this.getById(tenantId);
    if (!tenant) return undefined;

    const now = new Date().toISOString();
    const updated = this.update(tenant.id, {
      status: 'SUSPENDED',
      holdDetails: {
        heldAt: now,
        heldBy: adminName,
        reason: reason || 'Suspended by administrator'
      }
    });

    AuditService.log({
      userId: 'user-001',
      userName: adminName,
      userRole: 'Super Admin',
      module: 'Account Lifecycle',
      action: 'UPDATE',
      description: `Account SUSPENDED for ${tenant.companyName} (${tenantId}). Reason: ${reason}`,
      recordId: tenantId,
      previousValue: tenant.status,
      newValue: 'SUSPENDED'
    });

    return updated;
  }

  public static archive(tenantId: string, adminName: string = 'Super Admin'): Tenant | undefined {
    const tenant = this.getById(tenantId);
    if (!tenant) return undefined;

    const updated = this.update(tenant.id, {
      status: 'ARCHIVED'
    });

    AuditService.log({
      userId: 'user-001',
      userName: adminName,
      userRole: 'Super Admin',
      module: 'Account Lifecycle',
      action: 'UPDATE',
      description: `Account ARCHIVED for ${tenant.companyName} (${tenantId})`,
      recordId: tenantId,
      previousValue: tenant.status,
      newValue: 'ARCHIVED'
    });

    return updated;
  }

  public static softDelete(tenantId: string, adminName: string = 'Super Admin'): boolean {
    const tenant = this.getById(tenantId);
    if (!tenant) return false;

    this.update(tenant.id, {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: adminName
    });

    AuditService.log({
      userId: 'user-001',
      userName: adminName,
      userRole: 'Super Admin',
      module: 'Client Provisioning',
      action: 'DELETE',
      description: `Soft-deleted client ${tenant.companyName} (${tenantId})`,
      recordId: tenantId
    });

    return true;
  }

  public static permanentDelete(tenantId: string, adminName: string = 'Super Admin'): boolean {
    const tenant = this.getById(tenantId);
    if (!tenant) return false;

    StorageEngine.remove<Tenant>(STORAGE_KEYS.TENANTS, tenant.id);

    AuditService.log({
      userId: 'user-001',
      userName: adminName,
      userRole: 'Super Admin',
      module: 'Client Provisioning',
      action: 'DELETE',
      description: `PERMANENTLY DELETED customer records for ${tenant.companyName} (${tenantId})`,
      recordId: tenantId
    });

    return true;
  }

  public static getSubscriptions(tenantId?: string): TenantSubscription[] {
    const all = StorageEngine.getList<TenantSubscription>(STORAGE_KEYS.SUBSCRIPTIONS);
    if (tenantId) return all.filter(s => s.tenantId === tenantId);
    return all;
  }

  public static createSubscription(sub: Omit<TenantSubscription, 'id' | 'createdAt'>): TenantSubscription {
    const newSub: TenantSubscription = {
      ...sub,
      id: `sub-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return StorageEngine.insert<TenantSubscription>(STORAGE_KEYS.SUBSCRIPTIONS, newSub);
  }

  public static updateSubscription(id: string, updates: Partial<TenantSubscription>): TenantSubscription | undefined {
    return StorageEngine.update<TenantSubscription>(STORAGE_KEYS.SUBSCRIPTIONS, id, updates);
  }

  public static getLicenseChanges(tenantId?: string): TenantLicenseChange[] {
    const all = StorageEngine.getList<TenantLicenseChange>(STORAGE_KEYS.LICENSE_CHANGES);
    if (tenantId) return all.filter(l => l.tenantId === tenantId);
    return all;
  }

  public static getPayments(tenantId?: string): TenantPayment[] {
    const all = StorageEngine.getList<TenantPayment>(STORAGE_KEYS.PAYMENTS);
    if (tenantId) return all.filter(p => p.tenantId === tenantId);
    return all;
  }

  public static createPayment(payment: Omit<TenantPayment, 'id' | 'createdAt'>): TenantPayment {
    const newPay: TenantPayment = {
      ...payment,
      id: `pay-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return StorageEngine.insert<TenantPayment>(STORAGE_KEYS.PAYMENTS, newPay);
  }

  public static updatePaymentStatus(id: string, status: PaymentStatus): TenantPayment | undefined {
    return StorageEngine.update<TenantPayment>(STORAGE_KEYS.PAYMENTS, id, { status });
  }

  public static getStats() {
    const tenants = this.getAll();
    const totalClients = tenants.length;
    const activeClients = tenants.filter(t => t.status === 'ACTIVE').length;
    const trialClients = tenants.filter(t => t.status === 'TRIAL').length;
    const onHoldClients = tenants.filter(t => t.status === 'ON_HOLD').length;
    const suspendedClients = tenants.filter(t => t.status === 'SUSPENDED').length;
    const cancelledClients = tenants.filter(t => t.status === 'CANCELLED').length;
    const archivedClients = tenants.filter(t => t.status === 'ARCHIVED').length;

    const totalLicences = tenants.reduce((acc, t) => acc + (t.licensedEmployees || 0), 0);

    // Calculate active employees across tenants
    const allEmployees = EmployeeService.getAll();
    const totalUsedLicences = allEmployees.filter(e => e.employmentStatus === 'Active').length;
    const availableLicences = Math.max(0, totalLicences - totalUsedLicences);
    const utilizationPercent = totalLicences > 0 ? Math.round((totalUsedLicences / totalLicences) * 100) : 0;

    // Subscriptions and payments
    const subs = this.getSubscriptions();
    const payments = this.getPayments();
    const mrr = subs.reduce((acc, s) => {
      if (s.billingCycle === 'Monthly') return acc + (s.amount || 0);
      if (s.billingCycle === 'Quarterly') return acc + Math.round((s.amount || 0) / 3);
      if (s.billingCycle === 'Annual') return acc + Math.round((s.amount || 0) / 12);
      return acc;
    }, 0);

    const overduePayments = payments.filter(p => p.status === 'OVERDUE').length;

    return {
      totalClients,
      activeClients,
      trialClients,
      onHoldClients,
      suspendedClients,
      cancelledClients,
      archivedClients,
      totalLicences,
      totalUsedLicences,
      availableLicences,
      utilizationPercent,
      mrr,
      overduePayments
    };
  }
}
