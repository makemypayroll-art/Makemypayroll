// ====================================================================
// NovaPulse / MakeMyPayroll — Portal X: Admin Control Panel
// Dedicated Super Admin Platform Workspace (admin.makemypayroll.com)
// ====================================================================

import React, { useState } from 'react';
import { SuperAdminLayout } from '../../admin/layouts/SuperAdminLayout';
import { SuperAdminDashboard } from '../../admin/dashboard/SuperAdminDashboard';
import { ClientManagement } from '../../admin/clients/ClientManagement';
import { SubscriptionManagement } from '../../admin/subscriptions/SubscriptionManagement';
import { PlanManagement } from '../../admin/plans/PlanManagement';
import { LicenceManagement } from '../../admin/licences/LicenceManagement';
import { PaymentManagement } from '../../admin/payments/PaymentManagement';
import { AuditLogViewer } from '../../admin/audit/AuditLogViewer';
import { AdminUserManagement } from '../../admin/users/AdminUserManagement';
import { SaaSSettings } from '../../admin/settings/SaaSSettings';
import { TicketModule } from '../../modules/ticket-management/TicketModule';

export const AdminPortal: React.FC = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <SuperAdminDashboard onNavigate={setActiveSection} />;
      case 'clients':
        return (
          <ClientManagement
            isCreateModalOpenExternal={isCreateClientOpen}
            onCloseCreateModalExternal={() => setIsCreateClientOpen(false)}
          />
        );
      case 'subscriptions':
        return <SubscriptionManagement />;
      case 'plans':
        return <PlanManagement />;
      case 'licences':
        return <LicenceManagement />;
      case 'payments':
        return <PaymentManagement />;
      case 'support':
        return <TicketModule />;
      case 'audit':
        return <AuditLogViewer />;
      case 'users':
        return <AdminUserManagement />;
      case 'settings':
        return <SaaSSettings />;
      default:
        return <SuperAdminDashboard onNavigate={setActiveSection} />;
    }
  };

  return (
    <SuperAdminLayout
      activeSection={activeSection}
      setActiveSection={setActiveSection}
      onOpenCreateClient={() => {
        setActiveSection('clients');
        setIsCreateClientOpen(true);
      }}
    >
      {renderSectionContent()}
    </SuperAdminLayout>
  );
};
