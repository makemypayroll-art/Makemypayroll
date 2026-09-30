// ====================================================================
// Overtime (OT) Configuration & Calculation Engine Service
// ====================================================================

import { StorageEngine, STORAGE_KEYS } from '../../database/storageEngine';
import { OvertimeConfig } from '../../database/schema';
import { AuditService } from '../auditService';

export const DEFAULT_OVERTIME_CONFIG: OvertimeConfig = {
  id: 'ot-config-001',
  organizationId: 'NP-000001',
  isEnabled: true,
  calculationMethod: 'MULTIPLIER',
  multiplier: 1.5,
  fixedAmountPerHour: 200,
  fixedAmountPerDay: 1500,
  minOtHoursDaily: 0.5,
  otRoundingMinutes: 15,
  detectionMode: 'after_shift',
  requireApproval: false,
  maxDailyOtHours: 4,
  maxMonthlyOtHours: 40,
  updatedAt: new Date().toISOString(),
};

export class PayrollOvertimeConfigService {
  /**
   * Retrieves active OT Configuration for a tenant
   */
  public static getConfig(tenantId?: string): OvertimeConfig {
    const targetTenant = tenantId || StorageEngine.getActiveTenantId();
    const list = StorageEngine.getList<OvertimeConfig>(STORAGE_KEYS.OVERTIME_CONFIG);
    const found = list.find(c => c.organizationId === targetTenant || c.organizationId === 'NP-000001');
    if (found) return found;

    const defaultConfig: OvertimeConfig = {
      ...DEFAULT_OVERTIME_CONFIG,
      id: `ot-config-${targetTenant}`,
      organizationId: targetTenant,
      updatedAt: new Date().toISOString(),
    };
    StorageEngine.insert<OvertimeConfig>(STORAGE_KEYS.OVERTIME_CONFIG, defaultConfig);
    return defaultConfig;
  }

  /**
   * Updates OT configuration
   */
  public static updateConfig(
    tenantId: string,
    updates: Partial<OvertimeConfig>,
    user: string = 'Super Admin'
  ): OvertimeConfig {
    const current = this.getConfig(tenantId);
    const updated: OvertimeConfig = {
      ...current,
      ...updates,
      organizationId: tenantId,
      updatedAt: new Date().toISOString(),
    };

    const list = StorageEngine.getList<OvertimeConfig>(STORAGE_KEYS.OVERTIME_CONFIG);
    const index = list.findIndex(c => c.organizationId === tenantId);
    if (index >= 0) {
      list[index] = updated;
      StorageEngine.set(STORAGE_KEYS.OVERTIME_CONFIG, list);
    } else {
      StorageEngine.insert<OvertimeConfig>(STORAGE_KEYS.OVERTIME_CONFIG, updated);
    }

    AuditService.log({
      userId: 'user-001',
      userName: user,
      userRole: 'Super Admin',
      module: 'Payroll Configuration',
      action: 'UPDATE',
      description: `Updated Overtime configuration (Enabled: ${updated.isEnabled}, Method: ${updated.calculationMethod}, Multiplier: ${updated.multiplier}x)`,
      recordId: updated.id,
    });

    return updated;
  }

  /**
   * Calculates Overtime Pay based on tenant OT configuration and employee salary
   */
  public static calculateOvertimePay(params: {
    basicSalary: number;
    grossSalary: number;
    otHours: number;
    workingDaysPerMonth?: number;
    standardShiftHours?: number;
    tenantId?: string;
  }): {
    otPay: number;
    hourlyRate: number;
    effectiveMultiplier: number;
    isEligible: boolean;
  } {
    const {
      basicSalary,
      grossSalary,
      otHours,
      workingDaysPerMonth = 26,
      standardShiftHours = 8,
      tenantId,
    } = params;

    const config = this.getConfig(tenantId);

    // If Overtime is disabled globally, payable OT is ₹0
    if (!config.isEnabled || otHours <= 0) {
      return {
        otPay: 0,
        hourlyRate: 0,
        effectiveMultiplier: config.multiplier || 1.0,
        isEligible: false,
      };
    }

    // Apply minimum threshold
    if (otHours < (config.minOtHoursDaily || 0)) {
      return {
        otPay: 0,
        hourlyRate: 0,
        effectiveMultiplier: config.multiplier || 1.0,
        isEligible: false,
      };
    }

    // Cap at monthly limit if configured
    const cappedHours = config.maxMonthlyOtHours > 0 ? Math.min(otHours, config.maxMonthlyOtHours) : otHours;

    let hourlyRate = 0;
    let otPay = 0;

    switch (config.calculationMethod) {
      case 'FIXED_PER_HOUR':
        hourlyRate = Number(config.fixedAmountPerHour) || 200;
        otPay = Math.round(cappedHours * hourlyRate);
        break;

      case 'FIXED_PER_DAY':
        // Pro-rata based on standard shift hours
        const dailyRate = Number(config.fixedAmountPerDay) || 1500;
        hourlyRate = dailyRate / standardShiftHours;
        otPay = Math.round(cappedHours * hourlyRate);
        break;

      case 'MULTIPLIER':
      default:
        // Hourly rate computed from monthly gross salary (or basic) / (26 days * 8 hours)
        const base = grossSalary > 0 ? grossSalary : basicSalary;
        hourlyRate = base / (workingDaysPerMonth * standardShiftHours);
        const mult = Number(config.multiplier) || 1.5;
        otPay = Math.round(cappedHours * hourlyRate * mult);
        break;
    }

    return {
      otPay,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      effectiveMultiplier: config.multiplier || 1.5,
      isEligible: true,
    };
  }
}
