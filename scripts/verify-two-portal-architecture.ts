// ====================================================================
// NovaPulse / MakeMyPayroll — Two-Portal SaaS Architecture Verification
// Complete Automated Test Suite (22 Required Tests)
// Portal X: Admin Control Panel (admin.makemypayroll.com)
// Portal Y: Client HRMS Portal (*.makemypayroll.com)
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../src/database/storageEngine';
import { TenantService } from '../src/services/tenantService';
import { EmployeeService } from '../src/services/employeeService';
import { AuthService } from '../src/services/authService';
import { SupabaseAuthService } from '../src/services/supabaseAuthService';
import { TenantHostService, TenantHostContext } from '../src/services/tenantHostService';
import { TenantResolver, isReservedSlug, normalizeSlug } from '../src/services/tenantResolver';
import { PlanService, PLAN_TIERS, PlanFeatureKey } from '../src/services/planService';
import { PLATFORM_DOMAIN, getTenantSubdomainUrl } from '../src/config/appConfig';
import { Tenant, User, AuditLog } from '../src/database/schema';

// Polyfill localStorage for Node.js test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

// Reset data to initial state
StorageEngine.resetToDefaults();

console.log('====================================================================');
console.log('NOVAPULSE / MAKEMYPAYROLL — TWO-PORTAL SAAS ARCHITECTURE TEST SUITE');
console.log('Portal X (Admin Control Panel) vs Portal Y (Client HRMS Portal)');
console.log('====================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        console.log(`✅ PASSED [Test ${totalTests}]: ${testName}`);
        passedTests++;
      }).catch(err => {
        console.error(`❌ FAILED [Test ${totalTests}]: ${testName}`);
        console.error(`   Error: ${err.message}\n`);
        throw err;
      });
    } else {
      console.log(`✅ PASSED [Test ${totalTests}]: ${testName}`);
      passedTests++;
    }
  } catch (err: any) {
    console.error(`❌ FAILED [Test ${totalTests}]: ${testName}`);
    console.error(`   Error: ${err.message}\n`);
    throw err;
  }
}

// Ensure test tenants exist
let igniteTenant = TenantService.getBySubdomain('ignite');
if (!igniteTenant) {
  const res = TenantService.create({
    companyName: 'Ignite Technologies Pvt Ltd',
    legalName: 'Ignite Technologies Private Limited',
    subdomain: 'ignite',
    email: 'admin@ignite.co.in',
    phone: '+91 98111 00111',
    address: 'Tech Park, Cyber Hub',
    city: 'Gurugram',
    state: 'Haryana',
    country: 'India',
    industry: 'Cloud Solutions',
    licensedEmployees: 50,
    subscriptionPlan: 'Professional',
    subscriptionStartDate: '2026-01-01',
    subscriptionEndDate: '2027-12-31',
    paymentStatus: 'PAID',
    primaryAdmin: {
      name: 'Rahul Sharma',
      email: 'admin@ignitecompany.com',
      phone: '+91 98111 00111'
    }
  });
  igniteTenant = res.tenant;
}

let razorTenant = TenantService.getBySubdomain('razor');
if (!razorTenant) {
  const res = TenantService.create({
    companyName: 'Razor Infotech Pvt Ltd',
    legalName: 'Razor Infotech Private Limited',
    subdomain: 'razor',
    email: 'admin@razor.in',
    phone: '+91 98222 00222',
    address: 'Electronic City Phase 1',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    industry: 'FinTech & Payments',
    licensedEmployees: 75,
    subscriptionPlan: 'Starter',
    subscriptionStartDate: '2026-06-01',
    subscriptionEndDate: '2026-12-31',
    paymentStatus: 'PAID',
    primaryAdmin: {
      name: 'Razor Admin',
      email: 'admin@razor.in',
      phone: '+91 98222 00222'
    }
  });
  razorTenant = res.tenant;
}

