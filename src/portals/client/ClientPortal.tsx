// ====================================================================
// NovaPulse / MakeMyPayroll — Portal Y: Client HRMS Portal
// Dedicated Multi-Tenant Customer Workspace (*.makemypayroll.com)
// ====================================================================

import React, { useState } from 'react';
import { AppLayout } from '../../layouts/AppLayout';
import { DashboardModule } from '../../modules/dashboard/DashboardModule';
import { ShiftModule } from '../../modules/shift-management/ShiftModule';
import { AttendanceModule } from '../../modules/attendance/AttendanceModule';
import { LeaveModule } from '../../modules/leave-management/LeaveModule';
import { EmployeeModule } from '../../modules/employee-management/EmployeeModule';
import { TicketModule } from '../../modules/ticket-management/TicketModule';
import { OnboardingModule } from '../../modules/onboarding/OnboardingModule';
import { InventoryModule } from '../../modules/inventory-management/InventoryModule';
import { GeoLocationModule } from '../../modules/geo-location/GeoLocationModule';
import { PayrollModule } from '../../modules/payroll/PayrollModule';
import { SettingsModule } from '../../modules/settings/SettingsModule';
import { SetupWizardModal } from '../../components/common/SetupWizardModal';
import { useAuth } from '../../context/AuthContext';

export const ClientPortal: React.FC = () => {
  const { activeTenant } = useAuth();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);

  const renderModuleContent = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule onNavigate={setActiveModule} />;
      case 'shifts':
        return <ShiftModule />;
      case 'attendance':
        return <AttendanceModule />;
      case 'leaves':
        return <LeaveModule />;
      case 'employees':
        return <EmployeeModule />;
      case 'tickets':
        return <TicketModule />;
      case 'onboarding':
        return <OnboardingModule />;
      case 'inventory':
        return <InventoryModule />;
      case 'geolocation':
        return <GeoLocationModule />;
      case 'payroll':
        return <PayrollModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <DashboardModule onNavigate={setActiveModule} />;
    }
  };

  return (
    <AppLayout activeModule={activeModule} setActiveModule={setActiveModule}>
      {renderModuleContent()}

      {/* 10-Step Setup Wizard for New Client Tenants */}
      {activeTenant && !activeTenant.setupCompleted && isSetupWizardOpen && (
        <SetupWizardModal
          isOpen={isSetupWizardOpen}
          onClose={() => setIsSetupWizardOpen(false)}
        />
      )}
    </AppLayout>
  );
};
