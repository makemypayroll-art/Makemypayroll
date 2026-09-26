// ====================================================================
// NovaPulse / MakeMyPayroll — Plan & Feature Control Service
// Enforces plan-based module entitlements & limits across portals
// ====================================================================

import { SubscriptionPlan, Tenant } from '../database/schema';
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';

export interface SaaSPlanDefinition {
  id: string;
  name: SubscriptionPlan | string;
  displayName: string;
  monthlyPricePerSeat: number;
  annualPricePerSeat: number;
  minEmployees: number;
  maxEmployees: number;
  maxBranches: number;
  supportLevel: 'Standard' | 'Priority' | 'Dedicated 24/7' | 'Custom SLA';
  enabledModules: string[];
  description: string;
}

export const DEFAULT_SAAS_PLANS: SaaSPlanDefinition[] = [
  {
    id: 'plan-starter',
    name: 'Starter',
    displayName: 'Starter HRMS',
    monthlyPricePerSeat: 60,
    annualPricePerSeat: 50,
    minEmployees: 1,
    maxEmployees: 25,
    maxBranches: 1,
    supportLevel: 'Standard',
    enabledModules: ['dashboard', 'employees', 'attendance', 'leaves', 'shifts', 'payroll'],
    description: 'Essential core HRMS & payroll engine for small businesses and startups.',
  },
  {
    id: 'plan-growth',
    name: 'Growth',
    displayName: 'Growth Business',
    monthlyPricePerSeat: 100,
    annualPricePerSeat: 85,
    minEmployees: 20,
    maxEmployees: 100,
    maxBranches: 5,
    supportLevel: 'Priority',
    enabledModules: [
      'dashboard',
      'employees',
      'attendance',
      'leaves',
      'shifts',
      'payroll',
      'tickets',
      'inventory',
      'settings',
      'insights',
    ],
    description: 'Full workforce operational management with IT helpdesk and asset tracking.',
  },
  {
    id: 'plan-professional',
    name: 'Professional',
    displayName: 'Professional Enterprise',
    monthlyPricePerSeat: 150,
    annualPricePerSeat: 120,
    minEmployees: 50,
    maxEmployees: 500,
    maxBranches: 20,
    supportLevel: 'Dedicated 24/7',
    enabledModules: [
      'dashboard',
      'employees',
      'attendance',
      'leaves',
      'shifts',
      'payroll',
      'tickets',
      'onboarding',
      'inventory',
      'geolocation',
      'settings',
      'insights',
    ],
    description: 'Advanced SaaS suite with onboarding, geo-fenced mobile attendance & multi-branch rules.',
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise Custom',
    displayName: 'Enterprise Custom',
    monthlyPricePerSeat: 200,
    annualPricePerSeat: 160,
    minEmployees: 100,
    maxEmployees: 10000,
    maxBranches: 999,
    supportLevel: 'Custom SLA',
    enabledModules: [
      'dashboard',
      'employees',
      'attendance',
      'leaves',
      'shifts',
      'payroll',
      'tickets',
      'onboarding',
      'inventory',
      'geolocation',
      'settings',
      'reports',
      'insights',
    ],
    description: 'Unlimited capacity, customized SLA, compliance reports and dedicated infrastructure.',
  },
];

export class PlanService {
  private static readonly STORAGE_PLANS_KEY = 'novapulse_hrms_v1_saas_plans';

  public static getPlans(): SaaSPlanDefinition[] {
    return StorageEngine.get<SaaSPlanDefinition[]>(this.STORAGE_PLANS_KEY, DEFAULT_SAAS_PLANS);
  }

  public static getPlanByName(planName?: string): SaaSPlanDefinition {
    const plans = this.getPlans();
    if (!planName) return plans[1];
    const clean = planName.toLowerCase().trim();
    const found = plans.find(
      p =>
        p.name.toLowerCase() === clean ||
        p.id.toLowerCase() === clean ||
        p.displayName.toLowerCase() === clean ||
        p.name.toLowerCase().startsWith(clean) ||
        clean.startsWith(p.name.toLowerCase().split(' ')[0]) ||
        p.id.toLowerCase().includes(clean)
    );
    return found || plans[1]; // default to Growth
  }

  public static isModuleAllowedForTenant(moduleKey: string, tenant: Tenant): boolean {
    // If tenant has explicit overrides
    if (tenant.enabledModules && tenant.enabledModules.length > 0) {
      return tenant.enabledModules.includes(moduleKey);
    }
    const plan = this.getPlanByName(tenant.subscriptionPlan);
    return plan.enabledModules.includes(moduleKey);
  }

  public static getEnabledModulesForTenant(tenant: Tenant): string[] {
    if (tenant.enabledModules && tenant.enabledModules.length > 0) {
      return tenant.enabledModules;
    }
    const plan = this.getPlanByName(tenant.subscriptionPlan);
    return plan.enabledModules;
  }
}