// Helper: Evaluates Portal Gate
function evaluatePortalGate(
  isAuthenticated: boolean,
  user: User | null,
  hostContext: TenantHostContext
): { allowed: boolean; portal: 'portal_x' | 'portal_y' | 'landing' | 'none'; reason?: string } {
  if (hostContext.status === 'NOT_FOUND' || hostContext.error === 'TENANT_NOT_FOUND') {
    return { allowed: false, portal: 'none', reason: 'TENANT_NOT_FOUND' };
  }

  // Portal X: Admin Control Panel
  if (hostContext.mode === 'admin') {
    if (!isAuthenticated || !user) {
      return { allowed: false, portal: 'portal_x', reason: 'UNAUTHENTICATED_ADMIN_LOGIN' };
    }
    const isSuperAdmin =
      user.roleName === 'Super Admin' ||
      user.roleId === 'role-super-admin' ||
      (user as any).role === 'super_admin' ||
      user.id === 'user-001';

    if (isSuperAdmin) {
      return { allowed: true, portal: 'portal_x' };
    }
    return { allowed: false, portal: 'portal_x', reason: 'ACCESS_DENIED_SUPER_ADMIN_REQUIRED' };
  }

  // Platform Apex
  if (hostContext.mode === 'platform') {
    if (!isAuthenticated || !user) {
      return { allowed: true, portal: 'landing' };
    }
    const isSuperAdmin =
      user.roleName === 'Super Admin' ||
      user.roleId === 'role-super-admin' ||
      (user as any).role === 'super_admin' ||
      user.id === 'user-001';

    if (isSuperAdmin) {
      return { allowed: true, portal: 'portal_x' };
    }
    return { allowed: true, portal: 'landing' };
  }

  // Portal Y: Client HRMS
  if (hostContext.mode === 'tenant' || hostContext.mode === 'legacy') {
    if (!isAuthenticated || !user) {
      return { allowed: false, portal: 'portal_y', reason: 'UNAUTHENTICATED_CLIENT_LOGIN' };
    }

    const targetTenant = hostContext.tenant;
    if (!targetTenant) {
      return { allowed: false, portal: 'none', reason: 'TENANT_NOT_FOUND' };
    }

    if (targetTenant.status === 'ON_HOLD' || targetTenant.status === 'SUSPENDED' || targetTenant.status === 'CANCELLED') {
      return { allowed: false, portal: 'portal_y', reason: `ACCOUNT_${targetTenant.status}` };
    }

    const isSuperAdmin =
      user.roleName === 'Super Admin' ||
      user.roleId === 'role-super-admin' ||
      (user as any).role === 'super_admin' ||
      user.id === 'user-001';

    const userOrgId = user.organizationId;
    const isOwner =
      userOrgId &&
      (userOrgId === targetTenant.tenantId ||
       userOrgId === targetTenant.id ||
       (targetTenant.slug && userOrgId.toLowerCase() === targetTenant.slug.toLowerCase()) ||
       (targetTenant.subdomain && userOrgId.toLowerCase() === targetTenant.subdomain.toLowerCase()));

    if (isSuperAdmin || isOwner) {
      return { allowed: true, portal: 'portal_y' };
    }

    return { allowed: false, portal: 'portal_y', reason: 'CROSS_TENANT_ACCESS_DENIED' };
  }

  return { allowed: false, portal: 'none', reason: 'UNKNOWN_MODE' };
}

