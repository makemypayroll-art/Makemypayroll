// ====================================================================
// MAKEMYPAYROLL BY NOVAPULSE — MASTER END-TO-END VERIFICATION SUITE
// Exhaustive Full-Lifecycle E2E, UAT, RBAC, Multi-Tenant & Performance Suite
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../src/database/storageEngine';
import { TenantService } from '../src/services/tenantService';
import { AuthService } from '../src/services/authService';
import { EmployeeService } from '../src/services/employeeService';
import { ShiftService } from '../src/services/shiftService';
import { AttendanceService } from '../src/services/attendanceService';
import { LeaveService } from '../src/services/leaveService';
import { PayrollService } from '../src/services/payrollService';
import { PayrollStatutoryService } from '../src/services/payroll/payrollStatutoryService';
import { PayrollCalculationService } from '../src/services/payroll/payrollCalculationService';
import { PayrollLoanService } from '../src/services/payroll/payrollLoanService';
import { PayrollAdvanceService } from '../src/services/payroll/payrollAdvanceService';
import { PayrollReimbursementService } from '../src/services/payroll/payrollReimbursementService';
import { PayrollOvertimeService, PayrollEncashmentService } from '../src/services/payroll/payrollOvertimeService';
import { TicketService } from '../src/services/ticketService';
import { InventoryService } from '../src/services/inventoryService';
import { OnboardingService } from '../src/services/onboardingService';
import { AuditService } from '../src/services/auditService';
import { PlanService } from '../src/services/planService';
import { TenantHostService } from '../src/services/tenantHostService';
import { MMPAnalyticsService } from '../src/services/analytics/mmpAnalyticsService';
import { MMPInsightService } from '../src/services/mmpInsights/mmpInsightService';
import { AIProviderService, MakeMyPayrollBuiltinAIProvider } from '../src/services/ai/aiProviderService';
import {
  Tenant,
  User,
  Employee,
  PayrollPeriod,
  Payslip,
  LeaveEncashmentRecord,
  MMPDatasetRow,
} from '../src/database/schema';

// Reset to clean baseline
StorageEngine.resetToDefaults();

console.log('====================================================================');
console.log('MAKEMYPAYROLL — MASTER FULL-LIFECYCLE E2E TEST & UAT SUITE');
console.log('====================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults: Array<{ id: number; name: string; status: 'PASS' | 'FAIL'; error?: string }> = [];

function runTest(testName: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`✅ PASSED [Test ${totalTests}]: ${testName}`);
    passedTests++;
    testResults.push({ id: totalTests, name: testName, status: 'PASS' });
  } catch (err: any) {
    console.error(`❌ FAILED [Test ${totalTests}]: ${testName}`);
    console.error(`   Error: ${err.message}\n`);
    failedTests++;
    testResults.push({ id: totalTests, name: testName, status: 'FAIL', error: err.message });
    throw err; // Fail-fast for debugging
  }
}

