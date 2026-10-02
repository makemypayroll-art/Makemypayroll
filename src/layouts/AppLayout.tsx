import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NotificationDrawer } from './NotificationDrawer';
import { BottomNavigation } from './BottomNavigation';
import { AdminModeBanner } from '../components/common/AdminModeBanner';
import { AccountOnHoldScreen } from '../components/common/AccountOnHoldScreen';
import { useAuth } from '../context/AuthContext';

interface AppLayoutProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
  children: React.ReactNode;
}

const MODULE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  shifts: 'Shift Management',
  attendance: 'Attendance Management',
  leaves: 'Leave Management',
  employees: 'Employee Management',
  tickets: 'Ticket Management',
  onboarding: 'Onboarding Master',
  inventory: 'Inventory Management',
  geolocation: 'Geo-Location',
  payroll: 'Payroll Management',
  tasks: 'Task Management',
  insights: 'MMP Insights',
  settings: 'Settings & Administration',
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeModule,
  setActiveModule,
  children,
}) => {
  const { activeTenant, isImpersonating } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  // If customer account is ON_HOLD, SUSPENDED, or CANCELLED, block standard HRMS and show on-hold screen
  if (activeTenant && (activeTenant.status === 'ON_HOLD' || activeTenant.status === 'SUSPENDED' || activeTenant.status === 'CANCELLED')) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {isImpersonating && <AdminModeBanner />}
        <AccountOnHoldScreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Impersonation Banner (if active) */}
      {isImpersonating && <AdminModeBanner />}

      <div className="flex-1 flex">
        {/* Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
          <Topbar
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onOpenNotifications={() => setIsNotifDrawerOpen(true)}
            activeModuleTitle={MODULE_TITLES[activeModule] || 'Dashboard'}
          />

          <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-6 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNavigation
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          onOpenDrawer={() => setIsSidebarOpen(true)}
        />

        {/* Notification Drawer */}
        <NotificationDrawer
          isOpen={isNotifDrawerOpen}
          onClose={() => setIsNotifDrawerOpen(false)}
          onNavigate={setActiveModule}
        />
      </div>
    </div>
  );
};
