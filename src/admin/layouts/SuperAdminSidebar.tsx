import React from 'react';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  KeyRound,
  Receipt,
  LifeBuoy,
  Activity,
  ShieldCheck,
  Settings,
  ChevronRight,
  ExternalLink,
  Sparkles,
  LogOut,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TenantService } from '../../services/tenantService';
import { cn } from '../../utils/cn';

interface SuperAdminSidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({
  activeSection,
  setActiveSection,
  isOpen,
  setIsOpen,
}) => {
  const { currentUser, setAppEnvironment, allTenants, setActiveTenantId, signOut } = useAuth();

  const stats = TenantService.getStats();

  const navigationItems = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      badge: null,
    },
    {
      id: 'clients',
      name: 'Clients & Tenants',
      icon: <Building2 className="w-5 h-5" />,
      badge: `${stats.totalClients}`,
      badgeColor: 'bg-brand-600 text-white',
    },
    {
      id: 'subscriptions',
      name: 'Subscriptions',
      icon: <CreditCard className="w-5 h-5" />,
      badge: stats.trialClients > 0 ? `${stats.trialClients} Trial` : null,
      badgeColor: 'bg-purple-600 text-white',
    },
    {
      id: 'plans',
      name: 'Plans & Features',
      icon: <Layers className="w-5 h-5" />,
      badge: '4 Tiers',
      badgeColor: 'bg-purple-900 text-purple-200',
    },
    {
      id: 'licences',
      name: 'Licence Quotas',
      icon: <KeyRound className="w-5 h-5" />,
      badge: `${stats.utilizationPercent}%`,
      badgeColor: stats.utilizationPercent > 80 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-200',
    },
    {
      id: 'payments',
      name: 'Payments & Billing',
      icon: <Receipt className="w-5 h-5" />,
      badge: stats.overduePayments > 0 ? `${stats.overduePayments} Overdue` : null,
      badgeColor: 'bg-rose-600 text-white',
    },
    {
      id: 'support',
      name: 'Client Support Desk',
      icon: <LifeBuoy className="w-5 h-5" />,
      badge: null,
    },
    {
      id: 'audit',
      name: 'System Activity & Logs',
      icon: <Activity className="w-5 h-5" />,
      badge: null,
    },
    {
      id: 'users',
      name: 'Super Admin Users',
      icon: <ShieldCheck className="w-5 h-5" />,
      badge: null,
    },
    {
      id: 'settings',
      name: 'SaaS Global Settings',
      icon: <Settings className="w-5 h-5" />,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-72 bg-slate-950 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="NovaPulse" className="h-8 w-auto max-w-[140px] object-contain" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/90 text-purple-200 border border-purple-700 font-extrabold tracking-wider uppercase">
              SUPER ADMIN
            </span>
          </div>
        </div>

        {/* Super Admin User Card */}
        <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-900/40">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
            <img
              src={currentUser.avatar}
              alt={currentUser.fullName}
              className="w-9 h-9 rounded-lg object-cover border border-purple-500"
            />
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-bold text-white truncate">{currentUser.fullName}</div>
              <div className="text-[10px] text-purple-300 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                SaaS Administrator
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            SaaS Control Center
          </div>

          {navigationItems.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all group cursor-pointer text-left',
                  isActive
                    ? 'bg-purple-700 text-white shadow-md shadow-purple-950/50 font-bold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'transition-colors',
                      isActive ? 'text-purple-200' : 'text-slate-400 group-hover:text-purple-300'
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
                        item.badgeColor || 'bg-purple-800 text-white'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-purple-200" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer: Switch to Client Panel & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 space-y-2">
          <button
            onClick={() => {
              setActiveTenantId(allTenants[0]?.tenantId || 'NP-000001');
              setAppEnvironment('client');
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-400" />
              <span>Open Client HRMS</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-rose-950/60 hover:border-rose-800/60 border border-slate-700/60 text-slate-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer shadow-xs group"
          >
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-400" />
              <span>Sign Out</span>
            </div>
          </button>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
            <span>NovaPulse SaaS v2.0</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Cluster
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
