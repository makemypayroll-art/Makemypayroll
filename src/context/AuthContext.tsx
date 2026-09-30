// ====================================================================
// NovaPulse HRMS — Authentication, Multi-Tenant SaaS & RBAC Context
// Linked to Supabase Auth & Tenant Isolation
// ====================================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role, Employee, PermissionSet, Tenant, AdminImpersonationSession } from '../database/schema';
import { AuthService } from '../services/authService';
import { EmployeeService } from '../services/employeeService';
import { TenantService } from '../services/tenantService';
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import { SupabaseAuthService, TenantUserProfile } from '../services/supabaseAuthService';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface AuthContextType {
  currentUser: User;
  currentEmployee?: Employee;
  userRole?: Role;
  availableUsers: User[];
  switchUser: (userId: string) => void;
  can: (module: string, action: keyof PermissionSet) => boolean;

  // Authentication State & Security Gate
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;

  // Role Access Levels
  isSuperAdmin: boolean;
  isClientAdmin: boolean;
  isHR: boolean;
  isManager: boolean;
  isEmployee: boolean;

  // Multi-Tenant SaaS State
  appEnvironment: 'super_admin' | 'client';
  setAppEnvironment: (env: 'super_admin' | 'client') => void;
  activeTenant: Tenant;
  setActiveTenantId: (tenantId: string) => void;
  allTenants: Tenant[];
  impersonationSession: AdminImpersonationSession | null;
  loginAsClient: (tenantId: string, reason?: string) => void;
  exitAdminMode: () => void;
  isImpersonating: boolean;

  // Supabase Auth Methods
  signIn: (email: string, password?: string, hostContext?: any) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
  isSupabaseActive: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(() =>
    StorageEngine.isAuthenticated()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentUser, setCurrentUserState] = useState<User>(() => AuthService.getCurrentUser());
  const [availableUsers, setAvailableUsers] = useState<User[]>(() => AuthService.getUsers());
  const [appEnvironment, setAppEnvironmentState] = useState<'super_admin' | 'client'>(() =>
    StorageEngine.getAppEnvironment()
  );
  const [activeTenant, setActiveTenantState] = useState<Tenant>(() => AuthService.getActiveTenant());
  const [impersonationSession, setImpersonationSessionState] = useState<AdminImpersonationSession | null>(() =>
    StorageEngine.getImpersonationSession()
  );
  const [allTenants, setAllTenants] = useState<Tenant[]>(() => TenantService.getAll());

  useEffect(() => {
    const unsub = StorageEngine.subscribe(() => {
      setIsAuthenticatedState(StorageEngine.isAuthenticated());
      setCurrentUserState(AuthService.getCurrentUser());
      setAvailableUsers(AuthService.getUsers());
      setAppEnvironmentState(StorageEngine.getAppEnvironment());
      setActiveTenantState(AuthService.getActiveTenant());
      setImpersonationSessionState(StorageEngine.getImpersonationSession());
      setAllTenants(TenantService.getAll());
    });
    return unsub;
  }, []);

  // Securely resolve active employee record for the authenticated user within the active tenant scope
  const activeTenantId = StorageEngine.getActiveTenantId();
  let currentEmployee = currentUser.employeeId ? EmployeeService.getById(currentUser.employeeId) : undefined;
  if (!currentEmployee && currentUser.email) {
    currentEmployee = EmployeeService.getAll().find(
      e => e.email?.toLowerCase() === currentUser.email?.toLowerCase()
    );
  }

  // Fallback employee representation so every authenticated profile/designation has Check-In available
  if (!currentEmployee && currentUser && currentUser.id) {
    const names = (currentUser.fullName || 'User').split(' ');
    currentEmployee = {
      id: currentUser.employeeId || currentUser.id,
      employeeCode: (currentUser as any).employeeCode || `EMP-${currentUser.id.slice(-4).toUpperCase()}`,
      organizationId: currentUser.organizationId || activeTenantId || 'NP-000006',
      branchId: 'branch-delhi-01',
      departmentId: 'dept-hr-02',
      designationId: 'desig-01',
      firstName: names[0] || 'User',
      lastName: names.slice(1).join(' ') || '',
      email: currentUser.email || 'user@hrms.local',
      phone: (currentUser as any).phone || '+91 98000 00000',
      dob: '1990-01-01',
      gender: 'Other',
      joiningDate: '2024-01-01',
      employmentType: 'Full-time',
      employmentStatus: 'Active',
      noticePeriodDays: 30,
      assignedShiftId: 'shift-gen-01',
      salaryStructure: {} as any,
      bankDetails: {} as any,
      statutoryDetails: {} as any,
      emergencyContact: {} as any,
      documents: [],
      avatarUrl: currentUser.avatar || '/avatar.png',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const roles = AuthService.getRoles();
  const userRole = roles.find(r => r.name === currentUser.roleName || r.id === currentUser.roleId);

  const clearAuthError = () => setAuthError(null);

  const switchUser = (userId: string) => {
    const u = AuthService.setCurrentUser(userId);
    setCurrentUserState(u);
    StorageEngine.setAuthenticated(true);
    setIsAuthenticatedState(true);

    // Securely align tenant to authenticated user's organizationId
    if (u.organizationId && u.organizationId !== 'NP-000001' && u.roleName !== 'Super Admin') {
      const t = TenantService.getById(u.organizationId);
      if (t) {
        setActiveTenantState(t);
        StorageEngine.setActiveTenantId(t.tenantId);
      }
    }
  };

  const setAppEnvironment = (env: 'super_admin' | 'client') => {
    StorageEngine.setAppEnvironment(env);
    setAppEnvironmentState(env);
  };

  const setActiveTenantId = (tenantId: string) => {
    const t = AuthService.setActiveTenant(tenantId);
    setActiveTenantState(t);
  };

  const loginAsClient = (tenantId: string, reason: string = 'Super Admin Administrative Access') => {
    const { session, clientUser } = AuthService.loginAsClient(tenantId, currentUser, reason);
    setImpersonationSessionState(session);
    setCurrentUserState(clientUser);
    StorageEngine.setAuthenticated(true);
    setIsAuthenticatedState(true);
    setAppEnvironmentState('client');
    const t = AuthService.getActiveTenant();
    setActiveTenantState(t);
  };

  const exitAdminMode = () => {
    AuthService.exitAdminMode('user-001');
    setImpersonationSessionState(null);
    setAppEnvironmentState('super_admin');
    setCurrentUserState(AuthService.getCurrentUser());
    setActiveTenantState(AuthService.getActiveTenant());
  };

  const signIn = async (
    email: string,
    password?: string,
    hostContext?: any
  ): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const res = await SupabaseAuthService.signIn(email, password);

      if (!res.success || !res.user) {
        setAuthError(res.message || 'Invalid credentials.');
        return { success: false, message: res.message || 'Invalid credentials.' };
      }

      const userRoleName =
        res.user.role === 'super_admin'
          ? 'Super Admin'
          : res.user.role === 'client_admin'
          ? 'HR Admin'
          : res.user.role === 'manager'
          ? 'Manager'
          : 'Employee';

      const isUserSuperAdmin =
        res.user.role === 'super_admin' || userRoleName === 'Super Admin';

      // 1. Platform Mode Check (makemypayroll.com)
      if (hostContext && hostContext.mode === 'platform') {
        if (!isUserSuperAdmin) {
          const errMsg = 'Super Admin privileges required. Client organization users must log in at their dedicated subdomain portal.';
          setAuthError(errMsg);
          return { success: false, message: errMsg };
        }
      }

      // 2. Tenant Subdomain Mode Check (ignite.makemypayroll.com or /t/:tenantId)
      if (hostContext && (hostContext.mode === 'tenant' || hostContext.mode === 'legacy')) {
        const targetTenant = hostContext.tenant;
        if (targetTenant && !isUserSuperAdmin) {
          const userOrg = res.user.tenantId;
          const isMatch =
            userOrg &&
            (userOrg === targetTenant.tenantId ||
             userOrg === targetTenant.id ||
             (targetTenant.slug && userOrg.toLowerCase() === targetTenant.slug.toLowerCase()) ||
             (targetTenant.subdomain && userOrg.toLowerCase() === targetTenant.subdomain.toLowerCase()));

          if (!isMatch) {
            const errMsg = 'Unauthorized Organization Access: Your account does not belong to this organization.';
            setAuthError(errMsg);
            return { success: false, message: errMsg };
          }
        }
      }

      // Build User Object
      const u: User = {
        id: res.user.id,
        organizationId: res.user.tenantId,
        employeeId: res.user.employeeId || `emp-${res.user.id}`,
        email: res.user.email,
        fullName: res.user.fullName,
        roleId: `role-${res.user.role}`,
        roleName: userRoleName,
        avatar: res.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        status: 'active',
      };

      setCurrentUserState(u);
      StorageEngine.set(STORAGE_KEYS.CURRENT_USER_ID, u.id);
      StorageEngine.setAuthenticated(true);
      setIsAuthenticatedState(true);

      if (res.tenant) {
        setActiveTenantState(res.tenant);
        StorageEngine.setActiveTenantId(res.tenant.tenantId);
      }

      if (isUserSuperAdmin && (!hostContext || hostContext.mode === 'platform')) {
        setAppEnvironment('super_admin');
      } else {
        setAppEnvironment('client');
      }

      return { success: true };
    } catch (err: any) {
      const errMsg = err.message || 'Authentication error';
      setAuthError(errMsg);
      return { success: false, message: errMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await SupabaseAuthService.signOut();
    } finally {
      StorageEngine.setAuthenticated(false);
      setIsAuthenticatedState(false);
      setImpersonationSessionState(null);
      StorageEngine.setImpersonationSession(null);
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    return SupabaseAuthService.resetPassword(email);
  };

  const updatePassword = async (newPassword: string) => {
    return SupabaseAuthService.updatePassword(newPassword);
  };

  const can = (module: string, action: keyof PermissionSet): boolean => {
    if (currentUser.roleName === 'Super Admin') return true;
    return AuthService.hasPermission(module, action, currentUser.roleName);
  };

  const isSuperAdmin =
    currentUser.roleName === 'Super Admin' ||
    currentUser.roleId === 'role-super-admin' ||
    (currentUser as any).role === 'super_admin';
  const isClientAdmin = isSuperAdmin || currentUser.roleName === 'HR Admin' || currentUser.roleName === 'Payroll Admin' || currentUser.roleName === 'IT Admin';
  const isHR = isSuperAdmin || currentUser.roleName === 'HR Admin' || currentUser.roleName === 'HR Executive';
  const isManager = isSuperAdmin || isHR || currentUser.roleName === 'Manager' || currentUser.roleName === 'Team Leader';
  const isEmployee = currentUser.roleName === 'Employee';
  const isImpersonating = !!impersonationSession;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentEmployee,
        userRole,
        availableUsers,
        switchUser,
        can,
        isAuthenticated,
        isLoading,
        authError,
        clearAuthError,
        isSuperAdmin,
        isClientAdmin,
        isHR,
        isManager,
        isEmployee,
        appEnvironment,
        setAppEnvironment,
        activeTenant,
        setActiveTenantId,
        allTenants,
        impersonationSession,
        loginAsClient,
        exitAdminMode,
        isImpersonating,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        isSupabaseActive: isSupabaseConfigured(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