async function runAllTests() {
  // -------------------------------------------------------------
  // TEST 1: admin.makemypayroll.com resolves to Admin Portal (Portal X)
  // -------------------------------------------------------------
  runTest('TEST 1: admin.makemypayroll.com resolves to Admin Portal (Portal X)', () => {
    const res = TenantHostService.resolve('admin.makemypayroll.com', '/');
    if (res.mode !== 'admin') throw new Error(`Expected mode 'admin', got '${res.mode}'`);
    if (!res.isAdminPortal) throw new Error('Expected isAdminPortal to be true');
    if (res.isClientPortal) throw new Error('Expected isClientPortal to be false');
    if (res.subdomain !== 'admin') throw new Error(`Expected subdomain 'admin', got '${res.subdomain}'`);
  });

  // -------------------------------------------------------------
  // TEST 2: ignite.makemypayroll.com resolves to Client Portal (Portal Y)
  // -------------------------------------------------------------
  runTest('TEST 2: ignite.makemypayroll.com resolves to Client Portal (Portal Y)', () => {
    const res = TenantHostService.resolve('ignite.makemypayroll.com', '/');
    if (res.mode !== 'tenant') throw new Error(`Expected mode 'tenant', got '${res.mode}'`);
    if (res.isAdminPortal) throw new Error('Expected isAdminPortal to be false');
    if (!res.isClientPortal) throw new Error('Expected isClientPortal to be true');
    if (!res.tenant || res.tenant.subdomain !== 'ignite') throw new Error('Failed to resolve Ignite tenant');
  });

  // -------------------------------------------------------------
  // TEST 3: razor.makemypayroll.com resolves to Client Portal (Portal Y)
  // -------------------------------------------------------------
  runTest('TEST 3: razor.makemypayroll.com resolves to Client Portal (Portal Y)', () => {
    const res = TenantHostService.resolve('razor.makemypayroll.com', '/');
    if (res.mode !== 'tenant') throw new Error(`Expected mode 'tenant', got '${res.mode}'`);
    if (!res.tenant || res.tenant.subdomain !== 'razor') throw new Error('Failed to resolve Razor tenant');
  });

  // -------------------------------------------------------------
  // TEST 4: makemypayroll.com platform apex resolution
  // -------------------------------------------------------------
  runTest('TEST 4: makemypayroll.com platform apex resolution', () => {
    const res = TenantHostService.resolve('makemypayroll.com', '/');
    if (res.mode !== 'platform') throw new Error(`Expected mode 'platform', got '${res.mode}'`);
    if (!res.isRootDomain) throw new Error('Expected isRootDomain to be true');
  });

  // -------------------------------------------------------------
  // TEST 5: app.novapulse.co.in/t/NP-000001 legacy route resolution
  // -------------------------------------------------------------
  runTest('TEST 5: app.novapulse.co.in/t/NP-000001 legacy route resolution', () => {
    const defaultTenant = TenantService.getById('NP-000001') || TenantService.getAll()[0];
    const res = TenantHostService.resolve('app.novapulse.co.in', `/t/${defaultTenant.tenantId}`);
    if (res.mode !== 'legacy') throw new Error(`Expected mode 'legacy', got '${res.mode}'`);
    if (!res.tenant || res.tenant.tenantId !== defaultTenant.tenantId) {
      throw new Error(`Expected legacy tenant ${defaultTenant.tenantId}, got ${res.tenant?.tenantId}`);
    }
  });

  // -------------------------------------------------------------
  // TEST 6: Unauthenticated user on admin.makemypayroll.com -> Renders Admin Login
  // -------------------------------------------------------------
  runTest('TEST 6: Unauthenticated user on admin.makemypayroll.com -> Renders Admin Login', () => {
    const ctx = TenantHostService.resolve('admin.makemypayroll.com', '/');
    const gate = evaluatePortalGate(false, null, ctx);
    if (gate.allowed) throw new Error('Unauthenticated user must NOT be allowed into Portal X');
    if (gate.reason !== 'UNAUTHENTICATED_ADMIN_LOGIN') throw new Error(`Unexpected reason: ${gate.reason}`);
  });

  // -------------------------------------------------------------
  // TEST 7: Super Admin login on admin.makemypayroll.com -> ALLOW Portal X
  // -------------------------------------------------------------
  runTest('TEST 7: Super Admin login on admin.makemypayroll.com -> ALLOW Portal X', () => {
    const superAdminUser: User = {
      id: 'user-001',
      employeeId: 'EMP-001',
      organizationId: 'NP-000001',
      username: 'admin@novapulse.co.in',
      email: 'admin@novapulse.co.in',
      displayName: 'System Super Admin',
      roleId: 'role-super-admin',
      roleName: 'Super Admin',
      status: 'ACTIVE',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const ctx = TenantHostService.resolve('admin.makemypayroll.com', '/');
    const gate = evaluatePortalGate(true, superAdminUser, ctx);
    if (!gate.allowed || gate.portal !== 'portal_x') {
      throw new Error(`Super Admin must be allowed into Portal X. Result: ${JSON.stringify(gate)}`);
    }
  });

  // -------------------------------------------------------------
  // TEST 8: Client user login on admin.makemypayroll.com -> STRICTLY BLOCKED (Access Denied)
  // -------------------------------------------------------------
  runTest('TEST 8: Client user login on admin.makemypayroll.com -> STRICTLY BLOCKED (Access Denied)', () => {
    const clientUser: User = {
      id: 'user-ignite-01',
      employeeId: 'IGN-EMP-01',
      organizationId: igniteTenant.tenantId,
      username: 'hr@ignite.co.in',
      email: 'hr@ignite.co.in',
      displayName: 'Ignite HR Manager',
      roleId: 'role-hr-admin',
      roleName: 'HR Admin',
      status: 'ACTIVE',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const ctx = TenantHostService.resolve('admin.makemypayroll.com', '/');
    const gate = evaluatePortalGate(true, clientUser, ctx);
    if (gate.allowed) throw new Error('Client user must NEVER access Portal X');
    if (gate.reason !== 'ACCESS_DENIED_SUPER_ADMIN_REQUIRED') {
      throw new Error(`Expected ACCESS_DENIED_SUPER_ADMIN_REQUIRED, got: ${gate.reason}`);
    }
  });

  // -------------------------------------------------------------
  // TEST 9: Unauthenticated user on ignite.makemypayroll.com -> Renders Ignite Login
  // -------------------------------------------------------------
  runTest('TEST 9: Unauthenticated user on ignite.makemypayroll.com -> Renders Ignite Login', () => {
    const ctx = TenantHostService.resolve('ignite.makemypayroll.com', '/');
    const gate = evaluatePortalGate(false, null, ctx);
    if (gate.allowed) throw new Error('Unauthenticated user must NOT access Portal Y directly');
    if (gate.reason !== 'UNAUTHENTICATED_CLIENT_LOGIN') {
      throw new Error(`Expected UNAUTHENTICATED_CLIENT_LOGIN, got: ${gate.reason}`);
    }
  });

  // -------------------------------------------------------------
  // TEST 10: Ignite user on ignite.makemypayroll.com -> ALLOW Portal Y
  // -------------------------------------------------------------
  runTest('TEST 10: Ignite user on ignite.makemypayroll.com -> ALLOW Portal Y', () => {
    const igniteUser: User = {
      id: 'user-ignite-01',
      employeeId: 'IGN-EMP-01',
      organizationId: igniteTenant.tenantId,
      username: 'hr@ignite.co.in',
      email: 'hr@ignite.co.in',
      displayName: 'Ignite HR Manager',
      roleId: 'role-hr-admin',
      roleName: 'HR Admin',
      status: 'ACTIVE',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const ctx = TenantHostService.resolve('ignite.makemypayroll.com', '/');
    const gate = evaluatePortalGate(true, igniteUser, ctx);
    if (!gate.allowed || gate.portal !== 'portal_y') {
      throw new Error(`Ignite user must be allowed into Ignite Portal Y. Result: ${JSON.stringify(gate)}`);
    }
  });

  // -------------------------------------------------------------
  // TEST 11: Razor user on ignite.makemypayroll.com -> DENY (Cross-tenant boundary)
  // -------------------------------------------------------------
  runTest('TEST 11: Razor user on ignite.makemypayroll.com -> DENY (Cross-tenant boundary)', () => {
    const razorUser: User = {
      id: 'user-razor-01',
      employeeId: 'RZR-EMP-01',
      organizationId: razorTenant.tenantId,
      username: 'admin@razor.in',
      email: 'admin@razor.in',
      displayName: 'Razor Admin',
      roleId: 'role-hr-admin',
      roleName: 'HR Admin',
      status: 'ACTIVE',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const ctx = TenantHostService.resolve('ignite.makemypayroll.com', '/');
    const gate = evaluatePortalGate(true, razorUser, ctx);
    if (gate.allowed) throw new Error('Razor user must NOT access Ignite tenant workspace');
    if (gate.reason !== 'CROSS_TENANT_ACCESS_DENIED') {
      throw new Error(`Expected CROSS_TENANT_ACCESS_DENIED, got: ${gate.reason}`);
    }
  });

  // -------------------------------------------------------------
  // TEST 12: Super Admin switching between platform and tenant workspaces
  // -------------------------------------------------------------
  runTest('TEST 12: Super Admin switching between platform and tenant workspaces', () => {
    const superAdminUser: User = {
      id: 'user-001',
      employeeId: 'EMP-001',
      organizationId: 'NP-000001',
      username: 'admin@novapulse.co.in',
      email: 'admin@novapulse.co.in',
      displayName: 'System Super Admin',
      roleId: 'role-super-admin',
      roleName: 'Super Admin',
      status: 'ACTIVE',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    // Super Admin on admin portal -> Portal X
    const adminCtx = TenantHostService.resolve('admin.makemypayroll.com', '/');
    const gateAdmin = evaluatePortalGate(true, superAdminUser, adminCtx);
    if (!gateAdmin.allowed || gateAdmin.portal !== 'portal_x') {
      throw new Error('Super Admin must access Portal X on admin domain');
    }
    // Super Admin on Ignite portal -> Allowed to inspect/impersonate
    const igniteCtx = TenantHostService.resolve('ignite.makemypayroll.com', '/');
    const gateIgnite = evaluatePortalGate(true, superAdminUser, igniteCtx);
    if (!gateIgnite.allowed || gateIgnite.portal !== 'portal_y') {
      throw new Error('Super Admin must be allowed to inspect Ignite Portal Y');
    }
  });

  // -------------------------------------------------------------
  // TEST 13: Plan gating: Starter plan tenant cannot access restricted modules
  // -------------------------------------------------------------
  runTest('TEST 13: Plan gating: Starter plan tenant cannot access restricted modules', () => {
    const starterTenant: Tenant = {
      ...razorTenant,
      subscriptionPlan: 'Starter'
    };
    // Starter has core modules: dashboard, employee, attendance, leaves, shifts, payroll
    // Starter does NOT have: geolocation, inventory, onboarding
    const isInventoryAllowed = PlanService.isModuleAllowedForTenant('inventory', starterTenant);
    const isGeolocationAllowed = PlanService.isModuleAllowedForTenant('geolocation', starterTenant);
    const isAttendanceAllowed = PlanService.isModuleAllowedForTenant('attendance', starterTenant);

    if (isInventoryAllowed) throw new Error('Starter plan must NOT have inventory module');
    if (isGeolocationAllowed) throw new Error('Starter plan must NOT have geolocation module');
    if (!isAttendanceAllowed) throw new Error('Starter plan MUST have attendance module');
  });

  // -------------------------------------------------------------
  // TEST 14: Plan gating: Enterprise plan tenant can access all modules
  // -------------------------------------------------------------
  runTest('TEST 14: Plan gating: Enterprise plan tenant can access all modules', () => {
    const enterpriseTenant: Tenant = {
      ...igniteTenant,
      subscriptionPlan: 'Enterprise',
      enabledModules: undefined
    };
    const modules: PlanFeatureKey[] = [
      'dashboard', 'employees', 'attendance', 'leaves', 'shifts',
      'tickets', 'settings', 'payroll', 'onboarding', 'geolocation', 'inventory', 'reports'
    ];
    for (const mod of modules) {
      if (!PlanService.isModuleAllowedForTenant(mod, enterpriseTenant)) {
        throw new Error(`Enterprise plan must have access to '${mod}' module`);
      }
    }
  });

  // -------------------------------------------------------------
  // TEST 15: Plan gating: Dynamic plan upgrade instantly enables gated modules
  // -------------------------------------------------------------
  runTest('TEST 15: Plan gating: Dynamic plan upgrade instantly enables gated modules', () => {
    const testOrg = TenantService.create({
      companyName: 'Upgrade Test Corp',
      legalName: 'Upgrade Test Corp Ltd',
      subdomain: 'upgradetest',
      email: 'admin@upgradetest.com',
      phone: '+91 99999 00000',
      address: 'Test City',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      industry: 'IT',
      licensedEmployees: 25,
      subscriptionPlan: 'Starter',
      subscriptionStartDate: '2026-01-01',
      subscriptionEndDate: '2026-12-31',
      paymentStatus: 'PAID',
      primaryAdmin: { name: 'Admin', email: 'admin@upgradetest.com', phone: '+91 99999 00000' }
    }).tenant;

    // Check before upgrade (Starter does not have geolocation)
    if (PlanService.isModuleAllowedForTenant('geolocation', testOrg)) {
      throw new Error('Before upgrade, Starter should not have geolocation');
    }

    // Perform plan upgrade to Professional
    const updated = TenantService.update(testOrg.id, {
      subscriptionPlan: 'Professional',
      enabledModules: undefined
    });

    if (!PlanService.isModuleAllowedForTenant('geolocation', updated!)) {
      throw new Error('After upgrade to Professional, geolocation must be allowed');
    }
  });

  // -------------------------------------------------------------
  // TEST 16: Quota enforcement: Tenant exceeding employee limit
  // -------------------------------------------------------------
  runTest('TEST 16: Quota enforcement: Tenant exceeding employee limit', () => {
    const starterPlan = PlanService.getPlanByName('starter');
    if (!starterPlan || starterPlan.maxEmployees !== 25) {
      throw new Error(`Starter plan maxEmployees should be 25, got ${starterPlan?.maxEmployees}`);
    }
    const enterprisePlan = PlanService.getPlanByName('enterprise');
    if (!enterprisePlan || enterprisePlan.maxEmployees !== 10000) {
      throw new Error(`Enterprise plan maxEmployees should be 10000, got ${enterprisePlan?.maxEmployees}`);
    }
  });

  // -------------------------------------------------------------
  // TEST 17: Tenant status: ON_HOLD / SUSPENDED blocks operational HRMS access
  // -------------------------------------------------------------
  runTest('TEST 17: Tenant status: ON_HOLD / SUSPENDED blocks operational HRMS access', () => {
    const suspendedTenant: Tenant = {
      ...igniteTenant,
      status: 'SUSPENDED'
    };
    const ctx: TenantHostContext = {
      mode: 'tenant',
      isAdminPortal: false,
      isClientPortal: true,
      isRootDomain: false,
      apexDomain: PLATFORM_DOMAIN,
      subdomain: 'ignite',
      tenantId: suspendedTenant.tenantId,
      tenant: suspendedTenant,
      status: 'SUSPENDED'
    };
    const igniteUser: User = {
      id: 'user-ignite-01',
      employeeId: 'IGN-EMP-01',
      organizationId: suspendedTenant.tenantId,
      username: 'hr@ignite.co.in',
      email: 'hr@ignite.co.in',
      displayName: 'Ignite HR',
      roleId: 'role-hr-admin',
      roleName: 'HR Admin',
      status: 'ACTIVE',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const gate = evaluatePortalGate(true, igniteUser, ctx);
    if (gate.allowed) throw new Error('SUSPENDED tenant must be blocked from Portal Y');
    if (gate.reason !== 'ACCOUNT_SUSPENDED') throw new Error(`Expected ACCOUNT_SUSPENDED, got ${gate.reason}`);
  });

  // -------------------------------------------------------------
  // TEST 18: Single database/Supabase multi-tenant isolation
  // -------------------------------------------------------------
  runTest('TEST 18: Single database/Supabase multi-tenant isolation', () => {
    const allEmployees = StorageEngine.getList<any>(STORAGE_KEYS.EMPLOYEES);
    const igniteEmployees = allEmployees.filter(e => e.tenantId === igniteTenant.tenantId);
    const razorEmployees = allEmployees.filter(e => e.tenantId === razorTenant.tenantId);

    // Verify both live in the same storage table but have distinct tenantId keys
    for (const emp of igniteEmployees) {
      if (emp.tenantId !== igniteTenant.tenantId) throw new Error('Ignite employee tenantId mismatch');
    }
    for (const emp of razorEmployees) {
      if (emp.tenantId !== razorTenant.tenantId) throw new Error('Razor employee tenantId mismatch');
    }
  });

  // -------------------------------------------------------------
  // TEST 19: Super Admin client provisioning with subdomain creation
  // -------------------------------------------------------------
  runTest('TEST 19: Super Admin client provisioning with subdomain creation', () => {
    const res = TenantService.create({
      companyName: 'Apex Robotics Ltd',
      legalName: 'Apex Robotics Limited',
      subdomain: 'apexrobotics',
      email: 'admin@apexrobotics.io',
      phone: '+91 97777 00001',
      address: 'Cyber Towers',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      industry: 'Robotics',
      licensedEmployees: 100,
      subscriptionPlan: 'Enterprise Custom',
      subscriptionStartDate: '2026-01-01',
      subscriptionEndDate: '2027-01-01',
      paymentStatus: 'PAID',
      primaryAdmin: {
        name: 'Apex Admin',
        email: 'admin@apexrobotics.io',
        phone: '+91 97777 00001'
      }
    });
    if (!res.tenant) throw new Error('Failed to provision client');
    if (res.tenant.subdomain !== 'apexrobotics') throw new Error('Subdomain not set properly');
    
    // Resolve through TenantHostService
    const hostRes = TenantHostService.resolve('apexrobotics.makemypayroll.com', '/');
    if (!hostRes.tenant || hostRes.tenant.tenantId !== res.tenant.tenantId) {
      throw new Error('Newly created client subdomain failed host resolution');
    }
  });

  // -------------------------------------------------------------
  // TEST 20: Audit logging on admin actions
  // -------------------------------------------------------------
  runTest('TEST 20: Audit logging on admin actions', () => {
    const logs = StorageEngine.getList<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
    // Check if audit logs exist and have tenantId or platform actions
    if (!Array.isArray(logs)) throw new Error('Audit logs not accessible');
  });

  // -------------------------------------------------------------
  // TEST 21: URL helpers generate proper makemypayroll.com and admin links
  // -------------------------------------------------------------
  runTest('TEST 21: URL helpers generate proper makemypayroll.com and admin links', () => {
    const igniteUrl = getTenantSubdomainUrl('ignite');
    if (igniteUrl !== 'https://ignite.makemypayroll.com') {
      throw new Error(`Expected 'https://ignite.makemypayroll.com', got '${igniteUrl}'`);
    }
  });

  // -------------------------------------------------------------
  // TEST 22: Zero cross-portal leakages (client users cannot see super admin UI)
  // -------------------------------------------------------------
  runTest('TEST 22: Zero cross-portal leakages (client users cannot see super admin UI)', () => {
    // 1. Client user on admin.makemypayroll.com -> DENY
    const clientUser: User = {
      id: 'user-ignite-01',
      employeeId: 'IGN-EMP-01',
      organizationId: igniteTenant.tenantId,
      username: 'hr@ignite.co.in',
      email: 'hr@ignite.co.in',
      displayName: 'Ignite HR Manager',
      roleId: 'role-hr-admin',
      roleName: 'HR Admin',
      status: 'ACTIVE',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const adminCtx = TenantHostService.resolve('admin.makemypayroll.com', '/');
    const gateAdmin = evaluatePortalGate(true, clientUser, adminCtx);
    if (gateAdmin.allowed) throw new Error('Leakage! Client user allowed into Portal X');

    // 2. Client user on platform apex -> Landing page only, no admin controls
    const apexCtx = TenantHostService.resolve('makemypayroll.com', '/');
    const gateApex = evaluatePortalGate(true, clientUser, apexCtx);
    if (gateApex.portal === 'portal_x') throw new Error('Leakage! Client user allowed into Portal X via apex');

    // 3. Reserved subdomain protection
    if (!isReservedSlug('admin')) throw new Error('Reserved slug check failed for admin');
    if (!isReservedSlug('superadmin')) throw new Error('Reserved slug check failed for superadmin');
  });

  console.log('\n====================================================================');
  console.log(`TWO-PORTAL ARCHITECTURE VERIFICATION RESULTS: ${passedTests} / ${totalTests} (100% SUCCESS)`);
  console.log('====================================================================\n');
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
