// ====================================================================
// NovaPulse / MakeMyPayroll — Centralized Payroll Calculation Engine
// Single canonical calculation pipeline for Payroll Runs, Preview, Payslips & Reports
// ====================================================================

import {
  Employee,
  Payslip,
  PayslipEarnings,
  PayslipDeductions,
  PayslipEmployerContrib,
  PayrollPeriod,
  PayrollStatus,
  Branch,
  Department,
  Designation,
  LeaveApplication,
} from '../../database/schema';
import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { AttendanceService } from '../attendanceService';
import { PayrollStatutoryService } from './payrollStatutoryService';
import { PayrollLoanService } from './payrollLoanService';
import { PayrollAdvanceService } from './payrollAdvanceService';
import { PayrollReimbursementService } from './payrollReimbursementService';
import { PayrollOvertimeService, PayrollEncashmentService } from './payrollOvertimeService';
import { PayrollCycleService } from './payrollCycleService';
import { AttendancePolicyService } from './attendancePolicyService';
import { PayrollOvertimeConfigService } from './payrollOvertimeConfigService';
import { SalaryComponentService } from './salaryComponentService';
import { DeductionPolicyService } from './deductionPolicyService';
import { HolidayPayrollService } from './holidayPayrollService';
import { LeavePayrollConfigService } from './leavePayrollConfigService';

export interface EmployeeSalaryBreakup {
  employee: Employee;
  workingDays: number;
  paymentDays: number;
  presentDays: number;
  lopDays: number;
  paidLeaveDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  overtimeHours: number;
  earnings: PayslipEarnings;
  deductions: PayslipDeductions;
  employerContributions: PayslipEmployerContrib;
  netSalary: number;
  netSalaryInWords: string;
}

export class PayrollCalculationService {
  /**
   * Converts number to Indian Currency Words (e.g. 1,45,200 -> "One Lakh Forty-Five Thousand Two Hundred Rupees Only")
   */
  public static numberToWordsINR(num: number): string {
    if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      if (!n || isNaN(n) || n <= 0) return '';
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    };

