// ====================================================================
// Automated Test Suite for Payroll Configuration (Cycles, Attendance Policies, & Calculation)
// ====================================================================

import { StorageEngine } from '../database/storageEngine';
import { PayrollCycleService } from '../services/payroll/payrollCycleService';
import { AttendancePolicyService } from '../services/payroll/attendancePolicyService';
import { PayrollCalculationService } from '../services/payroll/payrollCalculationService';
import { EmployeeService } from '../services/employeeService';
import { HolidayPayrollService } from '../services/payroll/holidayPayrollService';
import { PayrollOvertimeConfigService } from '../services/payroll/payrollOvertimeConfigService';
import { SalaryComponentService } from '../services/payroll/salaryComponentService';
import { DeductionPolicyService } from '../services/payroll/deductionPolicyService';
import { PayrollCycle, AttendancePolicy, Attendance, Employee } from '../database/schema';

export function runPayrollConfigurationTestSuite(): {
  passed: number;
  failed: number;
  results: { name: string; success: boolean; details?: string }[];
} {
  const results: { name: string; success: boolean; details?: string }[] = [];
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      results.push({ name, success: true, details });
      console.log(`[PASS] ${name}`);
    } else {
      failed++;
      results.push({ name, success: false, details });
      console.error(`[FAIL] ${name}: ${details || 'Assertion failed'}`);
    }
  }

  console.log('=== STARTING PAYROLL CONFIGURATION TEST SUITE ===');

  const tenantId = 'NP-000001';
  StorageEngine.setActiveTenantId(tenantId);

  // -------------------------------------------------------------
  // TEST 1: Seed Cycles and Default Cycle Presence
  // -------------------------------------------------------------
  try {
    const cycles = PayrollCycleService.getAll(tenantId);
    assert(
      'Initial seed payroll cycles exist',
      cycles.length >= 3,
      `Found ${cycles.length} cycles`
    );

    const defaultCycle = PayrollCycleService.getDefaultCycle(tenantId);
    assert(
      'Default payroll cycle is resolved',
      !!defaultCycle && defaultCycle.startDay === 1 && defaultCycle.endDay === 31,
      `Default cycle: ${defaultCycle?.name}`
    );
  } catch (err: any) {
    assert('Initial seed payroll cycles exist', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Dynamic Period Date Calculation (Standard, Cross-Month, Leap Year, Year Boundary)
  // -------------------------------------------------------------
  try {
    // Standard Calendar Month (1st to 31st)
    const stdCycle: PayrollCycle = {
      id: 'test-std',
      organizationId: tenantId,
      name: 'Standard Monthly (1st to 31st)',
      startDay: 1,
      endDay: 31,
      status: 'Active',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sept2026 = PayrollCycleService.calculatePeriodDates(stdCycle, 2026, 9);
    assert(
      'Standard Cycle Sept 2026 date bounds (1st - 30th)',
      sept2026.startDate === '2026-09-01' && sept2026.endDate === '2026-09-30' && sept2026.totalDays === 30,
      `Result: ${sept2026.startDate} to ${sept2026.endDate} (${sept2026.totalDays} days)`
    );

    // Cross-Month Mid-Month (20th to 19th)
    const midCycle: PayrollCycle = {
      id: 'test-mid',
      organizationId: tenantId,
      name: '20th to 19th Cut-off',
      startDay: 20,
      endDay: 19,
      status: 'Active',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const oct2026Mid = PayrollCycleService.calculatePeriodDates(midCycle, 2026, 10);
    assert(
      'Mid-month Cycle Oct 2026 bounds (2026-09-20 to 2026-10-19)',
      oct2026Mid.startDate === '2026-09-20' && oct2026Mid.endDate === '2026-10-19',
      `Result: ${oct2026Mid.startDate} to ${oct2026Mid.endDate} (${oct2026Mid.totalDays} days)`
    );

    // Year Boundary Transition (Jan 2026 for 26th to 25th -> 2025-12-26 to 2026-01-25)
    const prevMonthCycle: PayrollCycle = {
      id: 'test-26',
      organizationId: tenantId,
      name: '26th to 25th Cut-off',
      startDay: 26,
      endDay: 25,
      status: 'Active',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const jan2026Cross = PayrollCycleService.calculatePeriodDates(prevMonthCycle, 2026, 1);
    assert(
      'Year boundary cross-month calculation (2025-12-26 to 2026-01-25)',
      jan2026Cross.startDate === '2025-12-26' && jan2026Cross.endDate === '2026-01-25',
      `Result: ${jan2026Cross.startDate} to ${jan2026Cross.endDate}`
    );

    // Leap Year Calculation for February (Feb 2024 = 29 days, Feb 2026 = 28 days)
    const feb2024 = PayrollCycleService.calculatePeriodDates(stdCycle, 2024, 2);
    const feb2026 = PayrollCycleService.calculatePeriodDates(stdCycle, 2026, 2);
    assert(
      'Leap year Feb 2024 = 29 days, Feb 2026 = 28 days',
      feb2024.endDate === '2024-02-29' && feb2024.totalDays === 29 &&
      feb2026.endDate === '2026-02-28' && feb2026.totalDays === 28,
      `Feb 2024: ${feb2024.totalDays}d, Feb 2026: ${feb2026.totalDays}d`
    );
  } catch (err: any) {
    assert('Dynamic Period Date Calculation', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Attendance Policy CRUD & Evaluation
  // -------------------------------------------------------------
  try {
    const policies = AttendancePolicyService.getAll(tenantId);
    assert(
      'Initial seed attendance policies exist',
      policies.length >= 3,
      `Found ${policies.length} policies`
    );

    const defaultPolicy = AttendancePolicyService.getDefaultPolicy(tenantId);
    assert(
      'Default attendance policy is resolved',
      !!defaultPolicy && defaultPolicy.fullDayHours === 8 && defaultPolicy.halfDayHours === 4,
      `Default policy: ${defaultPolicy?.name}`
    );

    // Create a custom strict attendance policy
    const newPolicy = AttendancePolicyService.create({
      organizationId: tenantId,
      name: 'Strict 9h Operations Policy',
      description: 'Strict policy for operations with half-day late deduction',
      fullDayHours: 9,
      halfDayHours: 4.5,
      fullDayCreditToleranceMinutes: 10,
      minimumOtHoursDaily: 0.5,
      otPunchGapSeconds: 60,
      maxLeaveCarryoverDays: 10,
      enableOvertime: true,
      overtimePayScale: 2.0,
      countOutsideShiftHours: true,
      salesProductivityAttendance: false,
      otDetectionEnabled: true,
      otDetectionMode: 'after_shift',
      otWindowMinutes: 30,
      dailyLateAllowanceMinutes: 10,
      lateComingGraceMinutes: 10,
      maxMonthlyLatenessAllowed: 2,
      latePenaltyType: 'HalfDay',
      latePenaltyValue: 0.5,
      fullDayCreditLogic: 'inside_shift_only',
      isDefault: false,
      status: 'Active',
    });

    assert(
      'Custom Attendance Policy created successfully',
      !!newPolicy.id && newPolicy.latePenaltyType === 'HalfDay' && newPolicy.overtimePayScale === 2.0,
      `Created policy ID: ${newPolicy.id}`
    );

    // Test Attendance Policy Evaluation
    const mockAttendance: Attendance[] = [
      // Day 1: Full day 9.5 hours (9.0 + 0.5h OT = 30 min overtime)
      {
        id: 'att-test-1',
        organizationId: tenantId,
        employeeId: 'test-emp',
        date: '2026-09-01',
        shiftId: 'shift-001',
        checkIn: '09:00:00',
        checkOut: '18:30:00',
        workDurationMinutes: 570,
        workHours: 9.5,
        lateMinutes: 0,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 30,
        status: 'Present',
        isRegularized: false,
        punchSource: 'Web Portal',
      },
      // Day 2: Half day 5 hours (>= 4.5h)
      {
        id: 'att-test-2',
        organizationId: tenantId,
        employeeId: 'test-emp',
        date: '2026-09-02',
        shiftId: 'shift-001',
        checkIn: '09:00:00',
        checkOut: '14:00:00',
        workDurationMinutes: 300,
        workHours: 5.0,
        lateMinutes: 0,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        status: 'Half-Day',
        isRegularized: false,
        punchSource: 'Web Portal',
      },
      // Day 3: Absent / < 4.5 hours (3 hours)
      {
        id: 'att-test-3',
        organizationId: tenantId,
        employeeId: 'test-emp',
        date: '2026-09-03',
        shiftId: 'shift-001',
        checkIn: '09:00:00',
        checkOut: '12:00:00',
        workDurationMinutes: 180,
        workHours: 3.0,
        lateMinutes: 0,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        status: 'Absent',
        isRegularized: false,
        punchSource: 'Web Portal',
      },
      // Day 4: Late mark 1 (30 min late)
      {
        id: 'att-test-4',
        organizationId: tenantId,
        employeeId: 'test-emp',
        date: '2026-09-04',
        shiftId: 'shift-001',
        checkIn: '09:30:00',
        checkOut: '18:30:00',
        workDurationMinutes: 540,
        workHours: 9.0,
        lateMinutes: 30,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        status: 'Late Arrival',
        isRegularized: false,
        punchSource: 'Web Portal',
      },
      // Day 5: Late mark 2 (20 min late)
      {
        id: 'att-test-5',
        organizationId: tenantId,
        employeeId: 'test-emp',
        date: '2026-09-05',
        shiftId: 'shift-001',
        checkIn: '09:20:00',
        checkOut: '18:20:00',
        workDurationMinutes: 540,
        workHours: 9.0,
        lateMinutes: 20,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        status: 'Late Arrival',
        isRegularized: false,
        punchSource: 'Web Portal',
      },
      // Day 6: Late mark 3 (exceeds max 2 allowable -> triggers 0.5 LOP penalty)
      {
        id: 'att-test-6',
        organizationId: tenantId,
        employeeId: 'test-emp',
        date: '2026-09-06',
        shiftId: 'shift-001',
        checkIn: '09:25:00',
        checkOut: '18:25:00',
        workDurationMinutes: 540,
        workHours: 9.0,
        lateMinutes: 25,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        status: 'Late Arrival',
        isRegularized: false,
        punchSource: 'Web Portal',
      },
    ];

    const evalResult = AttendancePolicyService.evaluateAttendanceForPayroll({
      attendance: mockAttendance,
      policy: newPolicy,
      totalWorkingDays: 30,
    });

    assert(
      'Attendance policy evaluates present days correctly',
      evalResult.presentDays === 4, // Day 1, Day 4, Day 5, Day 6
      `Present days: ${evalResult.presentDays}`
    );

    assert(
      'Attendance policy evaluates half days correctly',
      evalResult.halfDays === 1, // Day 2
      `Half days: ${evalResult.halfDays}`
    );

    assert(
      'Attendance policy calculates late penalty LOP correctly',
      evalResult.latePenaltyLopDays === 0.5, // 1 excess late * 0.5
      `Late penalty LOP: ${evalResult.latePenaltyLopDays}`
    );

    assert(
      'Attendance policy calculates overtime correctly',
      evalResult.overtimeHours === 0.5,
      `Raw OT: ${evalResult.overtimeHours}h`
    );
  } catch (err: any) {
    assert('Attendance Policy CRUD & Evaluation', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Safe Deletion & Dependency Protection
  // -------------------------------------------------------------
  try {
    const defaultCycle = PayrollCycleService.getDefaultCycle(tenantId);
    if (defaultCycle) {
      const deleteDefaultRes = PayrollCycleService.delete(defaultCycle.id, tenantId);
      assert(
        'Blocking deletion of default payroll cycle',
        !deleteDefaultRes.success && deleteDefaultRes.message.includes('default'),
        deleteDefaultRes.message
      );
    }

    const defaultPolicy = AttendancePolicyService.getDefaultPolicy(tenantId);
    if (defaultPolicy) {
      const deleteDefaultPolRes = AttendancePolicyService.delete(defaultPolicy.id, tenantId);
      assert(
        'Blocking deletion of default attendance policy',
        !deleteDefaultPolRes.success && deleteDefaultPolRes.message.includes('default'),
        deleteDefaultPolRes.message
      );
    }
  } catch (err: any) {
    assert('Safe Deletion & Dependency Protection', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: Mandatory Employee Mapping & Automatic Fallback
  // -------------------------------------------------------------
  try {
    const employees = EmployeeService.getAll();
    const activeEmp = employees[0];

    assert(
      'All employees have payrollCycleId populated',
      employees.every((e: Employee) => !!e.payrollCycleId),
      `Checked ${employees.length} employees`
    );

    assert(
      'All employees have attendancePolicyId populated',
      employees.every((e: Employee) => !!e.attendancePolicyId),
      `Checked ${employees.length} employees`
    );

    const assignedCycle = PayrollCycleService.getById(activeEmp.payrollCycleId!);
    const assignedPolicy = AttendancePolicyService.getById(activeEmp.attendancePolicyId!);

    assert(
      'Employee mapped to valid active Payroll Cycle',
      !!assignedCycle && assignedCycle.status === 'Active',
      `Assigned Cycle: ${assignedCycle?.name}`
    );

    assert(
      'Employee mapped to valid active Attendance Policy',
      !!assignedPolicy && assignedPolicy.status === 'Active',
      `Assigned Policy: ${assignedPolicy?.name}`
    );
  } catch (err: any) {
    assert('Mandatory Employee Mapping', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: End-to-End Payroll Monthly Calculation Engine
  // -------------------------------------------------------------
  try {
    const employees = EmployeeService.getAll();
    const emp = employees[0];

    const breakup = PayrollCalculationService.calculateEmployeeMonthlyPay({
      employee: emp,
      year: 2026,
      month: 9,
      tenantId,
    });

    assert(
      'End-to-end salary breakup generated with valid earnings and statutory deductions',
      !!breakup &&
      breakup.earnings.basicSalary > 0 &&
      breakup.earnings.totalGross > 0 &&
      breakup.netSalary > 0 &&
      breakup.paymentDays > 0,
      `Employee: ${breakup.employee.firstName}, Gross: ₹${breakup.earnings.totalGross}, Net: ₹${breakup.netSalary}, Days: ${breakup.paymentDays}`
    );

    assert(
      'Salary breakup reflects working days and salary structure correctly',
      breakup.workingDays === 30 && breakup.deductions.totalDeductions >= 0,
      `Working days: ${breakup.workingDays}, Total deductions: ₹${breakup.deductions.totalDeductions}`
    );
  } catch (err: any) {
    assert('End-to-End Payroll Calculation', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Multi-Tenant Isolation
  // -------------------------------------------------------------
  try {
    const otherTenantId = 'org-other-tenant-99';

    // Save cycle in other tenant
    const createdOther = PayrollCycleService.create({
      organizationId: otherTenantId,
      name: 'Other Tenant 15th-14th Cycle',
      startDay: 15,
      endDay: 14,
      status: 'Active',
      isDefault: false,
    });

    const refreshedSilarisCycles = PayrollCycleService.getAll(tenantId);
    assert(
      'Multi-tenant cycle isolation is strictly enforced',
      !refreshedSilarisCycles.some((c: PayrollCycle) => c.id === createdOther.id),
      `Tenant ${tenantId} cycle count: ${refreshedSilarisCycles.length}`
    );
  } catch (err: any) {
    assert('Multi-Tenant Isolation', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 8: Holiday List Configuration & Period Retrieval
  // -------------------------------------------------------------
  try {
    const holidays = HolidayPayrollService.getAll({ tenantId });
    assert(
      'Initial seed holidays exist in unified storage',
      holidays.length > 0,
      `Found ${holidays.length} holidays`
    );

    // Create a new holiday
    const newHoliday = HolidayPayrollService.create({
      organizationId: tenantId,
      name: 'Diwali Special Holiday',
      date: '2026-11-08',
      isOptional: false,
      description: 'Festival of Lights',
    });

    assert(
      'Holiday created successfully in unified storage',
      !!newHoliday.id && newHoliday.name === 'Diwali Special Holiday',
      `Holiday ID: ${newHoliday.id}`
    );

    // Test period range retrieval
    const novHolidays = HolidayPayrollService.getHolidaysInPeriod(tenantId, '2026-11-01', '2026-11-30');
    assert(
      'Holiday within period range is retrieved accurately',
      novHolidays.some(h => h.date === '2026-11-08'),
      `November holidays count: ${novHolidays.length}`
    );
  } catch (err: any) {
    assert('Holiday List Configuration & Period Retrieval', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 9: Overtime Configuration & Calculation Modes
  // -------------------------------------------------------------
  try {
    const otConfig = PayrollOvertimeConfigService.getConfig(tenantId);
    assert(
      'Default Overtime Configuration exists',
      !!otConfig && otConfig.isEnabled === true,
      `OT Calculation Method: ${otConfig.calculationMethod}`
    );

    // Test Multiplier calculation (1.5x of Hourly Basic)
    const multiplierPayRes = PayrollOvertimeConfigService.calculateOvertimePay({
      otHours: 10,
      basicSalary: 30000,
      grossSalary: 60000,
      workingDaysPerMonth: 30,
      standardShiftHours: 8,
      tenantId,
    });
    // hourlyRate = 30000 / (30 * 8) = 125
    // pay = 10 * 125 * 1.5 = 1875
    assert(
      'OT Multiplier pay calculation is accurate',
      multiplierPayRes.otPay === 1875,
      `Expected 1875, got ${multiplierPayRes.otPay}`
    );

    // Update config to Fixed Rate per Hour
    PayrollOvertimeConfigService.updateConfig(tenantId, { calculationMethod: 'FIXED_PER_HOUR', fixedAmountPerHour: 200 });
    const fixedHrPayRes = PayrollOvertimeConfigService.calculateOvertimePay({
      otHours: 5,
      basicSalary: 30000,
      grossSalary: 60000,
      tenantId,
    });
    assert(
      'OT Fixed Rate per Hour pay calculation is accurate',
      fixedHrPayRes.otPay === 1000,
      `Expected 1000, got ${fixedHrPayRes.otPay}`
    );

    // Reset OT config back to default enabled with multiplier
    PayrollOvertimeConfigService.updateConfig(tenantId, { calculationMethod: 'MULTIPLIER', multiplier: 1.5, isEnabled: true });
  } catch (err: any) {
    assert('Overtime Configuration & Calculation Modes', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 10: Salary Components CRUD & Amount Computation
  // -------------------------------------------------------------
  try {
    const components = SalaryComponentService.getAll(tenantId);
    assert(
      'Initial seed salary components exist',
      components.length >= 4,
      `Found ${components.length} components`
    );

    // Create a custom allowance component
    const perfBonus = SalaryComponentService.create({
      organizationId: tenantId,
      name: 'Performance Incentive',
      componentType: 'Incentive',
      calculationMethod: 'PERCENT_BASIC',
      value: 10, // 10% of basic
      isTaxable: true,
      isPfApplicable: false,
      isEsiApplicable: true,
      isRecurring: true,
      payslipDisplayName: 'Performance Incentive',
      status: 'Active',
    });

    assert(
      'Custom Salary Component created successfully',
      !!perfBonus.id && perfBonus.name === 'Performance Incentive',
      `Component: ${perfBonus.name}`
    );

    const calcAmt = SalaryComponentService.calculateComponentAmount(perfBonus, 30000, 60000);
    assert(
      'Component amount calculation (10% of basic ₹30,000) = ₹3,000',
      calcAmt === 3000,
      `Expected 3000, got ${calcAmt}`
    );
  } catch (err: any) {
    assert('Salary Components CRUD & Amount Computation', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 11: Deductions & Penalties Policy CRUD & Amount Calculation
  // -------------------------------------------------------------
  try {
    const deductions = DeductionPolicyService.getAll(tenantId);
    assert(
      'Initial seed deduction policies exist',
      deductions.length >= 3,
      `Found ${deductions.length} policies`
    );

    // Create a custom deduction policy
    const damageDeduction = DeductionPolicyService.create({
      organizationId: tenantId,
      name: 'IT Asset Security Deduction',
      deductionType: 'Damage/Recovery',
      calculationMethod: 'FIXED',
      value: 1500,
      isRecurring: false,
      isTaxDeductible: false,
      isAutomatic: false,
      status: 'Active',
    });

    assert(
      'Custom Deduction Policy created successfully',
      !!damageDeduction.id && damageDeduction.value === 1500,
      `Created Policy: ${damageDeduction.name}`
    );

    const dedAmt = DeductionPolicyService.calculateDeductionAmount({
      policy: damageDeduction,
      basicSalary: 30000,
      grossSalary: 60000,
    });
    assert(
      'Deduction fixed amount evaluates to ₹1,500',
      dedAmt === 1500,
      `Expected 1500, got ${dedAmt}`
    );
  } catch (err: any) {
    assert('Deductions & Penalties Policy CRUD & Amount Calculation', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 12: Integrated Full Pipeline Calculation
  // -------------------------------------------------------------
  try {
    const employees = EmployeeService.getAll();
    const emp = employees[0];

    const breakup = PayrollCalculationService.calculateEmployeeMonthlyPay({
      employee: emp,
      year: 2026,
      month: 9,
      tenantId,
    });

    assert(
      'Integrated payroll calculation aggregates custom earnings and deductions',
      breakup.netSalary > 0 && breakup.earnings.totalGross > breakup.earnings.basicSalary,
      `Gross: ₹${breakup.earnings.totalGross}, Deductions: ₹${breakup.deductions.totalDeductions}, Net: ₹${breakup.netSalary}`
    );
  } catch (err: any) {
    assert('Integrated Full Pipeline Calculation', false, err.message);
  }

  console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  return { passed, failed, results };
}
