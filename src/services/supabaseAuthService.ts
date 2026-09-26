// ====================================================================
// NovaPulse HRMS — Supabase Multi-Tenant Authentication & RBAC Service
// ====================================================================
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import { Tenant, User, TenantStatus } from '../database/schema';
import { AuditService } from './auditService';

export interface TenantUserProfile {
  id: string;
  authUserId?: string;
  tenantId: string;
  employeeId?: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'client_admin' | 'manager' | 'employee';
  avatarUrl?: string;
  status: string;
  tenant?: Tenant;
}

export class SupabaseAuthService {
  /**
   * Authenticate user with Email & Password
   */
  public static async signIn(email: string, password?: string): Promise<{
    success: boolean;
    user?: TenantUserProfile;
    tenant?: Tenant;
    isAccountOnHold?: boolean;
    message?: string;
  }> {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, message: 'Please enter your email or user ID.' };
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password || 'NovaPulse@2026',
        });

        if (error) {
          AuditService.log({
            organizationId: 'NP-000001',
            userName: cleanEmail,
            userRole: 'Anonymous',
            module: 'Authentication',
            action: 'LOGIN_FAILED',
            description: `Authentication failed for ${cleanEmail}: ${error.message}`,
          });
          return { success: false, message: 'Invalid credentials. Please verify your email and password.' };
        }

        const authUser = data.user;
        if (!authUser) {
          AuditService.log({
            organizationId: 'NP-000001',
            userName: cleanEmail,
            userRole: 'Anonymous',
            module: 'Authentication',
            action: 'LOGIN_FAILED',
            description: `Authentication failed for ${cleanEmail}: User record not found`,
          });
          return { success: false, message: 'Authentication failed: User record not found.' };
        }

        // Fetch tenant user profile from user_profiles table
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*, tenants(*)')
          .eq('auth_user_id', authUser.id)
          .single();

        if (profileError || !profile) {
          AuditService.log({
            organizationId: 'NP-000001',
            userName: cleanEmail,
            userRole: 'Anonymous',
            module: 'Authentication',
            action: 'LOGIN_FAILED',
            description: `Profile missing for authenticated auth_user_id ${authUser.id}`,
          });
          return {
            success: false,
            message: 'User profile or tenant association not found in database.',
          };
        }

        const tenantData = profile.tenants;
        const isOnHold = ['ON_HOLD', 'SUSPENDED', 'CANCELLED'].includes(tenantData?.status);

        AuditService.log({
          organizationId: profile.tenant_id,
          tenantId: profile.tenant_id,
          userId: profile.id,
          userName: profile.full_name,
          userRole: profile.role,
          module: 'Authentication',
          action: 'LOGIN_SUCCESS',
          description: `User ${profile.email} authenticated successfully for tenant ${profile.tenant_id} (Status: ${tenantData?.status || 'ACTIVE'})`,
        });

        return {
          success: true,
          user: {
            id: profile.id,
            authUserId: authUser.id,
            tenantId: profile.tenant_id,
            employeeId: profile.employee_id,
            email: profile.email,
            fullName: profile.full_name,
            role: profile.role,
            avatarUrl: profile.avatar_url,
            status: profile.status,
            tenant: tenantData,
          },
          tenant: tenantData,
          isAccountOnHold: isOnHold,
        };
      } catch (err: any) {
        return { success: false, message: 'Authentication error occurred. Please try again.' };
      }
    }

    // Local / Offline Simulation Mode
    const users = StorageEngine.getList<User>(STORAGE_KEYS.USERS);
    const tenants = StorageEngine.getList<Tenant>(STORAGE_KEYS.TENANTS);

    const matchedUser = users.find(
      u =>
        u.email.toLowerCase() === cleanEmail ||
        u.id.toLowerCase() === cleanEmail ||
        (cleanEmail === 'admin@novapulse.co.in' && (u.roleName === 'Super Admin' || u.id === 'user-001')) ||
        (cleanEmail === 'admin' && (u.roleName === 'Super Admin' || u.id === 'user-001'))
    );

    if (!matchedUser) {
      AuditService.log({
        organizationId: 'NP-000001',
        userName: cleanEmail,
        userRole: 'Anonymous',
        module: 'Authentication',
        action: 'LOGIN_FAILED',
        description: `Authentication failed for ${cleanEmail}: Account not found`,
      });
      return {
        success: false,
        message: 'Invalid credentials. Please verify your email and password.',
      };
    }

    const matchedTenant = tenants.find(
      t => t.tenantId === matchedUser.organizationId || t.id === matchedUser.organizationId
    ) || tenants[0];

    const roleMap: Record<string, 'super_admin' | 'client_admin' | 'manager' | 'employee'> = {
      'Super Admin': 'super_admin',
      'HR Admin': 'client_admin',
      'Manager': 'manager',
      'Team Leader': 'manager',
      'Employee': 'employee',
      'Payroll Admin': 'client_admin',
    };

    const isHold = ['ON_HOLD', 'SUSPENDED', 'CANCELLED'].includes(matchedTenant.status);

    AuditService.log({
      organizationId: matchedTenant.tenantId,
      tenantId: matchedTenant.tenantId,
      userId: matchedUser.id,
      userName: matchedUser.fullName,
      userRole: matchedUser.roleName,
      module: 'Authentication',
      action: 'LOGIN_SUCCESS',
      description: `User ${matchedUser.email} authenticated successfully for tenant ${matchedTenant.tenantId} (Status: ${matchedTenant.status})`,
    });

    return {
      success: true,
      user: {
        id: matchedUser.id,
        tenantId: matchedTenant.tenantId,
        employeeId: matchedUser.employeeId,
        email: matchedUser.email,
        fullName: matchedUser.fullName,
        role: roleMap[matchedUser.roleName] || 'employee',
        avatarUrl: matchedUser.avatar,
        status: matchedUser.status,
        tenant: matchedTenant,
      },
      tenant: matchedTenant,
      isAccountOnHold: isHold,
    };
  }

  /**
   * Get Current Supabase Auth Session
   */
  public static async getSession(): Promise<any | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase.auth.getSession();
        return data.session;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Sign out current user
   */
  public static async signOut(): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Supabase sign out error:', err);
      }
    }
    AuditService.log({
      organizationId: StorageEngine.getActiveTenantId(),
      module: 'Authentication',
      action: 'LOGOUT',
      description: 'User successfully signed out of session',
    });
  }

  /**
   * Send Password Reset Request
   */
  public static async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Please provide a valid email address.' };
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) {
        return { success: false, message: error.message };
      }
      AuditService.log({
        organizationId: StorageEngine.getActiveTenantId(),
        userName: cleanEmail,
        userRole: 'Anonymous',
        module: 'Authentication',
        action: 'PASSWORD_RESET_REQUEST',
        description: `Password reset link requested for ${cleanEmail}`,
      });
      return { success: true, message: `Password reset link sent to ${cleanEmail}.` };
    }

    AuditService.log({
      organizationId: StorageEngine.getActiveTenantId(),
      userName: cleanEmail,
      userRole: 'Anonymous',
      module: 'Authentication',
      action: 'PASSWORD_RESET_REQUEST',
      description: `Password reset link requested for ${cleanEmail} (Simulation Mode)`,
    });

    return {
      success: true,
      message: `Password reset link sent to ${cleanEmail}. Check your inbox to set a new password.`,
    };
  }

  /**
   * Update password for authenticated user
   */
  public static async updatePassword(newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters long.' };
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, message: error.message };
      }
    }

    AuditService.log({
      organizationId: StorageEngine.getActiveTenantId(),
      module: 'Authentication',
      action: 'PASSWORD_CHANGED',
      description: 'User password was updated securely',
    });

    return { success: true, message: 'Password updated successfully.' };
  }

  /**
   * Create Tenant Administrator during Client Provisioning
   */
  public static async createTenantAdmin(params: {
    tenantId: string;
    companyName: string;
    adminName: string;
    adminEmail: string;
    adminPhone?: string;
  }): Promise<{ success: boolean; user?: TenantUserProfile; message?: string }> {
    if (isSupabaseConfigured()) {
      try {
        // Sign up with Supabase Auth
        const tempPassword = `NovaPulse@${Math.floor(100000 + Math.random() * 900000)}`;
        const { data, error } = await supabase.auth.signUp({
          email: params.adminEmail,
          password: tempPassword,
          options: {
            data: {
              full_name: params.adminName,
              tenant_id: params.tenantId,
              role: 'client_admin',
            },
          },
        });

        if (error) {
          return { success: false, message: error.message };
        }

        // Insert into user_profiles table
        const { data: profile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            auth_user_id: data.user?.id,
            tenant_id: params.tenantId,
            email: params.adminEmail,
            full_name: params.adminName,
            role: 'client_admin',
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${params.adminName}`,
            status: 'active',
          })
          .select()
          .single();

        if (insertError) {
          return { success: false, message: insertError.message };
        }

        return {
          success: true,
          user: {
            id: profile.id,
            authUserId: data.user?.id,
            tenantId: params.tenantId,
            email: params.adminEmail,
            fullName: params.adminName,
            role: 'client_admin',
            status: 'active',
          },
        };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    // Local Storage Fallback
    const newUser: User = {
      id: `user-adm-${params.tenantId.toLowerCase()}`,
      organizationId: params.tenantId,
      employeeId: `emp-adm-${params.tenantId.toLowerCase()}`,
      email: params.adminEmail,
      fullName: params.adminName,
      roleId: 'role-hr-admin',
      roleName: 'HR Admin',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${params.adminName}`,
      status: 'active',
    };

    StorageEngine.insert<User>(STORAGE_KEYS.USERS, newUser);

    return {
      success: true,
      user: {
        id: newUser.id,
        tenantId: params.tenantId,
        employeeId: newUser.employeeId,
        email: newUser.email,
        fullName: newUser.fullName,
        role: 'client_admin',
        status: 'active',
      },
    };
  }
}
