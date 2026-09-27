import { TenantHostService } from '../services/tenantHostService';
import { TenantResolver } from '../services/tenantResolver';
import { TenantService } from '../services/tenantService';
import { StorageEngine } from '../database/storageEngine';
import { User, Tenant } from '../database/schema';

// Initialize storage engine
StorageEngine.init();

console.log('====================================================');
console.log('SILARIS TENANT RESOLUTION & SECURITY VERIFICATION SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] Test ${totalTests}: ${testName}`);
    if (details) console.log(`       ${details}`);
    passedTests++;
  } else {
    console.error(`[FAIL] Test ${totalTests}: ${testName}`);
    if (details) console.error(`       Details: ${details}`);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------
// TEST 1: Silaris Subdomain Extraction
// ----------------------------------------------------
const silarisHost = 'silaris.makemypayroll.com';
const extractedSlug = TenantHostService.extractSubdomain(silarisHost);
assert(
  extractedSlug === 'silaris',
  'Subdomain extraction for silaris.makemypayroll.com',
  `Extracted: "${extractedSlug}", Expected: "silaris"`
);

// ----------------------------------------------------
// TEST 2: Silaris Tenant Record & Resolution
// ----------------------------------------------------
const silarisTenant = TenantService.getBySubdomain('silaris');
assert(
  !!silarisTenant,
  'Silaris tenant located in registry',
  `Found: ${silarisTenant?.companyName} (${silarisTenant?.tenantId}), Slug: "${silarisTenant?.slug}", Status: "${silarisTenant?.status}"`
);

assert(
  silarisTenant?.tenantId === 'NP-000006' && silarisTenant?.slug === 'silaris' && silarisTenant?.status === 'ACTIVE',
  'Silaris tenant properties validation',
  `Tenant ID: ${silarisTenant?.tenantId}, Slug: ${silarisTenant?.slug}, Status: ${silarisTenant?.status}`
);

// ----------------------------------------------------
// TEST 3: TenantHostService Resolution for silaris.makemypayroll.com
// ----------------------------------------------------
const silarisContext = TenantHostService.resolve(silarisHost);
assert(
  silarisContext.mode === 'tenant' &&
  silarisContext.tenantId === 'NP-000006' &&
  silarisContext.status === 'ACTIVE' &&
  silarisContext.isClientPortal === true,
  'Resolution of https://silaris.makemypayroll.com to ACTIVE Silaris Client Portal',
  `Mode: ${silarisContext.mode}, Status: ${silarisContext.status}, Tenant: ${silarisContext.tenant?.companyName}`
);

// ----------------------------------------------------
// TEST 4: Unknown Subdomain (unknown.makemypayroll.com)
// ----------------------------------------------------
const unknownContext = TenantHostService.resolve('unknown.makemypayroll.com');
assert(
  unknownContext.status === 'NOT_FOUND' &&
  unknownContext.error === 'TENANT_NOT_FOUND',
  'Unknown subdomain (unknown.makemypayroll.com) -> Organization Not Found',
  `Status: ${unknownContext.status}, Error: ${unknownContext.error}`
);

// ----------------------------------------------------
// TEST 5: Cross-Tenant Access Boundary Check (Tenant A -> Tenant B)
// ----------------------------------------------------
const userTenantA: User = {
  id: 'user-acme-admin',
  organizationId: 'NP-000002', // Acme Global
  employeeId: 'emp-acme-01',
  email: 'admin@acmeglobal.com',
  fullName: 'Acme Admin',
  roleId: 'role-hr-admin',
  roleName: 'HR Admin',
  avatar: '',
  status: 'active',
};

const crossAccessAtoB = TenantHostService.resolveAccess({
  hostname: 'silaris.makemypayroll.com',
  user: userTenantA,
  isAuthenticated: true,
  userTenantId: 'NP-000002',
});

assert(
  crossAccessAtoB.isAllowed === false &&
  crossAccessAtoB.reason === 'UNAUTHORIZED_ORGANIZATION_ACCESS',
  'Cross-Tenant Boundary: User Tenant A (Acme) accessing Tenant B (Silaris) -> Access Denied',
  `Allowed: ${crossAccessAtoB.isAllowed}, Reason: ${crossAccessAtoB.reason}`
);

// ----------------------------------------------------
// TEST 6: Cross-Tenant Access Boundary Check (Tenant B -> Tenant A)
// ----------------------------------------------------
const userTenantB: User = {
  id: 'user-silaris-admin',
  organizationId: 'NP-000006', // Silaris
  employeeId: 'emp-sil-01',
  email: 'admin@silaris.in',
  fullName: 'Silaris Admin',
  roleId: 'role-hr-admin',
  roleName: 'HR Admin',
  avatar: '',
  status: 'active',
};

const crossAccessBtoA = TenantHostService.resolveAccess({
  hostname: 'acme.makemypayroll.com',
  user: userTenantB,
  isAuthenticated: true,
  userTenantId: 'NP-000006',
});

assert(
  crossAccessBtoA.isAllowed === false &&
  crossAccessBtoA.reason === 'UNAUTHORIZED_ORGANIZATION_ACCESS',
  'Cross-Tenant Boundary: User Tenant B (Silaris) accessing Tenant A (Acme) -> Access Denied',
  `Allowed: ${crossAccessBtoA.isAllowed}, Reason: ${crossAccessBtoA.reason}`
);

// ----------------------------------------------------
// TEST 7: Super Admin Access to Admin Portal & Tenant Impersonation
// ----------------------------------------------------
const superAdminUser: User = {
  id: 'user-001',
  organizationId: 'NP-000001',
  employeeId: 'emp-001',
  email: 'yatender@novapulse.co.in',
  fullName: 'Yatender Sharma (Super Admin)',
  roleId: 'role-super-admin',
  roleName: 'Super Admin',
  avatar: '',
  status: 'active',
};

const superAdminAdminPortal = TenantHostService.resolveAccess({
  hostname: 'admin.makemypayroll.com',
  user: superAdminUser,
  isAuthenticated: true,
});

assert(
  superAdminAdminPortal.isAllowed === true &&
  superAdminAdminPortal.status === 'ALLOW_SUPER_ADMIN',
  'SUPER_ADMIN accessing admin.makemypayroll.com -> Allowed Admin Platform Portal',
  `Status: ${superAdminAdminPortal.status}`
);

const superAdminSilarisAccess = TenantHostService.resolveAccess({
  hostname: 'silaris.makemypayroll.com',
  user: superAdminUser,
  isAuthenticated: true,
});

assert(
  superAdminSilarisAccess.isAllowed === true &&
  superAdminSilarisAccess.status === 'ALLOW_SUPER_ADMIN_IMPERSONATION',
  'SUPER_ADMIN accessing silaris.makemypayroll.com -> Allowed with Admin Impersonation privileges',
  `Status: ${superAdminSilarisAccess.status}`
);

// ----------------------------------------------------
// TEST 8: Tenant Status Gate — ON_HOLD Restriction
// ----------------------------------------------------
const starlightUser: User = {
  id: 'user-starlight-admin',
  organizationId: 'NP-000003', // Starlight
  employeeId: 'emp-str-01',
  email: 'admin@starlightretail.in',
  fullName: 'Starlight Admin',
  roleId: 'role-hr-admin',
  roleName: 'HR Admin',
  avatar: '',
  status: 'active',
};

const onHoldAccess = TenantHostService.resolveAccess({
  hostname: 'starlight.makemypayroll.com',
  user: starlightUser,
  isAuthenticated: true,
  userTenantId: 'NP-000003',
});

assert(
  onHoldAccess.isAllowed === false &&
  onHoldAccess.status === 'BLOCKED_ON_HOLD',
  'ON_HOLD tenant (Starlight) -> Correctly blocked with BLOCKED_ON_HOLD restriction',
  `Allowed: ${onHoldAccess.isAllowed}, Status: ${onHoldAccess.status}`
);

// ----------------------------------------------------
// TEST 9: Tenant Status Gate — SUSPENDED Restriction
// ----------------------------------------------------
const quantumUser: User = {
  id: 'user-quantum-admin',
  organizationId: 'NP-000005', // Quantum
  employeeId: 'emp-qnt-01',
  email: 'accounts@quantumfintech.io',
  fullName: 'Quantum Admin',
  roleId: 'role-hr-admin',
  roleName: 'HR Admin',
  avatar: '',
  status: 'active',
};

const suspendedAccess = TenantHostService.resolveAccess({
  hostname: 'quantum.makemypayroll.com',
  user: quantumUser,
  isAuthenticated: true,
  userTenantId: 'NP-000005',
});

assert(
  suspendedAccess.isAllowed === false &&
  suspendedAccess.status === 'BLOCKED_SUSPENDED',
  'SUSPENDED tenant (Quantum) -> Correctly blocked with BLOCKED_SUSPENDED restriction',
  `Allowed: ${suspendedAccess.isAllowed}, Status: ${suspendedAccess.status}`
);

// ----------------------------------------------------
// TEST 10: Tenant Status Gate — CANCELLED Restriction
// ----------------------------------------------------
// Create a cancelled tenant test scenario
TenantService.updateStatus('NP-000004', 'CANCELLED', 'Test cancellation');
const zenithUser: User = {
  id: 'user-zenith-admin',
  organizationId: 'NP-000004',
  employeeId: 'emp-zen-01',
  email: 'admin@zenithhealth.org',
  fullName: 'Zenith Admin',
  roleId: 'role-hr-admin',
  roleName: 'HR Admin',
  avatar: '',
  status: 'active',
};

const cancelledAccess = TenantHostService.resolveAccess({
  hostname: 'zenith.makemypayroll.com',
  user: zenithUser,
  isAuthenticated: true,
  userTenantId: 'NP-000004',
});

assert(
  cancelledAccess.isAllowed === false &&
  cancelledAccess.status === 'BLOCKED_CANCELLED',
  'CANCELLED tenant (Zenith) -> Correctly blocked with BLOCKED_CANCELLED restriction',
  `Allowed: ${cancelledAccess.isAllowed}, Status: ${cancelledAccess.status}`
);

// Restore Zenith status
TenantService.updateStatus('NP-000004', 'TRIAL', 'Restore trial');

// ----------------------------------------------------
// TEST 11: Valid User Login to Silaris Tenant
// ----------------------------------------------------
const silarisAuthorizedAccess = TenantHostService.resolveAccess({
  hostname: 'silaris.makemypayroll.com',
  user: userTenantB,
  isAuthenticated: true,
  userTenantId: 'NP-000006',
});

assert(
  silarisAuthorizedAccess.isAllowed === true &&
  silarisAuthorizedAccess.status === 'ALLOW_TENANT_HRMS',
  'Silaris Authorized User on https://silaris.makemypayroll.com -> Allowed Tenant HRMS Portal',
  `Allowed: ${silarisAuthorizedAccess.isAllowed}, Status: ${silarisAuthorizedAccess.status}`
);

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================');

if (passedTests === totalTests) {
  console.log('ALL VERIFICATION CRITERIA SUCCESSFULLY MET!');
} else {
  process.exit(1);
}
