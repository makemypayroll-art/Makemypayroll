import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { NotificationProvider } from './context/NotificationContext';
import { AccessDeniedScreen } from './components/common/AccessDeniedScreen';
import { TenantNotFoundScreen } from './components/common/TenantNotFoundScreen';
import { AccountOnHoldScreen } from './components/common/AccountOnHoldScreen';
import { SecurityGateLoading } from './components/common/SecurityGateLoading';
import { LoginScreen } from './components/auth/LoginScreen';
import { TenantHostService } from './services/tenantHostService';
import { AdminPortal } from './portals/admin/AdminPortal';
import { ClientPortal } from './portals/client/ClientPortal';
import { PublicLandingPortal } from './portals/landing/PublicLandingPortal';

export const AppContent: React.FC = () => {
  const {
    appEnvironment,
    activeTenant,
    currentUser,
    setActiveTenantId,
    setAppEnvironment,
    isSuperAdmin,
    isAuthenticated,
    isLoading
  } = useAuth();

  // Centralized Multi-Tenant Hostname & Path Resolution
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentPathname = typeof window !== 'undefined' ? window.location.pathname : '';
  
  const [resolvedTenantContext, setResolvedTenantContext] = React.useState(() =>
    TenantHostService.resolve(currentHostname, currentPathname)
  );
  const [isResolvingAsync, setIsResolvingAsync] = React.useState(false);

  React.useEffect(() => {
    const syncResolution = TenantHostService.resolve(currentHostname, currentPathname);
    setResolvedTenantContext(syncResolution);

    if (syncResolution.status === 'NOT_FOUND' && (syncResolution.subdomain || syncResolution.pathTenantId)) {
      setIsResolvingAsync(true);
      TenantHostService.resolveAsync(currentHostname, currentPathname)
        .then(asyncRes => {
          setResolvedTenantContext(asyncRes);
        })
        .finally(() => {
          setIsResolvingAsync(false);
        });
    }
  }, [currentHostname, currentPathname]);

  // 1. Security Gate Loading state (Auth loading or Async Tenant resolution)
  if (isLoading || isResolvingAsync) {
    return <SecurityGateLoading />;
  }

  // 2. Unknown Subdomain or Invalid /t/ path
  if (resolvedTenantContext.error === 'TENANT_NOT_FOUND' || resolvedTenantContext.status === 'NOT_FOUND') {
    return (
      <TenantNotFoundScreen
        subdomain={resolvedTenantContext.subdomain}
        identifier={resolvedTenantContext.pathTenantId || undefined}
      />
    );
  }

  // 3. Admin Portal Mode (admin.makemypayroll.com or admin.localhost)
  if (resolvedTenantContext.mode === 'admin') {
    if (!isAuthenticated) {
      return <LoginScreen tenantContext={resolvedTenantContext} />;
    }
    if (!isSuperAdmin) {
      return (
        <AccessDeniedScreen
          attemptedTenantId="MakeMyPayroll Admin Control Panel"
          userTenantId={currentUser.organizationId || 'Client User'}
          onGoHome={() => {
            setAppEnvironment('client');
          }}
        />
      );
    }
    return <AdminPortal />;
  }

  // 4. Platform Root Domain Mode (makemypayroll.com)
  if (resolvedTenantContext.mode === 'platform') {
    if (isAuthenticated && isSuperAdmin && appEnvironment === 'super_admin') {
      return <AdminPortal />;
    }
    return <PublicLandingPortal />;
  }

  // 5. Unauthenticated User Gate for Tenant & Development Modes
  if (!isAuthenticated) {
    return <LoginScreen tenantContext={resolvedTenantContext} />;
  }

  // 6. Tenant Context Resolution & Boundary Enforcement (Portal Y / Legacy Route)
  const targetTenant = resolvedTenantContext.tenant;

  if (targetTenant) {
    // Block operational access if tenant account is on hold, suspended, or cancelled
    if (targetTenant.status === 'ON_HOLD' || targetTenant.status === 'SUSPENDED' || targetTenant.status === 'CANCELLED') {
      return <AccountOnHoldScreen />;
    }

    const userOrgId = currentUser.organizationId;
    const isOwnerOfTenant =
      userOrgId &&
      (userOrgId === targetTenant.tenantId ||
       userOrgId === targetTenant.id ||
       (targetTenant.slug && userOrgId.toLowerCase() === targetTenant.slug.toLowerCase()) ||
       (targetTenant.subdomain && userOrgId.toLowerCase() === targetTenant.subdomain.toLowerCase()));

    // Cross-tenant boundary check: If logged in user belongs to Tenant A and attempts to access Tenant B
    if (!isSuperAdmin && userOrgId && !isOwnerOfTenant) {
      return (
        <AccessDeniedScreen
          attemptedTenantId={targetTenant.companyName || targetTenant.tenantId}
          userTenantId={userOrgId}
          onGoHome={() => {
            if (currentUser.organizationId) {
              setActiveTenantId(currentUser.organizationId);
              setAppEnvironment('client');
            }
          }}
        />
      );
    }
  }

  // Sync active tenant in context if needed
  React.useEffect(() => {
    if (targetTenant) {
      const userOrgId = currentUser.organizationId;
      const isAuthorized =
        isSuperAdmin ||
        (userOrgId &&
          (userOrgId === targetTenant.tenantId ||
           userOrgId === targetTenant.id ||
           (targetTenant.slug && userOrgId.toLowerCase() === targetTenant.slug.toLowerCase())));

      if (isAuthorized && activeTenant.tenantId !== targetTenant.tenantId) {
        setActiveTenantId(targetTenant.tenantId);
        setAppEnvironment('client');
      }
    } else if (resolvedTenantContext.mode === 'admin' && isSuperAdmin && appEnvironment !== 'super_admin') {
      setAppEnvironment('super_admin');
    }
  }, [targetTenant?.tenantId, isSuperAdmin, currentUser.organizationId, resolvedTenantContext.mode]);

  // 7. Render appropriate Portal based on appEnvironment & role
  if (appEnvironment === 'super_admin' && isSuperAdmin) {
    return <AdminPortal />;
  }

  return <ClientPortal />;
};

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}