    const words = inWords(Math.round(num)).trim();
    return words ? `${words} Rupees Only` : 'Zero Rupees Only';
  }

  /**
   * Calculates Professional Tax (PT) in India (Typical standard slab: ₹200/mo, ₹300 in Feb/Mar)
   */
  public static calculateProfessionalTax(grossSalary: number, state: string = 'Karnataka'): number {
    if (grossSalary < 15000) return 0;
    return 200;
  }

  /**
   * Centralized Calculation Pipeline for an individual employee
   */
  public static calculateEmployeeMonthlyPay(params: {
    employee: Employee;
    month: number;
    year: number;
    totalWorkingDays?: number;
    tenantId?: string;
    applyLiveDeductions?: boolean;
    periodId?: string;
  }): EmployeeSalaryBreakup {
    const { employee, month, year } = params;
    const tenantId = params.tenantId || employee.organizationId || (employee as any).tenantId || 'NP-000001';
    const totalWorkingDays = params.totalWorkingDays || 26;
    const periodId = params.periodId || `pay-${year}-${month.toString().padStart(2, '0')}`;
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;

    // 1. Dynamic Payroll Cycle & Period Resolution
    const cycle = employee.payrollCycleId
      ? PayrollCycleService.getById(employee.payrollCycleId) || PayrollCycleService.getDefaultCycle(tenantId)
      : PayrollCycleService.getDefaultCycle(tenantId);
    const periodDates = PayrollCycleService.calculatePeriodDates(cycle, year, month);

    // 2. Holidays in Period
    const holidaysInPeriod = HolidayPayrollService.getHolidaysInPeriod(
      periodDates.startDate,
      periodDates.endDate,
      tenantId,
      employee.branchId
    );
    const holidayCount = Math.max(holidaysInPeriod.length, 1);

    // 3. Attendance & LOP Policy Evaluation
    const empAttendance = AttendanceService.getAll().filter(
      a => a.employeeId === employee.id && a.date >= periodDates.startDate && a.date <= periodDates.endDate
    );

    const policy = employee.attendancePolicyId
      ? AttendancePolicyService.getById(employee.attendancePolicyId) || AttendancePolicyService.getDefaultPolicy(tenantId)
      : AttendancePolicyService.getDefaultPolicy(tenantId);

    const evalResult = AttendancePolicyService.evaluateAttendanceForPayroll({
      attendance: empAttendance,
      policy,
      totalWorkingDays,
      employeeId: employee.id,
      year,
    });

    // Check for approved leave applications falling within period
    const approvedLeaves = StorageEngine.getList<LeaveApplication>(STORAGE_KEYS.LEAVE_APPLICATIONS).filter(
      a =>
        a.employeeId === employee.id &&
        a.status === 'approved' &&
        a.startDate <= periodDates.endDate &&
        a.endDate >= periodDates.startDate
    );

    let additionalLop = 0;
    let additionalPaid = 0;

    approvedLeaves.forEach(app => {
      const hasAttendancePunch = empAttendance.some(att => att.date >= app.startDate && att.date <= app.endDate);
      if (!hasAttendancePunch) {
        const impact = LeavePayrollConfigService.evaluateLeaveImpact({
          employeeId: employee.id,
          leaveTypeId: app.leaveTypeId,
          totalDays: app.totalDays,
          year,
        });
        additionalPaid += impact.paidDays;
        additionalLop += impact.lopDays;
      }
    });

    const lopDays = Number((evalResult.totalLopDays + additionalLop).toFixed(1));
    const paidLeaveDays = evalResult.paidLeaveDays + additionalPaid;
    const presentDays = Math.max(0, evalResult.presentDays - (additionalLop + additionalPaid));
    const halfDays = evalResult.halfDays;
    const weeklyOffDays = evalResult.weeklyOffDays || 4; // Standard 4 Sundays
    const holidayDays = evalResult.holidayDays || holidayCount;
    let overtimeHours = evalResult.overtimeHours;

    const paymentDays = Math.max(0, totalWorkingDays - lopDays);

    // 4. Base Salary Structure & Custom Components
    const salary = employee.salaryStructure || {
      basicSalary: 30000,
      hra: 15000,
      conveyanceAllowance: 3000,
      specialAllowance: 10000,
      medicalAllowance: 2000,
      otherAllowances: 0,
      grossSalary: 60000,
    };

    const basicSalary = Number(salary.basicSalary) || 0;
    const hraSalary = Number(salary.hra) || 0;
    const conveyanceSalary = Number(salary.conveyanceAllowance) || 0;
    const specialSalary = Number(salary.specialAllowance) || 0;
    const medicalSalary = Number(salary.medicalAllowance) || 0;
    const otherSalary = Number(salary.otherAllowances) || 0;
    const grossSalary = Number(salary.grossSalary) || (basicSalary + hraSalary + conveyanceSalary + specialSalary + medicalSalary + otherSalary);

    // Proration factor based on LOP
    const prorationRatio = totalWorkingDays > 0 ? paymentDays / totalWorkingDays : 1;
    const perDayGross = totalWorkingDays > 0 ? grossSalary / totalWorkingDays : 0;
    const lopDeduction = Math.round(lopDays * perDayGross);

    const earnedBasic = Math.round(basicSalary * prorationRatio);
    const earnedHra = Math.round(hraSalary * prorationRatio);
    const earnedConveyance = Math.round(conveyanceSalary * prorationRatio);
    const earnedSpecial = Math.round(specialSalary * prorationRatio);
    const earnedMedical = Math.round(medicalSalary * prorationRatio);
    const earnedOther = Math.round(otherSalary * prorationRatio);

    // Dynamic Custom Salary Components
    let customComponentsPay = 0;
    let calculatedIncentives = 0;
    let calculatedBonus = 0;
    const customComponentsBreakdown: Record<string, number> = {};

    const availableComponents = SalaryComponentService.getAll(tenantId).filter(c => c.status === 'Active');
    availableComponents.forEach(comp => {
      // Check if employee has assigned value or global default
      const assignedVal = salary.customComponents?.[comp.id];
      if (assignedVal !== undefined || comp.isRecurring) {
        const compAmt = SalaryComponentService.calculateComponentAmount(
          comp,
          earnedBasic,
          grossSalary,
          assignedVal
        );
        if (compAmt > 0) {
          customComponentsBreakdown[comp.payslipDisplayName || comp.name] = compAmt;
          customComponentsPay += compAmt;
          if (comp.componentType === 'Incentive') {
            calculatedIncentives += compAmt;
          } else if (comp.componentType === 'Bonus') {
            calculatedBonus += compAmt;
          }
        }
      }
    });

    // 5. Overtime Pay Calculation via OT Management Engine
    let otPay = 0;
    if (params.applyLiveDeductions) {
      const otResult = PayrollOvertimeService.processMonthlyOvertime(employee.id, monthStr, periodId, tenantId);
      otPay = otResult.totalOtPay;
      if (otResult.totalOtHours > 0) {
        overtimeHours = otResult.totalOtHours;
      }
    } else {
      const otCalc = PayrollOvertimeConfigService.calculateOvertimePay({
        basicSalary,
        grossSalary,
        otHours: overtimeHours,
        workingDaysPerMonth: totalWorkingDays,
        tenantId,
      });
      otPay = otCalc.otPay;
    }

    // 6. Leave Encashment & Reimbursements
    let leaveEncashmentPay = 0;
    let reimbursementsPay = 0;

    if (params.applyLiveDeductions) {
      const encashRes = PayrollEncashmentService.processMonthlyEncashment(employee.id, periodId, tenantId);
      leaveEncashmentPay = encashRes.totalEncashmentAmount;

      const reimbRes = PayrollReimbursementService.processPayrollPayout(employee.id, periodId, tenantId);
      reimbursementsPay = reimbRes.totalReimbursements;
    }

    // 7. Total Gross Earnings
    const totalGross = Math.max(
      0,
      earnedBasic +
        earnedHra +
        earnedConveyance +
        earnedSpecial +
        earnedMedical +
        earnedOther +
        customComponentsPay +
        otPay +
        leaveEncashmentPay +
        reimbursementsPay
    );

    // 8. Statutory PF & ESI Deductions
    const pfRes = PayrollStatutoryService.calculatePF({
      basicWage: earnedBasic,
      tenantId,
    });

    const esiRes = PayrollStatutoryService.calculateESI({
      grossWage: totalGross,
      tenantId,
    });

    // 9. Professional Tax (PT)
    const professionalTax = this.calculateProfessionalTax(totalGross);

    // 10. Tax Deduction at Source (TDS)
    const projectedAnnualGross = totalGross * 12;
    const tdsRes = PayrollStatutoryService.calculateTDS({
      annualGross: projectedAnnualGross,
      regime: 'NEW',
      tenantId,
    });
    const tds = tdsRes.monthlyTDS;

    // 11. Loans & Advances Recovery
    let loanEmi = 0;
    let advanceRecovery = 0;

    if (params.applyLiveDeductions) {
      const loanRes = PayrollLoanService.processMonthlyDeduction(employee.id, monthStr, tenantId);
      loanEmi = loanRes.totalEmiDeducted;

      const advRes = PayrollAdvanceService.processMonthlyRecovery(employee.id, tenantId);
      advanceRecovery = advRes.totalAdvanceRecovered;
    }

    const loanAdvanceDeduction = loanEmi + advanceRecovery;

    // 12. Dynamic Deductions & Penalties (Late Coming & Custom Penalties)
    let dynamicCustomDeductions = 0;
    const customDeductionsBreakdown: Record<string, number> = {};

    // Late penalty from attendance policy
    if (evalResult.latePenaltyLopDays > 0) {
      const latePenaltyAmt = Math.round(evalResult.latePenaltyLopDays * perDayGross);
      if (latePenaltyAmt > 0) {
        customDeductionsBreakdown['Late Coming Penalty'] = latePenaltyAmt;
        dynamicCustomDeductions += latePenaltyAmt;
      }
    }

    // Custom assigned deduction policies
    const availableDeductions = DeductionPolicyService.getAll(tenantId).filter(d => d.status === 'Active');
    availableDeductions.forEach(ded => {
      const assignedVal = salary.customDeductions?.[ded.id];
      if (assignedVal !== undefined) {
        const dedAmt = DeductionPolicyService.calculateDeductionAmount({
          policy: ded,
          basicSalary: earnedBasic,
          grossSalary,
          dailyGrossRate: perDayGross,
          overrideValue: assignedVal,
        });
        if (dedAmt > 0) {
          customDeductionsBreakdown[ded.name] = dedAmt;
          dynamicCustomDeductions += dedAmt;
        }
      }
    });

    // 13. Total Deductions
    const totalDeductions = Math.max(
      0,
      pfRes.totalEmployeePF +
        esiRes.employeeESI +
        professionalTax +
        tds +
        loanAdvanceDeduction +
        dynamicCustomDeductions
    );

    // 14. Net Payable Salary
    const netSalary = Math.max(0, totalGross - totalDeductions);
    const netSalaryInWords = this.numberToWordsINR(netSalary);

    const earnings: PayslipEarnings = {
      basicSalary: earnedBasic,
      hra: earnedHra,
      conveyanceAllowance: earnedConveyance,
      specialAllowance: earnedSpecial,
      medicalAllowance: earnedMedical,
      overtimePay: otPay,
      incentives: calculatedIncentives,
      bonus: calculatedBonus,
      leaveEncashment: leaveEncashmentPay,
      reimbursements: reimbursementsPay,
      otherAllowances: earnedOther,
      customComponents: customComponentsBreakdown,
      totalGross,
    };

    const deductions: PayslipDeductions = {
      pfEmployee: pfRes.totalEmployeePF,
      esiEmployee: esiRes.employeeESI,
      professionalTax,
      tds,
      lopDeduction,
      loanAdvanceDeduction,
      loanEmi,
      advanceRecovery,
      otherDeductions: dynamicCustomDeductions,
      customDeductions: customDeductionsBreakdown,
      totalDeductions,
    };

    const employerContributions: PayslipEmployerContrib = {
      pfEmployer: pfRes.totalEmployerPF,
      esiEmployer: esiRes.employerESI,
      epsEmployer: pfRes.employerEPS,
      epfEmployer: pfRes.employerEPF,
      edliEmployer: pfRes.edliCharges,
      pfAdminCharges: pfRes.adminCharges,
    };

    return {
      employee,
      workingDays: totalWorkingDays,
      paymentDays,
      presentDays,
      lopDays,
      paidLeaveDays,
      weeklyOffDays,
      holidayDays,
      overtimeHours,
      earnings,
      deductions,
      employerContributions,
      netSalary,
      netSalaryInWords,
    };
  }

  /**
   * Converts calculated breakup to a full Payslip entity
   */
  public static generatePayslip(
    breakup: EmployeeSalaryBreakup,
    params: {
      periodId: string;
      month: number;
      year: number;
      branch?: Branch;
      department?: Department;
      designation?: Designation;
      tenantId?: string;
    }
  ): Payslip {
    const { employee } = breakup;
    const tenantId = params.tenantId || employee.organizationId || (employee as any).tenantId || 'NP-000001';
    const refNumber = `MMP-PAY-${params.year}${params.month.toString().padStart(2, '0')}-${employee.employeeCode || employee.id}`;

    return {
      id: `ps-${params.periodId}-${employee.id}`,
      organizationId: tenantId,
      tenantId,
      payrollPeriodId: params.periodId,
      referenceNumber: refNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode || `NP-${employee.id}`,
      employeeName: employee.firstName 
        ? `${employee.firstName} ${employee.lastName || ''}`.trim() 
        : ((employee as any).personalInfo ? `${(employee as any).personalInfo.firstName} ${(employee as any).personalInfo.lastName || ''}`.trim() : (employee as any).name || employee.employeeCode || employee.id),
      departmentName: params.department?.name || 'Engineering',
      designationName: (params.designation as any)?.name || (params.designation as any)?.title || 'Software Engineer',
      branchName: params.branch?.name || 'Headquarters',
      bankAccount: employee.bankDetails?.accountNumber || '918822001199',
      bankName: employee.bankDetails?.bankName || 'HDFC Bank',
      ifscCode: employee.bankDetails?.ifscCode || 'HDFC0001234',
      pan: employee.statutoryDetails?.pan || 'ABCDE1234F',
      uan: employee.statutoryDetails?.uan || '100987654321',
      esiNumber: employee.statutoryDetails?.esicNumber || (employee.statutoryDetails as any)?.esiNumber || '31000987650001',
      month: params.month,
      year: params.year,
      totalWorkingDays: breakup.workingDays,
      paymentDays: breakup.paymentDays,
      presentDays: breakup.presentDays,
      lopDays: breakup.lopDays,
      paidLeaveDays: breakup.paidLeaveDays,
      weeklyOffDays: breakup.weeklyOffDays,
      holidayDays: breakup.holidayDays,
      overtimeHours: breakup.overtimeHours,
      earnings: breakup.earnings,
      deductions: breakup.deductions,
      employerContributions: breakup.employerContributions,
      netSalary: breakup.netSalary,
      netSalaryInWords: breakup.netSalaryInWords,
      status: 'Calculated',
      generatedAt: new Date().toISOString(),
    };
  }
}
