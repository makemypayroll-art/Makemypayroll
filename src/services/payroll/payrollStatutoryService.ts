// ====================================================================
// NovaPulse / MakeMyPayroll — Centralized Statutory & Tax Service
// Configurable PF, ESI, TDS (Old & New Regimes), Leave Encashment & OT
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import {
  PayrollStatutoryConfig,
  EmployeeTaxProfile,
  EmployeePfProfile,
  EmployeeEsiProfile,
  TaxRegime,
} from '../../database/schema';

export const DEFAULT_STATUTORY_CONFIG: PayrollStatutoryConfig = {
  id: 'statutory-default',
  tenantId: 'NP-000001',
  effectiveFrom: '2026-04-01',
  // PF Configuration
  pfEnabled: true,
  pfWageCeiling: 15000, // Statutory monthly ceiling for mandatory PF/EPS
  pfEmployeeRate: 12,   // 12% employee contribution
  pfEmployerEpfRate: 3.67, // 3.67% EPF employer share
  pfEmployerEpsRate: 8.33, // 8.33% EPS employer share (capped at ceiling ₹1,250)
  pfAdminRate: 0.5,    // 0.5% EPF administrative charges
  pfEdliRate: 0.5,     // 0.5% EDLI insurance charges
  // ESI Configuration
  esiEnabled: true,
  esiGrossWageThreshold: 21000, // Statutory monthly gross wage eligibility
  esiEmployeeRate: 0.75, // 0.75% employee contribution
  esiEmployerRate: 3.25, // 3.25% employer contribution
  // Tax / TDS Configuration
  standardDeductionNew: 75000, // ₹75,000 for New Regime (FY 2026-27 / 2024-25 Budget update)
  standardDeductionOld: 50000, // ₹50,000 for Old Regime
  cessRate: 4, // 4% Health & Education Cess
  // Leave Encashment
  leaveEncashmentBasis: 'BASIC',
  minLeaveBalanceForEncashment: 5,
  maxEncashableDaysPerYear: 30,
  // Overtime
  overtimeMultiplier: 1.5,
  overtimeBasis: 'HOURLY_GROSS',
  updatedAt: new Date().toISOString(),
};

export class PayrollStatutoryService {
  /**
   * Retrieves active statutory configuration for a tenant
   */
  public static getConfig(tenantId: string = 'NP-000001'): PayrollStatutoryConfig {
    const list = StorageEngine.getList<PayrollStatutoryConfig>(STORAGE_KEYS.PAYROLL_STATUTORY_CONFIG);
    const found = list.find(c => c.tenantId === tenantId);
    return found || { ...DEFAULT_STATUTORY_CONFIG, tenantId };
  }

  /**
   * Updates statutory configuration
   */
  public static updateConfig(tenantId: string, updates: Partial<PayrollStatutoryConfig>): PayrollStatutoryConfig {
    const current = this.getConfig(tenantId);
    const updated: PayrollStatutoryConfig = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    StorageEngine.upsert<PayrollStatutoryConfig>(STORAGE_KEYS.PAYROLL_STATUTORY_CONFIG, updated);
    return updated;
  }

