// ====================================================================
// MakeMyPayroll by NovaPulse — Public Platform Landing & Entry
// Domain: https://makemypayroll.com
// ====================================================================

import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  ArrowRight,
  Server,
  Lock,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PLATFORM_DOMAIN, getTenantSubdomainUrl } from '../../config/appConfig';
import { TenantService } from '../../services/tenantService';
import { TenantHostService } from '../../services/tenantHostService';
import { normalizeSlug } from '../../services/tenantResolver';

export const PublicLandingPortal: React.FC = () => {
  const { isSuperAdmin, setAppEnvironment } = useAuth();
  const [searchSlug, setSearchSlug] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ found: boolean; tenant?: any; url?: string } | null>(null);

  const extractCandidateSlug = (input: string): string => {
    let clean = input.trim().toLowerCase();
    if (!clean) return '';

    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        const parsed = new URL(clean);
        clean = parsed.hostname;
      } catch {
        clean = clean.replace(/^https?:\/\//, '').split('/')[0];
      }
    } else if (clean.includes('/')) {
      clean = clean.split('/')[0];
    }

    if (clean.includes('.')) {
      const sub = TenantHostService.extractSubdomain(clean);
      if (sub) return sub;
      const parts = clean.split('.');
      if (parts[0]) return normalizeSlug(parts[0]);
    }

    return normalizeSlug(clean);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = extractCandidateSlug(searchSlug);
    if (!candidate) return;

    setIsSearching(true);
    setLookupResult(null);

    try {
      let tenant =
        TenantService.getBySubdomain(candidate) ||
        TenantService.getBySlug(candidate) ||
        TenantService.getById(candidate) ||
        TenantService.getByCode(candidate);

      if (!tenant) {
        tenant = (await TenantService.fetchTenantBySlugFromSupabase(candidate)) || undefined;
      }

      if (tenant) {
        const url = getTenantSubdomainUrl(tenant.slug || candidate);
        setLookupResult({ found: true, tenant, url });
      } else {
        setLookupResult({ found: false });
      }
    } catch (err) {
      console.error('Tenant lookup error:', err);
      setLookupResult({ found: false });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-4 relative z-10 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="MakeMyPayroll" className="h-9 w-auto object-contain" />
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
            SaaS Infrastructure
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <button
              onClick={() => setAppEnvironment('super_admin')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 transition-all cursor-pointer"
            >
              <Server className="w-4 h-4" />
              <span>Admin Control Panel</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="max-w-4xl w-full mx-auto my-auto py-12 text-center space-y-8 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-950 border border-brand-800 text-brand-300 text-xs font-bold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>MakeMyPayroll by NovaPulse • Enterprise HRMS & Payroll</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-2xl mx-auto leading-tight">
            Two-Portal Multi-Tenant SaaS Architecture
          </h1>
        </div>

        {/* Portal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
          {/* Portal X Card */}
          <div className="bg-slate-900/90 border border-purple-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 relative group hover:border-purple-600 transition-all">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-300">
                <Server className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono uppercase font-bold text-purple-400 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800">
                Portal X
              </span>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-white">Admin Control Panel</h3>
            </div>

            <div className="pt-2 border-t border-slate-800 text-xs font-mono text-purple-300">
              admin.{PLATFORM_DOMAIN}
            </div>

            <button
              onClick={() => setAppEnvironment('super_admin')}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <span>Access Admin Panel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Portal Y Card */}
          <div className="bg-slate-900/90 border border-brand-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 relative group hover:border-brand-600 transition-all">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-brand-950 border border-brand-700 flex items-center justify-center text-brand-300">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono uppercase font-bold text-brand-400 px-2 py-0.5 rounded-full bg-brand-950/60 border border-brand-800">
                Portal Y
              </span>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-white">Client HRMS Portal</h3>
            </div>

            <div className="pt-2 border-t border-slate-800 text-xs font-mono text-brand-300">
              &#123;subdomain&#125;.{PLATFORM_DOMAIN}
            </div>

            {/* Subdomain Search Form */}
            <form onSubmit={handleLookup} className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter organization slug (e.g. ignite or silaris)"
                  value={searchSlug}
                  onChange={e => {
                    setSearchSlug(e.target.value);
                    setLookupResult(null);
                  }}
                  className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-brand-400 hover:text-brand-300 disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>

              {isSearching && (
                <div className="text-xs text-slate-400 animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
                  <span>Resolving canonical organization...</span>
                </div>
              )}

              {!isSearching && lookupResult && (
                <div className="text-xs">
                  {lookupResult.found && lookupResult.tenant ? (
                    <a
                      href={lookupResult.url}
                      className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline font-bold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Open {lookupResult.tenant.companyName} Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-rose-400 font-medium">
                      Organization not found. Check spelling or contact your HR.
                    </span>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      </main>

      {/* Security & Isolation Badges */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500 space-y-2 relative z-10">
        <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PostgreSQL Row-Level Security</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Supabase Session Authentication</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-brand-400" />
            <span>Zero Cross-Tenant Data Leakage</span>
          </div>
        </div>
        <p>© {new Date().getFullYear()} MakeMyPayroll by NovaPulse Technologies Pvt. Ltd. All rights reserved.</p>
      </footer>
    </div>
  );
};