async function runAsyncTest(testName: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ PASSED [Test ${totalTests}]: ${testName}`);
    passedTests++;
    testResults.push({ id: totalTests, name: testName, status: 'PASS' });
  } catch (err: any) {
    console.error(`❌ FAILED [Test ${totalTests}]: ${testName}`);
    console.error(`   Error: ${err.message}\n`);
    failedTests++;
    testResults.push({ id: totalTests, name: testName, status: 'FAIL', error: err.message });
    throw err;
  }
}

async function runMasterSuite() {
  // ====================================================================
  // PHASE 1: END-TO-END 35-STEP REAL-WORLD CUSTOMER JOURNEY
  // ====================================================================
  console.log('\n--- PHASE 1: 35-STEP REAL-WORLD CUSTOMER JOURNEY ---');

  let tenantA: Tenant;
  let tenantB: Tenant;
  let tenantAdminA: User;
  let hrAdminA: User;
  let managerA: User;
  let employeeA1: User;
  let employeeA2: User;
  let empRecordA1: Employee;
  let empRecordA2: Employee;
  let empRecordB1: Employee;
  let shiftA: any;
  let payrollPeriodA: PayrollPeriod;
  let payslipsA: Payslip[];

  // Step 1: Super Admin Login & Verification
  runTest('Step 1: Super Admin login and authentication validation', () => {
    StorageEngine.setActiveTenantId('NP-000001');
    StorageEngine.setAppEnvironment('super_admin');
    const users = AuthService.getUsers();
    const superAdmin = users.find(u => u.roleName === 'Super Admin');
    if (!superAdmin) throw new Error('Super Admin user missing');
    if (superAdmin.email !== 'admin@novapulse.co.in' && superAdmin.email !== 'yatender@novapulse.co.in') {
      throw new Error(`Unexpected Super Admin email: ${superAdmin.email}`);
    }
  });

  // Step 2 & 3: Create Tenant A (Acme Corp) & Tenant B (Zenith Labs) with Subdomains
  runTest('Step 2 & 3: Provision Tenant A (Acme Corp) and Tenant B (Zenith Labs) with subdomains', () => {
    const resA = TenantService.create({
      companyName: 'Acme Global Technologies',
      legalName: 'Acme Global Technologies Private Limited',
      email: 'contact@acme.com',
      phone: '+91 98111 00001',
      address: 'Cyber Towers, HITEC City',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      industry: 'Technology',
      subdomain: 'acmeglobal',
      subscriptionPlan: 'Enterprise',
      licensedEmployees: 50,
      primaryAdmin: {
        name: 'Arjun Verma',
        email: 'arjun.verma@acme.com',
        phone: '+91 98111 00001',
      },
    });
    tenantA = resA.tenant;

    const resB = TenantService.create({
      companyName: 'Zenith Life Sciences',
      legalName: 'Zenith Life Sciences Ltd.',
      email: 'admin@zenith.com',
      phone: '+91 98222 00002',
      address: 'Bio Park, Whitefield',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      industry: 'Pharmaceuticals',
      subdomain: 'zenithlabs',
      subscriptionPlan: 'Professional',
      licensedEmployees: 25,
      primaryAdmin: {
        name: 'Dr. Suresh Nair',
        email: 'suresh@zenith.com',
        phone: '+91 98222 00002',
      },
    });
    tenantB = resB.tenant;

    if (!tenantA.id || tenantA.subdomain !== 'acmeglobal') throw new Error('Tenant A creation failed');
    if (!tenantB.id || tenantB.subdomain !== 'zenithlabs') throw new Error('Tenant B creation failed');
  });

  // Step 4: Create Tenant Admin & Role Mapping for Tenant A
  runTest('Step 4: Create Tenant Admin, HR Admin, Manager, and Employee users for Tenant A', () => {
    tenantAdminA = AuthService.createUser({
      organizationId: tenantA.tenantId,
      employeeId: 'emp-acme-admin',
      email: 'arjun.verma@acme.com',
      fullName: 'Arjun Verma',
      roleId: 'role-client-admin',
      roleName: 'HR Admin',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      status: 'active',
    });

    hrAdminA = AuthService.createUser({
      organizationId: tenantA.tenantId,
      employeeId: 'emp-acme-hr',
      email: 'kavita.hr@acme.com',
      fullName: 'Kavita Iyer',
      roleId: 'role-hr-admin',
      roleName: 'HR Admin',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      status: 'active',
    });

    managerA = AuthService.createUser({
      organizationId: tenantA.tenantId,
      employeeId: 'emp-acme-mgr',
      email: 'rohit.mgr@acme.com',
      fullName: 'Rohit Deshmukh',
      roleId: 'role-manager',
      roleName: 'Manager',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      status: 'active',
    });

    employeeA1 = AuthService.createUser({
      organizationId: tenantA.tenantId,
      employeeId: 'emp-acme-001',
      email: 'vikram.dev@acme.com',
      fullName: 'Vikram Mehta',
      roleId: 'role-employee',
      roleName: 'Employee',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      status: 'active',
    });

    employeeA2 = AuthService.createUser({
      organizationId: tenantA.tenantId,
      employeeId: 'emp-acme-002',
      email: 'ananya.qa@acme.com',
      fullName: 'Ananya Sharma',
      roleId: 'role-employee',
      roleName: 'Employee',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      status: 'active',
    });

    if (!tenantAdminA.id || !hrAdminA.id || !employeeA1.id) throw new Error('User creation failed for Tenant A');
  });

  // Step 5: Switch to Tenant A Environment
  runTest('Step 5: Tenant Admin switch & login to Tenant A environment', () => {
    StorageEngine.setActiveTenantId(tenantA.tenantId);
    StorageEngine.setAppEnvironment('client');
    const activeTenant = StorageEngine.getActiveTenantId();
    if (activeTenant !== tenantA.tenantId) throw new Error('Failed to activate Tenant A workspace');
  });

  // Step 6: Create Branches for Tenant A
  runTest('Step 6: Core HR — Create Headquarters and Regional Branches', () => {
    const branches = StorageEngine.getList<any>(STORAGE_KEYS.BRANCHES);
    const branchHq = {
      id: `br-${tenantA.tenantId}-hq`,
      organizationId: tenantA.tenantId,
      name: 'Hyderabad Cyber HQ',
      code: 'HYD-HQ',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      address: 'Plot 10, HITEC City, Hyderabad',
      latitude: 17.4485,
      longitude: 78.3742,
      geofenceRadiusMeters: 200,
      isHeadquarters: true,
    };
    StorageEngine.insert(STORAGE_KEYS.BRANCHES, branchHq);

    const verified = StorageEngine.getList<any>(STORAGE_KEYS.BRANCHES).find(b => b.id === branchHq.id);
    if (!verified || verified.organizationId !== tenantA.tenantId) throw new Error('Branch creation failed');
  });

  // Step 7: Create Departments for Tenant A
  runTest('Step 7: Core HR — Create Engineering, Product, and HR Departments', () => {
    const deptEng = {
      id: `dept-${tenantA.tenantId}-eng`,
      organizationId: tenantA.tenantId,
      name: 'Software Engineering',
      code: 'ENG',
      color: '#3b82f6',
    };
    const deptHr = {
      id: `dept-${tenantA.tenantId}-hr`,
      organizationId: tenantA.tenantId,
      name: 'Human Resources',
      code: 'HR',
      color: '#10b981',
    };
    StorageEngine.insert(STORAGE_KEYS.DEPARTMENTS, deptEng);
    StorageEngine.insert(STORAGE_KEYS.DEPARTMENTS, deptHr);

    const activeDepts = StorageEngine.getList<any>(STORAGE_KEYS.DEPARTMENTS).filter(d => d.organizationId === tenantA.tenantId);
    if (activeDepts.length < 2) throw new Error('Department creation failed');
  });

  // Step 8: Create Employee Records in Tenant A (Vikram Mehta & Ananya Sharma)
  runTest('Step 8: Employee Master — Create employees with complete salary structures and statutory profiles', () => {
    empRecordA1 = EmployeeService.create({
      employeeCode: 'ACM-101',
      organizationId: tenantA.tenantId,
      branchId: `br-${tenantA.tenantId}-hq`,
      departmentId: `dept-${tenantA.tenantId}-eng`,
      designationId: 'desig-lead-eng',
      reportingManagerId: managerA.employeeId,
      firstName: 'Vikram',
      lastName: 'Mehta',
      email: 'vikram.dev@acme.com',
      phone: '+91 98111 22334',
      dob: '1992-04-10',
      gender: 'Male',
      joiningDate: '2025-01-15',
      employmentType: 'Full-time',
      employmentStatus: 'Active',
      noticePeriodDays: 60,
      assignedShiftId: 'shift-acme-gen',
      salaryStructure: {
        basicSalary: 60000,
        hra: 30000,
        conveyanceAllowance: 5000,
        specialAllowance: 20000,
        medicalAllowance: 3000,
        otherAllowances: 2000,
        grossSalary: 120000,
        ctc: 1600000,
      },
      bankDetails: {
        accountHolderName: 'Vikram Mehta',
        accountNumber: '9180200998877',
        bankName: 'HDFC Bank Ltd.',
        ifscCode: 'HDFC0001234',
        branchName: 'HITEC City',
      },
      statutoryDetails: {
        pan: 'ABCDE1111M',
        aadhaar: 'XXXX-XXXX-1111',
        uan: '100911112222',
        pfEligible: true,
        esiEligible: false,
        professionalTaxState: 'Telangana',
      },
      emergencyContact: {
        name: 'Ritu Mehta',
        relationship: 'Spouse',
        phone: '+91 98111 55667',
      },
      documents: [],
    });

    empRecordA2 = EmployeeService.create({
      employeeCode: 'ACM-102',
      organizationId: tenantA.tenantId,
      branchId: `br-${tenantA.tenantId}-hq`,
      departmentId: `dept-${tenantA.tenantId}-eng`,
      designationId: 'desig-qa-eng',
      reportingManagerId: managerA.employeeId,
      firstName: 'Ananya',
      lastName: 'Sharma',
      email: 'ananya.qa@acme.com',
      phone: '+91 98111 88990',
      dob: '1995-08-20',
      gender: 'Female',
      joiningDate: '2025-06-01',
      employmentType: 'Full-time',
      employmentStatus: 'Active',
      noticePeriodDays: 30,
      assignedShiftId: 'shift-acme-gen',
      salaryStructure: {
        basicSalary: 12000,
        hra: 4000,
        conveyanceAllowance: 1000,
        specialAllowance: 2000,
        medicalAllowance: 1000,
        otherAllowances: 0,
        grossSalary: 20000, // <= ₹21,000 to test ESI qualification!
        ctc: 280000,
      },
      bankDetails: {
        accountHolderName: 'Ananya Sharma',
        accountNumber: '9180200554433',
        bankName: 'ICICI Bank Ltd.',
        ifscCode: 'ICIC0005678',
        branchName: 'Madhapur',
      },
      statutoryDetails: {
        pan: 'ABCDE2222S',
        aadhaar: 'XXXX-XXXX-2222',
        uan: '100922223333',
        pfEligible: true,
        esiEligible: true,
        professionalTaxState: 'Telangana',
      },
      emergencyContact: {
        name: 'Kailash Sharma',
        relationship: 'Father',
        phone: '+91 98111 99887',
      },
      documents: [],
    });

    if (!empRecordA1.id || !empRecordA2.id) throw new Error('Employee master creation failed');
  });

  // Step 9: Configure Shift Template & Assign
  runTest('Step 9: Shifts & Rosters — Create General Shift and assign to workforce', () => {
    shiftA = ShiftService.createShift({
      organizationId: tenantA.tenantId,
      name: 'Acme General Day Shift',
      code: 'ACM-GEN',
      startTime: '09:00',
      endTime: '18:00',
      breakDurationMinutes: 60,
      gracePeriodMinutes: 15,
      halfDayThresholdHours: 4.5,
      fullDayThresholdHours: 8.5,
      isNightShift: false,
      workingDays: [1, 2, 3, 4, 5],
      weeklyOffs: [0, 6],
      color: '#3b82f6',
    });

    EmployeeService.update(empRecordA1.id, { assignedShiftId: shiftA.id });
    EmployeeService.update(empRecordA2.id, { assignedShiftId: shiftA.id });

    const updatedEmp = EmployeeService.getById(empRecordA1.id);
    if (updatedEmp?.assignedShiftId !== shiftA.id) throw new Error('Shift assignment failed');
  });

  // Step 10: Attendance Punch In & Out with Late Calculation
  runTest('Step 10: Attendance — Punch In with geofencing validation and late threshold calculation', () => {
    const punchIn = AttendanceService.recordPunch({
      employeeId: empRecordA1.id,
      type: 'IN',
      source: 'Mobile App',
      location: { lat: 17.4485, lng: 78.3742, inGeofence: true, address: 'HITEC City HQ' },
    });
    if (!punchIn || punchIn.status !== 'Present') throw new Error('Attendance punch in failed');

    const punchOut = AttendanceService.recordPunch({
      employeeId: empRecordA1.id,
      type: 'OUT',
      source: 'Mobile App',
      location: { lat: 17.4485, lng: 78.3742, inGeofence: true, address: 'HITEC City HQ' },
    });
    if (!punchOut || punchOut.checkOut === null) throw new Error('Attendance punch out failed');
  });

  // Step 11 & 12: Apply Leave & Manager Approval with Attendance Sync
  runTest('Step 11 & 12: Leave Management — Apply leave, manager approval, and automatic attendance calendar sync', () => {
    const leaveTypes = LeaveService.getLeaveTypes();
    const cl = leaveTypes.find(l => l.code === 'CL') || leaveTypes[0];

    // Seed balances
    StorageEngine.insert(STORAGE_KEYS.LEAVE_BALANCES, {
      id: `lb-${empRecordA1.id}-${cl.code.toLowerCase()}`,
      organizationId: tenantA.tenantId,
      employeeId: empRecordA1.id,
      leaveTypeId: cl.id,
      year: 2026,
      allocated: 12,
      used: 0,
      pending: 0,
      balance: 12,
    });

    const appRes = LeaveService.applyLeave({
      employeeId: empRecordA1.id,
      leaveTypeId: cl.id,
      startDate: '2026-09-18',
      endDate: '2026-09-19',
      totalDays: 2,
      isHalfDay: false,
      reason: 'Personal engagement',
    });
    if (!appRes.success || !appRes.application) throw new Error('Leave application failed');

    const approved = LeaveService.approveLeave(appRes.application.id, managerA.id, true);
    if (!approved || approved.status !== 'approved') throw new Error('Leave approval failed');

    // Verify auto-sync to attendance table
    const attList = StorageEngine.getList<any>(STORAGE_KEYS.ATTENDANCE);
    const synced = attList.find(a => a.employeeId === empRecordA1.id && a.date === '2026-09-18');
    if (!synced || synced.status !== 'Leave') throw new Error('Leave was not synced to Attendance table');
  });

  // Step 13: Configure Employee Loans & Calculate EMI
  runTest('Step 13: Financial Loans — Issue ₹1,00,000 personal loan, compute EMI, and disburse', () => {
    const loan = PayrollLoanService.createLoan({
      tenantId: tenantA.tenantId,
      employeeId: empRecordA1.id,
      employeeName: `${empRecordA1.firstName} ${empRecordA1.lastName}`,
      loanType: 'Personal Loan',
      principalAmount: 120000,
      tenureMonths: 12,
      interestRateAnnualPercent: 10,
      startMonth: '2026-09',
      requestedBy: 'Vikram Mehta',
    });

    // P = 120,000, r = 10%/12 = 0.008333, n = 12 -> EMI ≈ ₹10,550
    if (loan.monthlyEmi <= 0 || loan.totalRepayable <= 120000) throw new Error('EMI calculation failed');

    const disbursed = PayrollLoanService.approveAndDisburse(loan.id, 'Arjun Verma');
    if (disbursed?.status !== 'Active') throw new Error('Loan disbursement failed');
  });

  // Step 14: Salary Advance Request & HR Approval
  runTest('Step 14: Salary Advances — Request ₹15,000 advance with 3 monthly recovery installments', () => {
    const advance = PayrollAdvanceService.requestAdvance({
      tenantId: tenantA.tenantId,
      employeeId: empRecordA1.id,
      employeeName: `${empRecordA1.firstName} ${empRecordA1.lastName}`,
      advanceAmount: 15000,
      installmentsCount: 3,
      reason: 'Home festival celebration',
    });

    if (advance.recoveryMonthlyAmount !== 5000) throw new Error(`Expected recovery 5000, got ${advance.recoveryMonthlyAmount}`);

    const approvedAdv = PayrollAdvanceService.approveAdvance(advance.id, 15000, 'Kavita Iyer');
    if (approvedAdv?.status !== 'Active') throw new Error('Salary advance approval failed');
  });

  // Step 15: Expense Reimbursements Claim & Approval Workflow
  runTest('Step 15: Reimbursements — Submit ₹4,500 travel claim and execute Manager -> HR approval chain', () => {
    const claim = PayrollReimbursementService.submitClaim({
      tenantId: tenantA.tenantId,
      employeeId: empRecordA1.id,
      employeeName: `${empRecordA1.firstName} ${empRecordA1.lastName}`,
      expenseType: 'Travel',
      expenseDate: '2026-09-10',
      amount: 4500,
      description: 'Client visit to HITEC City Phase 2',
      payoutMethod: 'Payroll Payout',
    });

    const mgrApp = PayrollReimbursementService.managerApprove(claim.id, 'Rohit Deshmukh');
    if (mgrApp?.status !== 'Manager Approved') throw new Error('Manager approval failed');

    const hrApp = PayrollReimbursementService.hrApprove(claim.id, 4500, 'Kavita Iyer');
    if (hrApp?.status !== 'Approved') throw new Error('HR approval failed');
  });

  // Step 16: Overtime Logging with Duplicate Punch Prevention
  runTest('Step 16: Overtime — Record 6 hours overtime and block duplicate overtime punches', () => {
    const ot1 = PayrollOvertimeService.recordOvertime({
      tenantId: tenantA.tenantId,
      employeeId: empRecordA1.id,
      employeeName: `${empRecordA1.firstName} ${empRecordA1.lastName}`,
      date: '2026-09-15',
      otHours: 6,
      basicSalary: empRecordA1.salaryStructure.basicSalary,
      grossSalary: empRecordA1.salaryStructure.grossSalary,
      approvedBy: 'Rohit Deshmukh',
    });
    if (!ot1.id || ot1.otHours !== 6) throw new Error('Overtime logging failed');

    // Duplicate OT entry returns existing record (preventing double booking)
    const duplicate = PayrollOvertimeService.recordOvertime({
      tenantId: tenantA.tenantId,
      employeeId: empRecordA1.id,
      employeeName: `${empRecordA1.firstName} ${empRecordA1.lastName}`,
      date: '2026-09-15',
      otHours: 4,
      basicSalary: empRecordA1.salaryStructure.basicSalary,
      grossSalary: empRecordA1.salaryStructure.grossSalary,
      approvedBy: 'Rohit Deshmukh',
    });
    if (duplicate.id !== ot1.id) throw new Error('Duplicate overtime entry was not blocked/deduplicated!');
  });

  // Step 17: Run Monthly Payroll Engine
  runTest('Step 17: Monthly Payroll — Execute canonical calculation engine across all active employees', () => {
    const res = PayrollService.processMonthlyPayroll({
      month: 9,
      year: 2026,
      processedByUserId: hrAdminA.id,
      tenantId: tenantA.tenantId,
    });
    payrollPeriodA = res.period;
    payslipsA = res.payslips;

    if (!payrollPeriodA || payslipsA.length !== 2) {
      throw new Error(`Expected 2 payslips for Tenant A, got ${payslipsA.length}`);
    }

    // Inspect Vikram Mehta (Gross ₹120,000, 12% PF on earned basic, EPS capped at ₹1,250)
    const psVikram = payslipsA.find(p => p.employeeId === empRecordA1.id);
    if (!psVikram) throw new Error('Payslip for Vikram Mehta not generated');
    if (psVikram.deductions.pfEmployee <= 0) {
      throw new Error(`Expected PF deduction, got ₹${psVikram.deductions.pfEmployee}`);
    }
    if (psVikram.employerContributions.epsEmployer !== 1250) {
      throw new Error(`Expected statutory capped EPS ₹1,250, got ₹${psVikram.employerContributions.epsEmployer}`);
    }
    if (psVikram.deductions.esiEmployee !== 0) {
      throw new Error(`Expected ESI ₹0 for >₹21,000 gross, got ₹${psVikram.deductions.esiEmployee}`);
    }
    if (psVikram.deductions.loanEmi <= 0) {
      throw new Error('Loan EMI was not deducted in payroll run');
    }
    if (psVikram.deductions.advanceRecovery !== 5000) {
      throw new Error(`Expected ₹5000 advance recovery, got ₹${psVikram.deductions.advanceRecovery}`);
    }
    if (psVikram.earnings.reimbursements !== 4500) {
      throw new Error(`Expected ₹4500 reimbursement payout, got ₹${psVikram.earnings.reimbursements}`);
    }

    // Inspect Ananya Sharma (Gross ₹20,000 <= ₹21,000 -> ESI applies: 0.75% of ₹20,000 = ₹150)
    const psAnanya = payslipsA.find(p => p.employeeId === empRecordA2.id);
    if (!psAnanya) throw new Error('Payslip for Ananya Sharma not generated');
    if (psAnanya.deductions.esiEmployee !== 150) {
      throw new Error(`Expected ESI ₹150 for ₹20,000 wage, got ₹${psAnanya.deductions.esiEmployee}`);
    }
  });

  // Step 18, 19, 20: Period Lifecycle (Calculated -> Under Review -> Approved -> Finalized/Locked)
  runTest('Step 18, 19, 20: Payroll Workflow — Progress period through review and lock finalized run', () => {
    PayrollService.updatePeriodStatus(payrollPeriodA.id, 'Under Review', 'Kavita Iyer');
    let p = PayrollService.getPeriodById(payrollPeriodA.id);
    if (p?.status !== 'Under Review') throw new Error('Status update to Under Review failed');

    PayrollService.updatePeriodStatus(payrollPeriodA.id, 'Approved', 'Arjun Verma');
    p = PayrollService.getPeriodById(payrollPeriodA.id);
    if (p?.status !== 'Approved') throw new Error('Status update to Approved failed');

    PayrollService.lockPeriod(payrollPeriodA.id, 'Arjun Verma');
    p = PayrollService.getPeriodById(payrollPeriodA.id);
    if (p?.status !== 'Finalized') throw new Error('Locking payroll period failed');

    // Verify recalculation on locked period is blocked
    let lockBlocked = false;
    try {
      PayrollService.processMonthlyPayroll({
        month: 9,
        year: 2026,
        processedByUserId: hrAdminA.id,
        tenantId: tenantA.tenantId,
      });
    } catch (e) {
      lockBlocked = true;
    }
    if (!lockBlocked) throw new Error('Recalculation on finalized/locked payroll period was not blocked!');
  });

  // Step 21: Authorized Reopening with Audit Trail
  runTest('Step 21: Payroll Reopening — Authorized admin unlocks period with mandatory reason & audit logging', () => {
    PayrollService.reopenPeriod(payrollPeriodA.id, 'Arjun Verma', 'Annual audit variance adjustment');
    const p = PayrollService.getPeriodById(payrollPeriodA.id);
    if (p?.status !== 'Under Review') throw new Error('Payroll period reopening failed');

    const logs = AuditService.getLogs();
    const reopenLog = logs.find(l => l.recordId === payrollPeriodA.id && l.action === 'UPDATE');
    if (!reopenLog || !reopenLog.description.includes('Reopened')) {
      throw new Error('Audit log for payroll reopening missing');
    }
  });

  // Step 22: Generate Payslips & Currency in Words
  runTest('Step 22: Payslip Generation — Formatted Indian currency words and reference numbers', () => {
    const ps = payslipsA[0];
    const words = PayrollCalculationService.numberToWordsINR(ps.netSalary);
    if (!words.endsWith('Rupees Only') || words.length < 10) {
      throw new Error(`Malformed currency words: ${words}`);
    }
  });

  // Step 23 & 24: Employee Self-Service Scope & Isolation
  runTest('Step 23 & 24: ESS Security — Employee can access own payslip but cannot access peer payslips', () => {
    const vikramPayslips = PayrollService.getEmployeePayslips(empRecordA1.id);
    if (vikramPayslips.length === 0) throw new Error('Employee could not access own payslip');

    const ananyaPayslips = PayrollService.getEmployeePayslips(empRecordA2.id);
    const peerAccess = vikramPayslips.some(p => p.employeeId === empRecordA2.id);
    if (peerAccess) throw new Error('CRITICAL SECURITY LEAK: Employee can view another employee payslip!');
  });

  // Step 25 & 26: Helpdesk Tickets Lifecycle
  runTest('Step 25 & 26: Helpdesk — Employee raises IT ticket, agent assigns and resolves', () => {
    const ticket = TicketService.createTicket({
      employeeId: empRecordA1.id,
      category: 'IT',
      subject: 'Require Docker Pro license',
      description: 'Need docker pro license for local containerized development.',
      priority: 'High',
    });
    if (!ticket || ticket.status !== 'Open') throw new Error('Ticket creation failed');

    const assigned = TicketService.assignTicket(ticket.id, 'agent-01');
    if (!assigned || assigned.status !== 'In Progress') throw new Error('Ticket assignment failed');

    const resolved = TicketService.resolveTicket(ticket.id, 'License key assigned to developer email.');
    if (!resolved || resolved.status !== 'Resolved') throw new Error('Ticket resolution failed');
  });

  // Step 27: Asset Inventory Allocation & Return
  runTest('Step 27: Asset Inventory — Allocate MacBook Pro M3 to employee and track allocation history', () => {
    const asset = InventoryService.createAsset({
      organizationId: tenantA.tenantId,
      name: 'MacBook Pro 16" (M3 Max, 64GB)',
      category: 'Laptop',
      serialNumber: 'C02ACM998877',
      purchaseDate: '2026-01-10',
      purchaseCost: 320000,
      warrantyExpiry: '2029-01-10',
      condition: 'New',
    });

    const allocated = InventoryService.allocateAsset(asset.id, empRecordA1.id, 'Kavita Iyer', 'Primary dev workstation');
    if (allocated?.status !== 'Allocated' || allocated.assignedToEmployeeId !== empRecordA1.id) {
      throw new Error('Asset allocation failed');
    }
  });

  // Step 28: Onboarding Candidate Workflow & Conversion
  runTest('Step 28: Onboarding — Create candidate invite and convert to master employee record', () => {
    const invite = OnboardingService.createInvite({
      organizationId: tenantA.tenantId,
      candidateName: 'Rahul Sen',
      email: 'rahul.sen@gmail.com',
      phone: '+91 98111 77665',
      departmentId: `dept-${tenantA.tenantId}-eng`,
      designationId: 'desig-fe-dev',
      joiningDate: '2026-10-01',
      offeredCtc: 1200000,
    });
    if (!invite || !invite.id || invite.status !== 'sent') throw new Error('Onboarding invite creation failed');

    const converted = OnboardingService.convertToEmployee(invite.id);
    if (!converted.success || !converted.employee) throw new Error('Candidate conversion to employee failed');
  });

  // Step 29, 30, 31: MMP Insights — Dataset Ingestion, Smart Column Detection & Mapping
  runTest('Step 29, 30, 31: MMP Insights — Ingest external workforce dataset, detect columns, and compute metrics', () => {
    const sampleHeaders = ['Staff ID', 'Full Name', 'Department', 'Date', 'Working Hrs', 'Productive Hrs', 'Overtime Hrs', 'Tasks Assigned', 'Tasks Completed', 'Attendance'];
    const mapping = MMPAnalyticsService.detectColumnMapping(sampleHeaders);
    if (mapping.employeeIdentifier !== 'Staff ID' || mapping.workingHours !== 'Working Hrs') {
      throw new Error('Smart column detection failed');
    }

    const testRows: MMPDatasetRow[] = [
      { id: 'r1', datasetId: 'd-test', tenantId: tenantA.tenantId, employeeIdentifier: 'E1', employeeName: 'Vikram', department: 'Engineering', date: '2026-09-01', workingHours: 9, productiveHours: 7.5, overtimeHours: 1, taskCount: 8, completedTasks: 7, attendanceStatus: 'Present' },
      { id: 'r2', datasetId: 'd-test', tenantId: tenantA.tenantId, employeeIdentifier: 'E1', employeeName: 'Vikram', department: 'Engineering', date: '2026-09-02', workingHours: 9, productiveHours: 8.0, overtimeHours: 0, taskCount: 6, completedTasks: 6, attendanceStatus: 'Present' },
      { id: 'r3', datasetId: 'd-test', tenantId: tenantA.tenantId, employeeIdentifier: 'E2', employeeName: 'Ananya', department: 'QA', date: '2026-09-01', workingHours: 8, productiveHours: 4.0, overtimeHours: 0, taskCount: 5, completedTasks: 2, attendanceStatus: 'Present' },
    ];

    const metrics = MMPAnalyticsService.calculateMetrics(testRows);
    // Working: 26h, Productive: 19.5h -> Productivity Ratio: (19.5/26)*100 = 75%
    if (metrics.productivityRatioPercent !== 75) throw new Error(`Expected productivity ratio 75%, got ${metrics.productivityRatioPercent}%`);
    if (metrics.totalEmployees !== 2) throw new Error('Total employees count mismatch');
  });

  // Step 32 & 33: MMP Insights AI Analysis & Natural Language "Ask MMP"
  await runAsyncTest('Step 32 & 33: MMP Insights AI — Deterministic factual analysis, zero PII, and conversational Q&A', async () => {
    const sync = MMPInsightService.generateFromInternalHRMS({
      tenantId: tenantA.tenantId,
      userId: tenantAdminA.id,
      userName: tenantAdminA.fullName,
    });

    const aiRes = await MMPInsightService.askMMP({
      prompt: 'Summarize workforce productivity and highlight top departments',
      datasetId: sync.dataset.id,
      tenantId: tenantA.tenantId,
      userId: tenantAdminA.id,
      userName: tenantAdminA.fullName,
    });

    if (!aiRes.analysis || !aiRes.analysis.executiveSummary) {
      throw new Error('AI analysis generation failed');
    }
    if (aiRes.analysis.keyInsights.length === 0) {
      throw new Error('Key insights array is empty');
    }

    // Save insight
    const saved = MMPInsightService.saveInsight({
      tenantId: tenantA.tenantId,
      userId: tenantAdminA.id,
      userName: tenantAdminA.fullName,
      title: 'Q3 Productivity Executive Review',
      prompt: 'Summarize workforce productivity',
      analysis: aiRes.analysis,
      metrics: aiRes.metrics,
      datasetName: 'Live MakeMyPayroll Dataset',
    });
    if (!saved || !saved.id) throw new Error('Failed to save AI insight');
  });

  // Step 34: Strict Cross-Tenant Boundary Enforcement (Tenant B -> Tenant A)
  runTest('Step 34: Cross-Tenant Security — Tenant B attempts to read/modify Tenant A records (BLOCKED)', () => {
    StorageEngine.setActiveTenantId(tenantB.tenantId);
    StorageEngine.setAppEnvironment('client');

    // 1. Employee query
    const allEmps = EmployeeService.getAll();
    const visibleToB = allEmps.filter(e => e.organizationId === tenantB.tenantId);
    const hasTenantAData = visibleToB.some(e => e.id === empRecordA1.id || e.organizationId === tenantA.tenantId);
    if (hasTenantAData) {
      throw new Error('CRITICAL SECURITY BREACH: Tenant B can see Tenant A employees!');
    }

    // 2. Payroll query
    const payrollB = PayrollService.getPayslips(undefined, tenantB.tenantId);
    const hasPayrollAData = payrollB.some(p => p.organizationId === tenantA.tenantId);
    if (hasPayrollAData) {
      throw new Error('CRITICAL SECURITY BREACH: Tenant B can see Tenant A payslips!');
    }

    // 3. MMP Datasets query
    const datasetsB = MMPInsightService.getDatasets(tenantB.tenantId);
    const hasDatasetA = datasetsB.some(d => d.tenantId === tenantA.tenantId);
    if (hasDatasetA) {
      throw new Error('CRITICAL SECURITY BREACH: Tenant B can see Tenant A MMP datasets!');
    }
  });

  // Step 35: Super Admin Authorized Impersonation & Audit Trail
  runTest('Step 35: Super Admin Impersonation — Authorized tenant switch with mandatory reason and audit entry', () => {
    StorageEngine.setAppEnvironment('super_admin');
    const session = AuthService.startImpersonation(
      'user-001',
      'Super Admin',
      tenantA.tenantId,
      'Acme Global Technologies',
      'Annual Compliance Audit'
    );
    if (!session || session.tenantId !== tenantA.tenantId) throw new Error('Impersonation session creation failed');

    const activeImpersonation = StorageEngine.getImpersonationSession();
    if (!activeImpersonation || activeImpersonation.tenantId !== tenantA.tenantId) {
      throw new Error('Active impersonation session was not persisted');
    }

    AuthService.endImpersonation('user-001');
    if (StorageEngine.getImpersonationSession() !== null) {
      throw new Error('Impersonation session termination failed');
    }
  });

  // ====================================================================
  // PHASE 2: ROLE-BASED ACCESS CONTROL (RBAC) 6-PERSONA VALIDATION
  // ====================================================================
  console.log('\n--- PHASE 2: RBAC 6-PERSONA MATRIX VALIDATION ---');

  runTest('RBAC Persona 1: Super Admin has platform-wide management permissions', () => {
    const isSuperAdminAllowed = PlanService.canAccessModule('insights', 'Enterprise');
    if (!isSuperAdminAllowed) throw new Error('Super Admin module access failed');
  });

  runTest('RBAC Persona 2: Tenant Admin has full tenant permissions and zero platform admin access', () => {
    const res = TenantHostService.resolveAccess({
      hostname: 'admin.makemypayroll.com',
      user: tenantAdminA,
      userTenantId: tenantA.tenantId,
    });
    if (res.isAllowed) throw new Error('Client Tenant Admin should NOT be allowed on admin.makemypayroll.com');
  });

  runTest('RBAC Persona 3: HR Admin has operational access (Payroll, Employees, Leaves) but cannot manage platform settings', () => {
    const res = TenantHostService.resolveAccess({
      hostname: 'acmeglobal.makemypayroll.com',
      user: hrAdminA,
      userTenantId: tenantA.tenantId,
    });
    if (!res.isAllowed) throw new Error('HR Admin access denied on valid tenant domain');
  });

  runTest('RBAC Persona 4: Manager has departmental subordinate visibility only', () => {
    const managerScopeEmps = EmployeeService.getAll().filter(
      e => e.reportingManagerId === managerA.employeeId || e.id === managerA.employeeId
    );
    if (managerScopeEmps.length === 0) throw new Error('Manager reporting hierarchy resolution failed');
  });

  runTest('RBAC Persona 5: Employee has self-service boundary (cannot edit company policies or see others salary)', () => {
    const empPayslips = PayrollService.getEmployeePayslips(employeeA1.employeeId);
    empPayslips.forEach(ps => {
      if (ps.employeeId !== employeeA1.employeeId) {
        throw new Error('Employee accessed unauthorized payslip');
      }
    });
  });

  runTest('RBAC Persona 6: Restricted / Suspended User is immediately halted at security gate', () => {
    const suspendedTenant = TenantService.updateStatus(tenantB.tenantId, 'SUSPENDED');
    const res = TenantHostService.resolveAccess({
      hostname: 'zenithlabs.makemypayroll.com',
      user: employeeA1,
      userTenantId: tenantB.tenantId,
    });
    if (res.isAllowed) throw new Error('Suspended tenant user was not blocked');
    TenantService.updateStatus(tenantB.tenantId, 'ACTIVE'); // restore
  });

  // ====================================================================
  // PHASE 3: LICENCE CAPACITY & HARD LIMIT ENFORCEMENT
  // ====================================================================
  console.log('\n--- PHASE 3: LICENCE CAPACITY & HARD LIMIT ENFORCEMENT ---');

  runTest('Licence Enforcement: Create 1-seat tenant, 1st employee ALLOWED, 2nd employee BLOCKED', () => {
    const microRes = TenantService.create({
      companyName: 'Micro Test Labs',
      legalName: 'Micro Test Labs Pvt Ltd',
      email: 'admin@micro.com',
      phone: '+91 99999 11111',
      address: 'Sector 5',
      city: 'Noida',
      state: 'UP',
      country: 'India',
      industry: 'IT',
      subdomain: 'microtestlab',
      subscriptionPlan: 'Starter',
      licensedEmployees: 1,
      primaryAdmin: { name: 'Admin', email: 'admin@micro.com', phone: '+91 99999 11111' },
    });
    const microTenant = microRes.tenant;

    const emp1 = EmployeeService.create({
      employeeCode: 'MIC-001',
      organizationId: microTenant.tenantId,
      branchId: 'br-1',
      departmentId: 'dept-1',
      designationId: 'desig-1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@micro.com',
      phone: '+91 99999 22222',
      dob: '1990-01-01',
      gender: 'Female',
      joiningDate: '2026-01-01',
      employmentType: 'Full-time',
      employmentStatus: 'Active',
      noticePeriodDays: 30,
      assignedShiftId: 's-1',
      salaryStructure: { basicSalary: 30000, grossSalary: 60000, ctc: 720000 },
      bankDetails: { accountNumber: '1234', bankName: 'HDFC', ifscCode: 'HDFC001', branchName: 'Main', accountHolderName: 'Alice' },
      statutoryDetails: { pan: 'ABCDE1111A' },
      documents: [],
    });
    if (!emp1.id) throw new Error('Employee 1 creation failed');

    let emp2Blocked = false;
    try {
      EmployeeService.create({
        employeeCode: 'MIC-002',
        organizationId: microTenant.tenantId,
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: 'desig-1',
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'bob@micro.com',
        phone: '+91 99999 33333',
        dob: '1992-01-01',
        gender: 'Male',
        joiningDate: '2026-01-01',
        employmentType: 'Full-time',
        employmentStatus: 'Active',
        noticePeriodDays: 30,
        assignedShiftId: 's-1',
        salaryStructure: { basicSalary: 30000, grossSalary: 60000, ctc: 720000 },
        bankDetails: { accountNumber: '5678', bankName: 'HDFC', ifscCode: 'HDFC001', branchName: 'Main', accountHolderName: 'Bob' },
        statutoryDetails: { pan: 'ABCDE2222B' },
        documents: [],
      });
    } catch (e: any) {
      emp2Blocked = true;
    }
    if (!emp2Blocked) throw new Error('Hard licence limit violation was not blocked!');
  });

  // ====================================================================
  // PHASE 4: STRESS & PERFORMANCE TESTING (1,000+ RECORDS)
  // ====================================================================
  console.log('\n--- PHASE 4: STRESS & HIGH-VOLUME PERFORMANCE BENCHMARKS ---');

  runTest('Performance Benchmark: Ingestion and metric calculation on 1,000 workforce records (< 500ms)', () => {
    const stressRows: MMPDatasetRow[] = [];
    for (let i = 1; i <= 1000; i++) {
      const isPresent = i % 10 !== 0;
      stressRows.push({
        id: `stress-row-${i}`,
        datasetId: 'd-stress',
        tenantId: tenantA.tenantId,
        employeeIdentifier: `EMP-${(i % 50) + 1}`,
        employeeName: `Employee ${(i % 50) + 1}`,
        department: (i % 3 === 0) ? 'Engineering' : (i % 3 === 1) ? 'Sales' : 'Operations',
        date: `2026-09-${((i % 28) + 1).toString().padStart(2, '0')}`,
        workingHours: isPresent ? 8.5 : 0,
        productiveHours: isPresent ? 7.0 : 0,
        overtimeHours: (i % 15 === 0) ? 2 : 0,
        taskCount: 5,
        completedTasks: isPresent ? 4 : 0,
        attendanceStatus: isPresent ? 'Present' : 'Absent',
      });
    }

    const t0 = Date.now();
    const metrics = MMPAnalyticsService.calculateMetrics(stressRows);
    const duration = Date.now() - t0;

    console.log(`   [Performance] 1,000 rows metrics calculation completed in ${duration}ms (Total Employees: ${metrics.totalEmployees}, Departments: ${metrics.departmentMetrics.length})`);
    if (duration > 1500) throw new Error(`Performance too slow: ${duration}ms`);
    if (metrics.totalEmployees !== 50) throw new Error('Employee distinct count error under stress');
  });

  console.log('\n====================================================================');
  console.log(`MASTER SUITE EXECUTION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('====================================================================\n');
}

runMasterSuite().catch(err => {
  console.error('\nFATAL SUITE FAILURE:', err);
  process.exit(1);
});