  /**
   * 1. PROVIDENT FUND (PF) CALCULATION
   * Computes Employee PF, Employer EPF, Employer EPS, and Admin charges
   */
  public static calculatePF(params: {
    basicWage: number;
    daWage?: number;
    vpfPercent?: number;
    isApplicable?: boolean;
    tenantId?: string;
  }): {
    isApplicable: boolean;
    pfEligibleWage: number;
    employeePF: number;
    voluntaryPF: number;
    totalEmployeePF: number;
    employerEPF: number;
    employerEPS: number;
    totalEmployerPF: number;
    adminCharges: number;
    edliCharges: number;
  } {
    const isApplicable = params.isApplicable !== false;
    if (!isApplicable) {
      return {
        isApplicable: false,
        pfEligibleWage: 0,
        employeePF: 0,
        voluntaryPF: 0,
        totalEmployeePF: 0,
        employerEPF: 0,
        employerEPS: 0,
        totalEmployerPF: 0,
        adminCharges: 0,
        edliCharges: 0,
      };
    }

    const cfg = this.getConfig(params.tenantId);
    const basicAndDa = Math.max(0, params.basicWage + (params.daWage || 0));
    
    // PF Wage is calculated on actual basic, while EPS is statutory capped at pfWageCeiling (₹15,000)
    const pfEligibleWage = basicAndDa;
    const epsWage = Math.min(basicAndDa, cfg.pfWageCeiling);

    // Employee PF = 12% of PF Eligible Wage
    const employeePF = Math.round((pfEligibleWage * cfg.pfEmployeeRate) / 100);
    
    // Voluntary PF (VPF)
    const vpfPercent = Math.max(0, params.vpfPercent || 0);
    const voluntaryPF = vpfPercent > 0 ? Math.round((pfEligibleWage * vpfPercent) / 100) : 0;
    const totalEmployeePF = employeePF + voluntaryPF;

    // Employer EPS = 8.33% of EPS Wage (max ₹1,250)
    const employerEPS = Math.round((epsWage * cfg.pfEmployerEpsRate) / 100);
    // Employer EPF = 12% of PF Eligible Wage minus EPS share
    const totalEmployerDirect = Math.round((pfEligibleWage * cfg.pfEmployeeRate) / 100);
    const employerEPF = Math.max(0, totalEmployerDirect - employerEPS);
    const totalEmployerPF = employerEPF + employerEPS;

    // Administrative & EDLI charges (paid by employer)
    const adminCharges = Math.round((pfEligibleWage * cfg.pfAdminRate) / 100);
    const edliCharges = Math.round((pfEligibleWage * cfg.pfEdliRate) / 100);

    return {
      isApplicable: true,
      pfEligibleWage,
      employeePF,
      voluntaryPF,
      totalEmployeePF,
      employerEPF,
      employerEPS,
      totalEmployerPF,
      adminCharges,
      edliCharges,
    };
  }

  /**
   * 2. EMPLOYEE STATE INSURANCE (ESI) CALCULATION
   * Threshold ₹21,000 gross monthly wage
   */
  public static calculateESI(params: {
    grossWage: number;
    isApplicable?: boolean;
    tenantId?: string;
  }): {
    isEligible: boolean;
    esiEligibleWage: number;
    employeeESI: number;
    employerESI: number;
    totalESI: number;
  } {
    const isApplicable = params.isApplicable !== false;
    const cfg = this.getConfig(params.tenantId);
    const gross = Math.max(0, params.grossWage);

    // ESI eligibility is applicable if monthly gross wage <= ₹21,000
    const isEligible = isApplicable && cfg.esiEnabled && gross <= cfg.esiGrossWageThreshold;

    if (!isEligible || gross === 0) {
      return {
        isEligible: false,
        esiEligibleWage: 0,
        employeeESI: 0,
        employerESI: 0,
        totalESI: 0,
      };
    }

    // Employee ESI: 0.75%
    const employeeESI = Math.ceil((gross * cfg.esiEmployeeRate) / 100);
    // Employer ESI: 3.25%
    const employerESI = Math.ceil((gross * cfg.esiEmployerRate) / 100);
    const totalESI = employeeESI + employerESI;

    return {
      isEligible: true,
      esiEligibleWage: gross,
      employeeESI,
      employerESI,
      totalESI,
    };
  }

