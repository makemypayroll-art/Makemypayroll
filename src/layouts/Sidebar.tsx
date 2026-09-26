import React from 'react';
import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  CalendarDays,
  Users,
  LifeBuoy,
  UserPlus,
  Package,
  MapPin,
  FileSpreadsheet,
  Settings,
  ChevronRight,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { LeaveService } from '../services/leaveService';
import { ShiftService } from '../services/shiftService';
import { TicketService } from '../services/ticketService';
import { OnboardingService } from '../services/onboardingService';
import { cn } from '../utils/cn';

interface SidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  setActiveModule,
  isOpen,
  setIsOpen,
}) => {
  const { currentUser, can, isSuperAdmin, isHR, isManager, activeTenant, signOut } = useAuth();

  // Dynamic counts for badges
  const pendingLeaves = LeaveService.getApplications().filter(a => a.status === 'pending').length;
  const pendingSwaps = ShiftService.getSwapRequests().filter(
    s => s.status === 'pending_peer' || s.status === 'peer_accepted'
  ).length;
  const openTickets = TicketService.getAll().filter(t => t.status === 'Open' || t.status === 'In Progress').length;
  const submittedOnboarding = OnboardingService.getAll().filter(o => o.status === 'submitted').length;

  const navigationItems = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      moduleKey: 'dashboard',
      badge: null,
    },
    {
      id: 'shifts',
      name: 'Shift Management',
      icon: <Clock className="w-5 h-5" />,
      moduleKey: 'shifts',
      badge: pendingSwaps > 0 ? `${pendingSwaps}` : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'attendance',
      name: 'Attendance',
      icon: <CalendarCheck className="w-5 h-5" />,
      moduleKey: 'attendance',
      badge: null,
    },
    {
      id: 'leaves',
      name: 'Leave Management',
      icon: <CalendarDays className="w-5 h-5" />,
      moduleKey: 'leaves',
      badge: pendingLeaves > 0 ? `${pendingLeaves}` : null,
      badgeColor: 'bg-brand-500 text-white',
    },
    {
      id: 'employees',
      name: 'Employee Master',
      icon: <Users className="w-5 h-5" />,
      moduleKey: 'employees',
      badge: null,
    },
    {
      id: 'tickets',
      name: 'Ticket Management',
      icon: <LifeBuoy className="w-5 h-5" />,
      moduleKey: 'tickets',
      badge: openTickets > 0 ? `${openTickets}` : null,
      badgeColor: 'bg-sky-500 text-white',
    },
    {
      id: 'onboarding',
      name: 'Onboarding Master',
      icon: <UserPlus className="w-5 h-5" />,
      moduleKey: 'onboarding',
      badge: submittedOnboarding > 0 ? `${submittedOnboarding}` : null,
      badgeColor: 'bg-emerald-500 text-white',
    },
    {
      id: 'inventory',
      name: 'Inventory Assets',
      icon: <Package className="w-5 h-5" />,
      moduleKey: 'inventory',
      badge: null,
    },
    {
      id: 'geolocation',
      name: 'Geo-Location & Maps',
      icon: <MapPin className="w-5 h-5" />,
      moduleKey: 'geolocation',
      badge: null,
    },
    {
      id: 'payroll',
      name: 'Payroll Management',
      icon: <FileSpreadsheet className="w-5 h-5" />,
      moduleKey: 'payroll',
      badge: null,
    },
    {
      id: 'insights',
      name: 'MMP Insights',
      icon: <Sparkles className="w-5 h-5 text-purple-400" />,
      moduleKey: 'insights',
      badge: 'AI',
      badgeColor: 'bg-purple-600 text-white font-bold',
    },
    {
      id: 'settings',
      name: 'Settings & Admin',
      icon: <Settings className="w-5 h-5" />,
      moduleKey: 'settings',
      badge: null,
    },
  ];

  // Filter items based on tenant plan enabled modules and user's permissions
  const visibleItems = navigationItems.filter(item => {
    if (activeTenant?.enabledModules && activeTenant.enabledModules.length > 0) {
      if (!activeTenant.enabledModules.includes(item.moduleKey)) return false;
    }
    if (isSuperAdmin) return true;
    return can(item.moduleKey, 'view');
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-72 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src="/logo.png"
              alt="NovaPulse"
              className="h-8 w-auto max-w-[120px] object-contain shrink-0"
            />
            <div className="overflow-hidden">
              <div className="text-[11px] font-extrabold text-white truncate leading-tight">
                {activeTenant?.companyName || 'NovaPulse'}
              </div>
              <div className="text-[10px] text-purple-400 font-mono font-bold truncate">
                {activeTenant?.tenantId || 'NP-000001'}
              </div>
            </div>
          </div>
        </div>

        {/* User Role Card */}
        <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-900/80">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <img
              src={currentUser.avatar}
              alt={currentUser.fullName}
              className="w-9 h-9 rounded-lg object-cover border border-slate-600"
            />
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-bold text-white truncate">{currentUser.fullName}</div>
              <div className="text-[11px] text-brand-300 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {currentUser.roleName}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items (All 11 Modules) */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Navigation Modules
          </div>

          {visibleItems.map(item => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all group cursor-pointer text-left',
                  isActive
                    ? 'bg-brand-800 text-white shadow-md shadow-brand-900/30 font-bold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'transition-colors',
                      isActive ? 'text-brand-200' : 'text-slate-400 group-hover:text-brand-300'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        item.badgeColor || 'bg-brand-700 text-white'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-300" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Support Info & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-rose-950/60 hover:border-rose-800/60 border border-slate-700/60 text-slate-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer shadow-xs group"
          >
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-400" />
              <span>Sign Out</span>
            </div>
          </button>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="font-semibold text-slate-300">NovaPulse</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <i className="fa-solid fa-cloud-bolt text-[10px]"></i> Live Sync
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