  /**
   * 3. TAX DEDUCTION AT SOURCE (TDS) CALCULATION
   * Supports New Tax Regime (Section 115BAC) and Old Tax Regime with Deductions
   */
  public static calculateTDS(params: {
    annualGross: number;
    regime?: TaxRegime;
    section80C?: number;
    section80D?: number;
    hraExemption?: number;
    homeLoanInterest?: number;
    otherExemptions?: number;
    previousEmployerGross?: number;
    previousEmployerTds?: number;
    monthsRemaining?: number;
    tdsAlreadyDeducted?: number;
    tenantId?: string;
  }): {
    regime: TaxRegime;
    annualGross: number;
    standardDeduction: number;
    totalDeductionsExemptions: number;
    taxableIncome: number;
    taxBeforeRebate: number;
    rebate87A: number;
    taxAfterRebate: number;
    cess: number;
    totalAnnualTax: number;
    tdsAlreadyDeducted: number;
    remainingTaxLiability: number;
    monthlyTDS: number;
  } {
    const cfg = this.getConfig(params.tenantId);
    const regime = params.regime || 'NEW';
    const totalGross = Math.max(0, params.annualGross + (params.previousEmployerGross || 0));
    const monthsRemaining = Math.max(1, params.monthsRemaining || 12);
    const tdsAlreadyDeducted = Math.max(0, (params.tdsAlreadyDeducted || 0) + (params.previousEmployerTds || 0));

    let standardDeduction = 0;
    let otherDeductions = 0;
    let taxableIncome = totalGross;

    if (regime === 'NEW') {
      // New Tax Regime Slabs (FY 2026-27 / 2024 Budget)
      standardDeduction = cfg.standardDeductionNew; // ₹75,000
      taxableIncome = Math.max(0, totalGross - standardDeduction);

      let tax = 0;
      if (taxableIncome > 1500000) {
        tax += (taxableIncome - 1500000) * 0.30;
        tax += (1500000 - 1200000) * 0.20;
        tax += (1200000 - 1000000) * 0.15;
        tax += (1000000 - 700000) * 0.10;
        tax += (700000 - 300000) * 0.05;
      } else if (taxableIncome > 1200000) {
        tax += (taxableIncome - 1200000) * 0.20;
        tax += (1200000 - 1000000) * 0.15;
        tax += (1000000 - 700000) * 0.10;
        tax += (700000 - 300000) * 0.05;
      } else if (taxableIncome > 1000000) {
        tax += (taxableIncome - 1000000) * 0.15;
        tax += (1000000 - 700000) * 0.10;
        tax += (700000 - 300000) * 0.05;
      } else if (taxableIncome > 700000) {
        tax += (taxableIncome - 700000) * 0.10;
        tax += (700000 - 300000) * 0.05;
      } else if (taxableIncome > 300000) {
        tax += (taxableIncome - 300000) * 0.05;
      }

      // Section 87A Rebate: Under New Regime, income up to ₹7,00,000 pays zero tax
      let rebate87A = 0;
      if (taxableIncome <= 700000) {
        rebate87A = tax;
      }
      const taxAfterRebate = Math.max(0, tax - rebate87A);
      const cess = Math.round((taxAfterRebate * cfg.cessRate) / 100);
      const totalAnnualTax = taxAfterRebate + cess;
      const remainingTaxLiability = Math.max(0, totalAnnualTax - tdsAlreadyDeducted);
      const monthlyTDS = Math.round(remainingTaxLiability / monthsRemaining);

      return {
        regime: 'NEW',
        annualGross: totalGross,
        standardDeduction,
        totalDeductionsExemptions: standardDeduction,
        taxableIncome,
        taxBeforeRebate: tax,
        rebate87A,
        taxAfterRebate,
        cess,
        totalAnnualTax,
        tdsAlreadyDeducted,
        remainingTaxLiability,
        monthlyTDS,
      };
    } else {
      // Old Tax Regime Slabs
      standardDeduction = cfg.standardDeductionOld; // ₹50,000
      const sec80C = Math.min(150000, Math.max(0, params.section80C || 0));
      const sec80D = Math.min(75000, Math.max(0, params.section80D || 0));
      const hra = Math.max(0, params.hraExemption || 0);
      const homeLoan = Math.min(200000, Math.max(0, params.homeLoanInterest || 0));
      const other = Math.max(0, params.otherExemptions || 0);

      otherDeductions = sec80C + sec80D + hra + homeLoan + other;
      const totalDeductions = standardDeduction + otherDeductions;
      taxableIncome = Math.max(0, totalGross - totalDeductions);

      let tax = 0;
      if (taxableIncome > 1000000) {
        tax += (taxableIncome - 1000000) * 0.30;
        tax += (1000000 - 500000) * 0.20;
        tax += (500000 - 250000) * 0.05;
      } else if (taxableIncome > 500000) {
        tax += (taxableIncome - 500000) * 0.20;
        tax += (500000 - 250000) * 0.05;
      } else if (taxableIncome > 250000) {
        tax += (taxableIncome - 250000) * 0.05;
      }

      // Section 87A Rebate for Old Regime (up to ₹5,00,000 income -> max ₹12,500 rebate)
      let rebate87A = 0;
      if (taxableIncome <= 500000) {
        rebate87A = Math.min(tax, 12500);
      }
      const taxAfterRebate = Math.max(0, tax - rebate87A);
      const cess = Math.round((taxAfterRebate * cfg.cessRate) / 100);
      const totalAnnualTax = taxAfterRebate + cess;
      const remainingTaxLiability = Math.max(0, totalAnnualTax - tdsAlreadyDeducted);
      const monthlyTDS = Math.round(remainingTaxLiability / monthsRemaining);

      return {
        regime: 'OLD',
        annualGross: totalGross,
        standardDeduction,
        totalDeductionsExemptions: totalDeductions,
        taxableIncome,
        taxBeforeRebate: tax,
        rebate87A,
        taxAfterRebate,
        cess,
        totalAnnualTax,
        tdsAlreadyDeducted,
        remainingTaxLiability,
        monthlyTDS,
      };
    }
  }

  /**
   * 4. LEAVE ENCASHMENT CALCULATION
   */
  public static calculateLeaveEncashment(params: {
    basicSalary: number;
    grossSalary: number;
    encashedDays: number;
    totalWorkingDays?: number;
    basis?: 'BASIC' | 'BASIC_DA' | 'GROSS';
    tenantId?: string;
  }): {
    perDayRate: number;
    encashedDays: number;
    amount: number;
  } {
    const cfg = this.getConfig(params.tenantId);
    const workingDays = params.totalWorkingDays || 26;
    const basisType = params.basis || cfg.leaveEncashmentBasis || 'BASIC';
    const baseAmount = basisType === 'GROSS' ? params.grossSalary : params.basicSalary;

    const perDayRate = workingDays > 0 ? Math.round((baseAmount / workingDays) * 100) / 100 : 0;
    const encashedDays = Math.max(0, params.encashedDays);
    const amount = Math.round(perDayRate * encashedDays);

    return {
      perDayRate,
      encashedDays,
      amount,
    };
  }

  /**
   * 5. OVERTIME (OT) CALCULATION
   */
  public static calculateOvertime(params: {
    otHours: number;
    basicSalary: number;
    grossSalary: number;
    multiplier?: number;
    totalWorkingDays?: number;
    shiftHours?: number;
    basis?: 'HOURLY_GROSS' | 'HOURLY_BASIC' | 'FIXED_HOURLY';
    fixedHourlyRate?: number;
    tenantId?: string;
  }): {
    otHours: number;
    hourlyRate: number;
    multiplier: number;
    otAmount: number;
  } {
    const cfg = this.getConfig(params.tenantId);
    const otHours = Math.max(0, params.otHours);
    const multiplier = params.multiplier || cfg.overtimeMultiplier || 1.5;
    const workingDays = params.totalWorkingDays || 26;
    const shiftHours = params.shiftHours || 8;
    const totalWorkingHours = workingDays * shiftHours;

    let hourlyRate = 0;
    const basis = params.basis || cfg.overtimeBasis || 'HOURLY_GROSS';

    if (basis === 'FIXED_HOURLY') {
      hourlyRate = params.fixedHourlyRate || cfg.fixedHourlyRate || 100;
    } else if (basis === 'HOURLY_BASIC') {
      hourlyRate = totalWorkingHours > 0 ? params.basicSalary / totalWorkingHours : 0;
    } else {
      hourlyRate = totalWorkingHours > 0 ? params.grossSalary / totalWorkingHours : 0;
    }

    const otAmount = Math.round(otHours * hourlyRate * multiplier);

    return {
      otHours,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      multiplier,
      otAmount,
    };
  }
}
