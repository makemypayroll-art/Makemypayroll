// ====================================================================
// MODULE 10: Complete Indian Payroll Processing & Statutory Compliance
// Full Support: PF, ESI, TDS, Loans, Advances, Reimbursements, OT, Encashments, Payslips
// ====================================================================

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Play,
  CheckCircle,
  Download,
  Eye,
  Printer,
  ShieldCheck,
  CreditCard,
  Building,
  TrendingUp,
  AlertCircle,
  Clock,
  Landmark,
  Receipt,
  Coins,
  Percent,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Calendar,
  Check,
  X,
  Sliders,
  DollarSign,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { PayrollService } from '../../services/payrollService';
import { EmployeeService } from '../../services/employeeService';
import { PayrollStatutoryService } from '../../services/payroll/payrollStatutoryService';
import { PayrollLoanService } from '../../services/payroll/payrollLoanService';
import { PayrollAdvanceService } from '../../services/payroll/payrollAdvanceService';
import { PayrollReimbursementService } from '../../services/payroll/payrollReimbursementService';
import { PayrollOvertimeService, PayrollEncashmentService } from '../../services/payroll/payrollOvertimeService';
import { PayrollConfigurationTab } from './components/PayrollConfigurationTab';
import {
  Payslip,
  PayrollPeriod,
  PayrollStatus,
  EmployeeLoan,
  EmployeeAdvance,
  EmployeeReimbursement,
  LeaveEncashmentRecord,
  EmployeeOvertimeRecord,
  PayrollStatutoryConfig,
} from '../../database/schema';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Table, Column } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { exportToExcel } from '../../utils/exportUtils';
import { formatDate, formatCurrencyINR } from '../../utils/dateUtils';
import { StorageEngine } from '../../database/storageEngine';

export const PayrollModule: React.FC = () => {
  const { currentUser, currentEmployee, isSuperAdmin, isHR, isEmployee, activeTenant } = useAuth();
  const { organization } = useOrganization();
  const [dataVersion, setDataVersion] = useState(0);

  // Sub-tabs navigation
  const [activeTab, setActiveTab] = useState<'config' | 'runs' | 'payslips' | 'reports'>('config');
  const [reportsSubTab, setReportsSubTab] = useState<'pf_esi' | 'tds' | 'loans' | 'advances' | 'reimbursements' | 'overtime' | 'settings'>('pf_esi');

  const [selectedMonth, setSelectedMonth] = useState(9); // September
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // Modals state
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [isNewAdvanceOpen, setIsNewAdvanceOpen] = useState(false);
  const [isNewReimbursementOpen, setIsNewReimbursementOpen] = useState(false);
  const [isNewEncashmentOpen, setIsNewEncashmentOpen] = useState(false);

  // New loan form state
  const [loanForm, setLoanForm] = useState({
    employeeId: '',
    loanType: 'Personal Loan' as EmployeeLoan['loanType'],
    principalAmount: 50000,
    tenureMonths: 12,
    interestRate: 0,
    startMonth: '2026-09',
  });

  // New advance form state
  const [advanceForm, setAdvanceForm] = useState({
    employeeId: '',
    advanceAmount: 15000,
    reason: 'Medical / Emergency advance',
    installmentsCount: 3,
  });

  // New reimbursement form state
  const [reimbForm, setReimbForm] = useState({
    employeeId: '',
    expenseType: 'Travel' as EmployeeReimbursement['expenseType'],
    expenseDate: '2026-09-15',
    amount: 3500,
    description: 'Client visit travel & conveyance',
    payoutMethod: 'Payroll' as 'Payroll' | 'Direct Transfer',
  });

  // New encashment form state
  const [encashForm, setEncashForm] = useState({
    employeeId: '',
    leaveTypeId: 'lt-privilege',
    leaveTypeName: 'Privilege Leave',
    encashedDays: 5,
  });

  const tenantId = activeTenant?.tenantId || 'NP-000001';

  useEffect(() => {
    const unsub = StorageEngine.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsub;
  }, []);

  const periodId = `pay-${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
  let payslips = PayrollService.getPayslips(periodId, tenantId);
  const currentPeriod = PayrollService.getPeriodById(periodId);
  const statutoryConfig = PayrollStatutoryService.getConfig(tenantId);
  const activeEmployees = EmployeeService.getAll().filter(
    e => (e.organizationId === tenantId || (e as any).tenantId === tenantId) && e.employmentStatus === 'Active'
  );

  const loans = PayrollLoanService.getAll(tenantId);
  const advances = PayrollAdvanceService.getAll(tenantId);
  const reimbursements = PayrollReimbursementService.getAll(tenantId);
  const overtimeRecords = PayrollOvertimeService.getAll(tenantId);
  const encashments = PayrollEncashmentService.getAll(tenantId);

  // If employee, show only their own data
  if (isEmployee && currentEmployee) {
    payslips = payslips.filter(p => p.employeeId === currentEmployee.id);
  }

  const handleRunPayroll = () => {
    try {
      PayrollService.processMonthlyPayroll({
        month: selectedMonth,
        year: selectedYear,
        processedByUserId: currentUser.id,
        tenantId,
      });
      setDataVersion(v => v + 1);
      alert(`Successfully processed monthly payroll for ${selectedMonth}/${selectedYear}!`);
    } catch (err: any) {
      alert(`Payroll Run Error: ${err.message}`);
    }
  };

  const handleUpdatePeriodStatus = (status: PayrollStatus) => {
    PayrollService.updatePeriodStatus(periodId, status, currentUser.fullName || currentUser.email);
    setDataVersion(v => v + 1);
    alert(`Payroll period status updated to '${status}'!`);
  };

  const handleLockPeriod = () => {
    PayrollService.lockPeriod(periodId, currentUser.fullName || currentUser.email);
    setDataVersion(v => v + 1);
    alert(`Payroll period ${periodId} is now locked and finalized.`);
  };

  const handleReopenPeriod = () => {
    const reason = prompt('Enter reason for reopening locked payroll:', 'Administrative review');
    if (!reason) return;
    PayrollService.reopenPeriod(periodId, currentUser.fullName || currentUser.email, reason);
    setDataVersion(v => v + 1);
    alert(`Payroll period ${periodId} has been reopened.`);
  };

  const handleExportPayroll = () => {
    const rows = payslips.map(p => ({
      'Payslip Ref': p.referenceNumber || p.id,
      'Employee Code': p.employeeCode,
      'Employee Name': p.employeeName,
      'Department': p.departmentName,
      'Designation': p.designationName,
      'Total Working Days': p.totalWorkingDays,
      'Present Days': p.presentDays,
      'LOP Days': p.lopDays,
      'Basic Salary': p.earnings.basicSalary,
      'HRA': p.earnings.hra,
      'Special Allowance': p.earnings.specialAllowance,
      'Overtime Pay': p.earnings.overtimePay,
      'Leave Encashment': p.earnings.leaveEncashment || 0,
      'Reimbursements': p.earnings.reimbursements || 0,
      'Gross Earnings': p.earnings.totalGross,
      'PF (Employee)': p.deductions.pfEmployee,
      'ESI (Employee)': p.deductions.esiEmployee,
      'Professional Tax': p.deductions.professionalTax,
      'TDS / Tax': p.deductions.tds,
      'Loan EMI': p.deductions.loanEmi || 0,
      'Advance Recovery': p.deductions.advanceRecovery || 0,
      'LOP Deduction': p.deductions.lopDeduction,
      'Total Deductions': p.deductions.totalDeductions,
      'Net Payable': p.netSalary,
      'Employer PF': p.employerContributions.pfEmployer,
      'Employer ESI': p.employerContributions.esiEmployer,
      'Status': p.status,
    }));
    exportToExcel(`MakeMyPayroll_Register_${periodId}.xlsx`, 'Payroll Register', rows);
  };

  // Submit New Loan
  const handleSubmitLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = activeEmployees.find(e => e.id === loanForm.employeeId) || activeEmployees[0];
    if (!emp) return;

    PayrollLoanService.createLoan({
      tenantId,
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      loanType: loanForm.loanType,
      principalAmount: Number(loanForm.principalAmount),
      tenureMonths: Number(loanForm.tenureMonths),
      interestRateAnnualPercent: Number(loanForm.interestRate),
      startMonth: loanForm.startMonth,
      requestedBy: currentUser.fullName || currentUser.email,
    });

    setIsNewLoanOpen(false);
    setDataVersion(v => v + 1);
    alert('Employee loan request created successfully!');
  };

  // Submit New Advance
  const handleSubmitAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = activeEmployees.find(e => e.id === advanceForm.employeeId) || activeEmployees[0];
    if (!emp) return;

    PayrollAdvanceService.requestAdvance({
      tenantId,
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      advanceAmount: Number(advanceForm.advanceAmount),
      reason: advanceForm.reason,
      installmentsCount: Number(advanceForm.installmentsCount),
    });

    setIsNewAdvanceOpen(false);
    setDataVersion(v => v + 1);
    alert('Salary advance requested successfully!');
  };

  // Submit Reimbursement
  const handleSubmitReimbursement = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = activeEmployees.find(e => e.id === reimbForm.employeeId) || activeEmployees[0];
    if (!emp) return;

    PayrollReimbursementService.submitClaim({
      tenantId,
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      expenseType: reimbForm.expenseType,
      expenseDate: reimbForm.expenseDate,
      amount: Number(reimbForm.amount),
      description: reimbForm.description,
      payoutMethod: reimbForm.payoutMethod,
    });

    setIsNewReimbursementOpen(false);
    setDataVersion(v => v + 1);
    alert('Reimbursement claim submitted successfully!');
  };

  // Summary Metrics
  const summary = PayrollService.getPayrollSummary(tenantId);
  const isLocked = currentPeriod?.status === 'Finalized';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-950 border border-brand-700 flex items-center justify-center text-brand-300 shadow-inner">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">Payroll Management</h1>
              <Badge variant="success" className="text-[10px] uppercase font-mono tracking-wider">
                India Compliance Ready
              </Badge>
            </div>
          </div>
        </div>

        {/* Period Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-brand-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {[
                { m: 1, name: 'January' }, { m: 2, name: 'February' }, { m: 3, name: 'March' },
                { m: 4, name: 'April' }, { m: 5, name: 'May' }, { m: 6, name: 'June' },
                { m: 7, name: 'July' }, { m: 8, name: 'August' }, { m: 9, name: 'September' },
                { m: 10, name: 'October' }, { m: 11, name: 'November' }, { m: 12, name: 'December' },
              ].map(item => (
                <option key={item.m} value={item.m} className="bg-slate-900 text-white">
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value={2025} className="bg-slate-900 text-white">2025</option>
              <option value={2026} className="bg-slate-900 text-white">2026</option>
              <option value={2027} className="bg-slate-900 text-white">2027</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPayroll}
            className="text-xs font-bold border-slate-700 hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Export Register</span>
          </Button>

          {!isEmployee && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunPayroll}
              disabled={isLocked}
              className="text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5 shadow-md shadow-brand-950"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Monthly Payroll</span>
            </Button>
          )}
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-2 scrollbar-none text-xs font-bold">
        {[
          { id: 'config', label: 'Payroll Configuration', icon: <Sliders className="w-3.5 h-3.5" /> },
          { id: 'runs', label: 'Payroll Processing', icon: <Play className="w-3.5 h-3.5" /> },
          { id: 'payslips', label: 'Payslips', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
          { id: 'reports', label: 'Payroll Reports', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: PAYROLL CONFIGURATION */}
      {activeTab === 'config' && (
        <PayrollConfigurationTab />
      )}

      {/* TAB 2: PAYROLL PROCESSING */}
      {activeTab === 'runs' && (
        <div className="space-y-6">
          {/* Top KPI Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="bg-slate-900 border-slate-800 p-4">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Gross Pay</div>
              <div className="text-lg font-black text-white mt-1">{formatCurrencyINR(currentPeriod?.totalGrossPay || 0)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{currentPeriod?.totalEmployees || 0} Employees</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4">
              <div className="text-[10px] uppercase font-bold text-emerald-400">Total Net Payable</div>
              <div className="text-lg font-black text-emerald-400 mt-1">{formatCurrencyINR(currentPeriod?.totalNetPay || 0)}</div>
              <div className="text-[10px] text-emerald-500/80 mt-0.5">Disbursement</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4">
              <div className="text-[10px] uppercase font-bold text-rose-400">Total Deductions</div>
              <div className="text-lg font-black text-rose-400 mt-1">{formatCurrencyINR(currentPeriod?.totalDeductions || 0)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Statutory + LOP + Loans</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4">
              <div className="text-[10px] uppercase font-bold text-purple-400">Provident Fund (PF)</div>
              <div className="text-lg font-black text-purple-400 mt-1">
                {formatCurrencyINR(payslips.reduce((a, b) => a + (b.deductions.pfEmployee || 0), 0))}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">12% EPF + EPS</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4">
              <div className="text-[10px] uppercase font-bold text-cyan-400">ESI & Taxes (TDS)</div>
              <div className="text-lg font-black text-cyan-400 mt-1">
                {formatCurrencyINR(payslips.reduce((a, b) => a + (b.deductions.esiEmployee + b.deductions.tds), 0))}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">ESI + Monthly TDS</div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4">
              <div className="text-[10px] uppercase font-bold text-amber-400">Loans & Advances</div>
              <div className="text-lg font-black text-amber-400 mt-1">
                {formatCurrencyINR(payslips.reduce((a, b) => a + (b.deductions.loanAdvanceDeduction || 0), 0))}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">EMI Recoveries</div>
            </Card>
          </div>

          {/* Period Status & Locking Workflow Banner */}
          <Card className="bg-slate-900 border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                {isLocked ? <Lock className="w-5 h-5 text-amber-400" /> : <Unlock className="w-5 h-5 text-emerald-400" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Period: {periodId}</h3>
                  <Badge variant={isLocked ? 'danger' : 'success'} className="text-[10px]">
                    {currentPeriod?.status || 'Draft'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentPeriod && !isLocked && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdatePeriodStatus('Under Review')}
                    className="text-xs font-bold"
                  >
                    Mark Under Review
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdatePeriodStatus('Approved')}
                    className="text-xs font-bold border-emerald-800 text-emerald-300"
                  >
                    Approve Payroll
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleLockPeriod}
                    className="text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    <span>Lock & Finalize</span>
                  </Button>
                </>
              )}
              {isLocked && isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReopenPeriod}
                  className="text-xs font-bold border-amber-800 text-amber-300 hover:bg-amber-950"
                >
                  <Unlock className="w-3.5 h-3.5 mr-1" />
                  <span>Reopen Period</span>
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: PAYSLIPS REGISTER */}
      {(activeTab === 'runs' || activeTab === 'payslips') && (
        <Card className="bg-slate-900 border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Payroll Register & Payslips</h3>
            <span className="text-xs font-mono text-slate-400">{payslips.length} Payslips Generated</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Ref & Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Present / LOP</th>
                  <th className="p-3">Gross Earnings</th>
                  <th className="p-3">PF (12%)</th>
                  <th className="p-3">ESI</th>
                  <th className="p-3">TDS</th>
                  <th className="p-3">Loans/Adv</th>
                  <th className="p-3">Total Deductions</th>
                  <th className="p-3">Net Payable</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {payslips.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-white">{p.employeeName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.referenceNumber || p.employeeCode}</div>
                    </td>
                    <td className="p-3">{p.departmentName}</td>
                    <td className="p-3">
                      <div>{p.presentDays}/{p.totalWorkingDays}d</div>
                      {p.lopDays > 0 ? (
                        <span className="text-[10px] text-rose-400 font-bold">{p.lopDays} LOP</span>
                      ) : (
                        <span className="text-[10px] text-emerald-400">0 LOP</span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-white">{formatCurrencyINR(p.earnings.totalGross)}</td>
                    <td className="p-3 text-purple-400">{formatCurrencyINR(p.deductions.pfEmployee)}</td>
                    <td className="p-3 text-cyan-400">{formatCurrencyINR(p.deductions.esiEmployee)}</td>
                    <td className="p-3">{formatCurrencyINR(p.deductions.tds)}</td>
                    <td className="p-3 text-amber-400">{formatCurrencyINR(p.deductions.loanAdvanceDeduction || 0)}</td>
                    <td className="p-3 font-bold text-rose-400">-{formatCurrencyINR(p.deductions.totalDeductions)}</td>
                    <td className="p-3 font-black text-emerald-400 font-mono text-sm">{formatCurrencyINR(p.netSalary)}</td>
                    <td className="p-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPayslip(p)}
                        className="text-[11px] font-bold border-slate-700 hover:bg-slate-800 p-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-brand-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: PAYROLL REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Reports Sub-Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-2 scrollbar-none text-xs font-semibold">
            {[
              { id: 'pf_esi', label: 'PF & ESI Compliance', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
              { id: 'tds', label: 'TDS & Tax Regimes', icon: <Percent className="w-3.5 h-3.5" /> },
              { id: 'loans', label: 'Employee Loans', icon: <Landmark className="w-3.5 h-3.5" /> },
              { id: 'advances', label: 'Salary Advances', icon: <CreditCard className="w-3.5 h-3.5" /> },
              { id: 'reimbursements', label: 'Reimbursements', icon: <Receipt className="w-3.5 h-3.5" /> },
              { id: 'overtime', label: 'Overtime & Encashment', icon: <Clock className="w-3.5 h-3.5" /> },
              { id: 'settings', label: 'Statutory Settings', icon: <Sliders className="w-3.5 h-3.5" /> },
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setReportsSubTab(sub.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  reportsSubTab === sub.id
                    ? 'bg-slate-800 text-white font-bold border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {sub.icon}
                <span>{sub.label}</span>
              </button>
            ))}
          </div>

          {/* Report Sub-Tab: PF & ESI */}
          {reportsSubTab === 'pf_esi' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PF Configuration Card */}
              <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Employees' Provident Fund (EPF & EPS)</h3>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Mandatory Wage Ceiling:</span>
                    <span className="font-mono font-bold text-white">₹{statutoryConfig.pfWageCeiling.toLocaleString('en-IN')} / month</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Employee PF Share:</span>
                    <span className="font-mono font-bold text-purple-400">{statutoryConfig.pfEmployeeRate}% of PF Wage (Basic)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Employer EPS Share:</span>
                    <span className="font-mono font-bold text-emerald-400">{statutoryConfig.pfEmployerEpsRate}% (Max ₹1,250)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Employer EPF Share:</span>
                    <span className="font-mono font-bold text-brand-400">{statutoryConfig.pfEmployerEpfRate}% of PF Wage</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Admin & EDLI Charges:</span>
                    <span className="font-mono font-bold text-slate-400">1.0% (0.5% Admin + 0.5% EDLI)</span>
                  </div>
                </div>
              </Card>

              {/* ESI Configuration Card */}
              <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Employees' State Insurance (ESI)</h3>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Gross Wage Eligibility Ceiling:</span>
                    <span className="font-mono font-bold text-white">₹{statutoryConfig.esiGrossWageThreshold.toLocaleString('en-IN')} / month</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Employee ESI Rate:</span>
                    <span className="font-mono font-bold text-cyan-400">{statutoryConfig.esiEmployeeRate}% of Gross Wages</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Employer ESI Rate:</span>
                    <span className="font-mono font-bold text-emerald-400">{statutoryConfig.esiEmployerRate}% of Gross Wages</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Contribution:</span>
                    <span className="font-mono font-bold text-white">4.0% of Gross Wages</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Report Sub-Tab: TDS */}
          {reportsSubTab === 'tds' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* New Tax Regime */}
              <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-bold text-white">New Tax Regime (Section 115BAC)</h3>
                  </div>
                  <Badge variant="purple">Default</Badge>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        <th className="p-2">Income Slab</th>
                        <th className="p-2 text-right">Tax Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      <tr><td className="p-2">Up to ₹3,00,000</td><td className="p-2 text-right font-mono text-emerald-400">Nil</td></tr>
                      <tr><td className="p-2">₹3,00,001 - ₹7,00,000</td><td className="p-2 text-right font-mono">5%</td></tr>
                      <tr><td className="p-2">₹7,00,001 - ₹10,00,000</td><td className="p-2 text-right font-mono">10%</td></tr>
                      <tr><td className="p-2">₹10,00,001 - ₹12,00,000</td><td className="p-2 text-right font-mono">15%</td></tr>
                      <tr><td className="p-2">₹12,00,001 - ₹15,00,000</td><td className="p-2 text-right font-mono">20%</td></tr>
                      <tr><td className="p-2">Above ₹15,00,000</td><td className="p-2 text-right font-mono text-rose-400">30%</td></tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Old Tax Regime */}
              <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-brand-400" />
                    <h3 className="text-base font-bold text-white">Old Tax Regime with Deductions</h3>
                  </div>
                  <Badge variant="outline">Optional</Badge>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        <th className="p-2">Income Slab</th>
                        <th className="p-2 text-right">Tax Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      <tr><td className="p-2">Up to ₹2,50,000</td><td className="p-2 text-right font-mono text-emerald-400">Nil</td></tr>
                      <tr><td className="p-2">₹2,50,001 - ₹5,00,000</td><td className="p-2 text-right font-mono">5%</td></tr>
                      <tr><td className="p-2">₹5,00,001 - ₹10,00,000</td><td className="p-2 text-right font-mono">20%</td></tr>
                      <tr><td className="p-2">Above ₹10,00,000</td><td className="p-2 text-right font-mono text-rose-400">30%</td></tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Report Sub-Tab: Loans */}
          {reportsSubTab === 'loans' && (
            <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Employee Loan Management</h3>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsNewLoanOpen(true)}
                  className="text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Create Loan</span>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Loan Type</th>
                      <th className="p-3">Principal</th>
                      <th className="p-3">Tenure</th>
                      <th className="p-3">Monthly EMI</th>
                      <th className="p-3">Outstanding</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {loans.map(l => (
                      <tr key={l.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-white">{l.employeeName}</td>
                        <td className="p-3">{l.loanType}</td>
                        <td className="p-3 font-bold">{formatCurrencyINR(l.principalAmount)}</td>
                        <td className="p-3">{l.emisPaidCount}/{l.tenureMonths} Months</td>
                        <td className="p-3 text-amber-400 font-bold">{formatCurrencyINR(l.monthlyEmi)}</td>
                        <td className="p-3 font-mono">{formatCurrencyINR(l.outstandingPrincipal)}</td>
                        <td className="p-3">
                          <Badge variant={l.status === 'Active' ? 'success' : l.status === 'Completed' ? 'purple' : 'warning'}>
                            {l.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {l.status === 'Pending Approval' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                PayrollLoanService.approveAndDisburse(l.id, currentUser.fullName || currentUser.email);
                                setDataVersion(v => v + 1);
                              }}
                              className="text-[10px] font-bold text-emerald-400 border-emerald-800"
                            >
                              Approve & Disburse
                            </Button>
                          )}
                          {l.status === 'Active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                PayrollLoanService.togglePauseDeduction(l.id, true, currentUser.fullName || currentUser.email);
                                setDataVersion(v => v + 1);
                              }}
                              className="text-[10px] font-bold text-amber-400 border-amber-800"
                            >
                              Pause EMI
                            </Button>
                          )}
                          {l.status === 'Paused' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                PayrollLoanService.togglePauseDeduction(l.id, false, currentUser.fullName || currentUser.email);
                                setDataVersion(v => v + 1);
                              }}
                              className="text-[10px] font-bold text-emerald-400 border-emerald-800"
                            >
                              Resume EMI
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Report Sub-Tab: Advances */}
          {reportsSubTab === 'advances' && (
            <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Salary Advance Management</h3>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsNewAdvanceOpen(true)}
                  className="text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Request Advance</span>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Advance Amount</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Monthly Recovery</th>
                      <th className="p-3">Outstanding</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {advances.map(a => (
                      <tr key={a.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-white">{a.employeeName}</td>
                        <td className="p-3 font-bold">{formatCurrencyINR(a.advanceAmount)}</td>
                        <td className="p-3 text-slate-400">{a.reason}</td>
                        <td className="p-3 text-amber-400">{formatCurrencyINR(a.recoveryMonthlyAmount)}/mo ({a.installmentsRecoveredCount}/{a.installmentsCount})</td>
                        <td className="p-3 font-mono font-bold">{formatCurrencyINR(a.outstandingAmount)}</td>
                        <td className="p-3">
                          <Badge variant={a.status === 'Active' || a.status === 'Recovered' ? 'success' : 'warning'}>
                            {a.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          {a.status === 'Pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                PayrollAdvanceService.approveAdvance(a.id, a.advanceAmount, currentUser.fullName || currentUser.email);
                                setDataVersion(v => v + 1);
                              }}
                              className="text-[10px] font-bold text-emerald-400 border-emerald-800"
                            >
                              Approve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Report Sub-Tab: Reimbursements */}
          {reportsSubTab === 'reimbursements' && (
            <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Expense Reimbursements</h3>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsNewReimbursementOpen(true)}
                  className="text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Submit Claim</span>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Expense Type</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Claim Amount</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Payout Method</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Approvals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {reimbursements.map(r => (
                      <tr key={r.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-white">{r.employeeName}</td>
                        <td className="p-3"><Badge variant="outline">{r.expenseType}</Badge></td>
                        <td className="p-3 text-slate-400">{r.expenseDate}</td>
                        <td className="p-3 font-bold text-white">{formatCurrencyINR(r.amount)}</td>
                        <td className="p-3 text-slate-400">{r.description}</td>
                        <td className="p-3 font-mono text-purple-300">{r.payoutMethod}</td>
                        <td className="p-3">
                          <Badge variant={r.status === 'Paid' ? 'success' : r.status === 'Approved' ? 'purple' : 'warning'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          {r.status === 'Submitted' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                PayrollReimbursementService.managerApprove(r.id, currentUser.fullName || currentUser.email);
                                setDataVersion(v => v + 1);
                              }}
                              className="text-[10px] font-bold text-cyan-400 border-cyan-800"
                            >
                              Manager Approve
                            </Button>
                          )}
                          {(r.status === 'Submitted' || r.status === 'Manager Approved') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                PayrollReimbursementService.hrApprove(r.id, r.amount, currentUser.fullName || currentUser.email);
                                setDataVersion(v => v + 1);
                              }}
                              className="text-[10px] font-bold text-emerald-400 border-emerald-800"
                            >
                              Final HR Approve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Report Sub-Tab: Overtime */}
          {reportsSubTab === 'overtime' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Overtime Records */}
              <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
                <h3 className="text-sm font-bold text-white">Overtime Hours & Pay</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">OT Hours</th>
                        <th className="p-2">OT Pay</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {overtimeRecords.map(o => (
                        <tr key={o.id}>
                          <td className="p-2 font-bold text-white">{o.employeeName}</td>
                          <td className="p-2 text-slate-400">{o.date}</td>
                          <td className="p-2 font-bold">{o.otHours}h ({o.multiplier}x)</td>
                          <td className="p-2 text-emerald-400 font-bold">{formatCurrencyINR(o.otAmount)}</td>
                          <td className="p-2"><Badge variant={o.status === 'Processed' ? 'success' : 'warning'}>{o.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Leave Encashments */}
              <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Leave Encashments</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsNewEncashmentOpen(true)}
                    className="text-xs font-bold"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span>Request Encashment</span>
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Leave Type</th>
                        <th className="p-2">Days</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {encashments.map(e => (
                        <tr key={e.id}>
                          <td className="p-2 font-bold text-white">{e.employeeName}</td>
                          <td className="p-2">{e.leaveTypeName}</td>
                          <td className="p-2 font-bold">{e.encashedDays} Days</td>
                          <td className="p-2 text-emerald-400 font-bold">{formatCurrencyINR(e.encashmentAmount)}</td>
                          <td className="p-2"><Badge variant={e.status === 'Processed' ? 'success' : 'warning'}>{e.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Report Sub-Tab: Statutory Settings */}
          {reportsSubTab === 'settings' && (
            <Card className="max-w-3xl mx-auto bg-slate-900 border-slate-800 p-6 space-y-6 shadow-xl">
              <div>
                <h2 className="text-base font-bold text-white">Statutory Rules & Compliance Parameters</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">PF Wage Ceiling (₹)</label>
                  <input
                    type="number"
                    defaultValue={statutoryConfig.pfWageCeiling}
                    onChange={e => PayrollStatutoryService.updateConfig(tenantId, { pfWageCeiling: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">ESI Gross Wage Ceiling (₹)</label>
                  <input
                    type="number"
                    defaultValue={statutoryConfig.esiGrossWageThreshold}
                    onChange={e => PayrollStatutoryService.updateConfig(tenantId, { esiGrossWageThreshold: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Standard Deduction (New Regime ₹)</label>
                  <input
                    type="number"
                    defaultValue={statutoryConfig.standardDeductionNew}
                    onChange={e => PayrollStatutoryService.updateConfig(tenantId, { standardDeductionNew: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Overtime Hourly Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={statutoryConfig.overtimeMultiplier}
                    onChange={e => PayrollStatutoryService.updateConfig(tenantId, { overtimeMultiplier: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/80 text-[11px] text-amber-300 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Statutory rules should be verified by finance and payroll administrators before monthly finalized processing.</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* PAYSLIP DETAIL MODAL */}
      {selectedPayslip && (
        <Modal
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          title={`Payslip Reference: ${selectedPayslip.referenceNumber || selectedPayslip.id}`}
        >
          <div className="space-y-6 text-xs print:p-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-white">{activeTenant?.companyName || 'MakeMyPayroll'}</h2>
                <p className="text-slate-400">{selectedPayslip.branchName} • Payslip for {selectedPayslip.month}/{selectedPayslip.year}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-purple-400 font-bold">{selectedPayslip.referenceNumber}</span>
                <p className="text-[10px] text-slate-500">PAN: {selectedPayslip.pan} • UAN: {selectedPayslip.uan}</p>
              </div>
            </div>

            {/* Attendance Days Grid */}
            <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <div>
                <span className="text-[10px] text-slate-400">Working Days</span>
                <div className="font-bold text-white">{selectedPayslip.totalWorkingDays}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Payment Days</span>
                <div className="font-bold text-emerald-400">{selectedPayslip.paymentDays}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">LOP Days</span>
                <div className="font-bold text-rose-400">{selectedPayslip.lopDays}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">OT Hours</span>
                <div className="font-bold text-cyan-400">{selectedPayslip.overtimeHours}h</div>
              </div>
            </div>

            {/* Earnings & Deductions Breakdown */}
            <div className="grid grid-cols-2 gap-6">
              {/* Earnings */}
              <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white uppercase text-[10px] tracking-wider border-b border-slate-800 pb-1">Earnings</h4>
                <div className="flex justify-between"><span>Basic Salary:</span><span className="font-mono font-bold">{formatCurrencyINR(selectedPayslip.earnings.basicSalary)}</span></div>
                <div className="flex justify-between"><span>HRA:</span><span className="font-mono">{formatCurrencyINR(selectedPayslip.earnings.hra)}</span></div>
                <div className="flex justify-between"><span>Special Allowance:</span><span className="font-mono">{formatCurrencyINR(selectedPayslip.earnings.specialAllowance)}</span></div>
                {selectedPayslip.earnings.overtimePay > 0 && (
                  <div className="flex justify-between text-cyan-400"><span>Overtime Pay:</span><span className="font-mono">+{formatCurrencyINR(selectedPayslip.earnings.overtimePay)}</span></div>
                )}
                {selectedPayslip.earnings.reimbursements && selectedPayslip.earnings.reimbursements > 0 ? (
                  <div className="flex justify-between text-purple-300"><span>Reimbursements:</span><span className="font-mono">+{formatCurrencyINR(selectedPayslip.earnings.reimbursements)}</span></div>
                ) : null}
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold text-white">
                  <span>Gross Earnings:</span>
                  <span className="font-mono text-emerald-400">{formatCurrencyINR(selectedPayslip.earnings.totalGross)}</span>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white uppercase text-[10px] tracking-wider border-b border-slate-800 pb-1">Deductions</h4>
                <div className="flex justify-between"><span>EPF (Employee):</span><span className="font-mono text-purple-400">-{formatCurrencyINR(selectedPayslip.deductions.pfEmployee)}</span></div>
                {selectedPayslip.deductions.esiEmployee > 0 && (
                  <div className="flex justify-between"><span>ESI (Employee):</span><span className="font-mono text-cyan-400">-{formatCurrencyINR(selectedPayslip.deductions.esiEmployee)}</span></div>
                )}
                <div className="flex justify-between"><span>Professional Tax:</span><span className="font-mono">-{formatCurrencyINR(selectedPayslip.deductions.professionalTax)}</span></div>
                <div className="flex justify-between"><span>TDS / Income Tax:</span><span className="font-mono">-{formatCurrencyINR(selectedPayslip.deductions.tds)}</span></div>
                {selectedPayslip.deductions.loanAdvanceDeduction > 0 && (
                  <div className="flex justify-between text-amber-400"><span>Loan/Adv Recovery:</span><span className="font-mono">-{formatCurrencyINR(selectedPayslip.deductions.loanAdvanceDeduction)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold text-white">
                  <span>Total Deductions:</span>
                  <span className="font-mono text-rose-400">-{formatCurrencyINR(selectedPayslip.deductions.totalDeductions)}</span>
                </div>
              </div>
            </div>

            {/* Net Salary Summary */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950 p-4 rounded-xl border border-emerald-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400">Net Payable Salary</span>
                <div className="text-xs text-slate-400 mt-0.5">{selectedPayslip.netSalaryInWords}</div>
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono">
                {formatCurrencyINR(selectedPayslip.netSalary)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                <span>Print Payslip</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => alert(`Downloading Payslip PDF for ${selectedPayslip.employeeName}...`)}
                className="text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>Download PDF</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE LOAN MODAL */}
      {isNewLoanOpen && (
        <Modal isOpen={isNewLoanOpen} onClose={() => setIsNewLoanOpen(false)} title="Create Employee Loan">
          <form onSubmit={handleSubmitLoan} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Select Employee</label>
              <select
                value={loanForm.employeeId}
                onChange={e => setLoanForm({ ...loanForm, employeeId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                required
              >
                <option value="">-- Select Employee --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Loan Type</label>
                <select
                  value={loanForm.loanType}
                  onChange={e => setLoanForm({ ...loanForm, loanType: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Emergency Aid">Emergency Aid</option>
                  <option value="Home / Vehicle Loan">Home / Vehicle Loan</option>
                  <option value="Education Support">Education Support</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Principal Amount (₹)</label>
                <input
                  type="number"
                  value={loanForm.principalAmount}
                  onChange={e => setLoanForm({ ...loanForm, principalAmount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Tenure (Months)</label>
                <input
                  type="number"
                  value={loanForm.tenureMonths}
                  onChange={e => setLoanForm({ ...loanForm, tenureMonths: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Annual Interest Rate (%)</label>
                <input
                  type="number"
                  value={loanForm.interestRate}
                  onChange={e => setLoanForm({ ...loanForm, interestRate: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewLoanOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" className="bg-purple-600 text-white font-bold">Create Loan</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE ADVANCE MODAL */}
      {isNewAdvanceOpen && (
        <Modal isOpen={isNewAdvanceOpen} onClose={() => setIsNewAdvanceOpen(false)} title="Request Salary Advance">
          <form onSubmit={handleSubmitAdvance} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Select Employee</label>
              <select
                value={advanceForm.employeeId}
                onChange={e => setAdvanceForm({ ...advanceForm, employeeId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                required
              >
                <option value="">-- Select Employee --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Advance Amount (₹)</label>
                <input
                  type="number"
                  value={advanceForm.advanceAmount}
                  onChange={e => setAdvanceForm({ ...advanceForm, advanceAmount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Recovery Installments</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={advanceForm.installmentsCount}
                  onChange={e => setAdvanceForm({ ...advanceForm, installmentsCount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Reason</label>
              <textarea
                value={advanceForm.reason}
                onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                rows={2}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewAdvanceOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" className="bg-brand-600 text-white font-bold">Submit Advance</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE REIMBURSEMENT MODAL */}
      {isNewReimbursementOpen && (
        <Modal isOpen={isNewReimbursementOpen} onClose={() => setIsNewReimbursementOpen(false)} title="Submit Expense Reimbursement">
          <form onSubmit={handleSubmitReimbursement} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Select Employee</label>
              <select
                value={reimbForm.employeeId}
                onChange={e => setReimbForm({ ...reimbForm, employeeId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                required
              >
                <option value="">-- Select Employee --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Expense Type</label>
                <select
                  value={reimbForm.expenseType}
                  onChange={e => setReimbForm({ ...reimbForm, expenseType: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  <option value="Travel">Travel / Conveyance</option>
                  <option value="Food">Food / Meals</option>
                  <option value="Medical">Medical Reimbursement</option>
                  <option value="Mobile">Mobile / Phone Bill</option>
                  <option value="Internet">Internet / Broadband</option>
                  <option value="Fuel">Fuel Allowance</option>
                  <option value="Other">Other Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Claim Amount (₹)</label>
                <input
                  type="number"
                  value={reimbForm.amount}
                  onChange={e => setReimbForm({ ...reimbForm, amount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Description / Bill Notes</label>
              <textarea
                value={reimbForm.description}
                onChange={e => setReimbForm({ ...reimbForm, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                rows={2}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewReimbursementOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" className="bg-cyan-600 text-white font-bold">Submit Claim</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* REQUEST LEAVE ENCASHMENT MODAL */}
      {isNewEncashmentOpen && (
        <Modal isOpen={isNewEncashmentOpen} onClose={() => setIsNewEncashmentOpen(false)} title="Request Leave Encashment">
          <form onSubmit={(e) => {
            e.preventDefault();
            const emp = activeEmployees.find(e => e.id === encashForm.employeeId) || activeEmployees[0];
            if (!emp) return;
            const res = PayrollEncashmentService.requestEncashment({
              tenantId,
              employeeId: emp.id,
              employeeName: `${emp.firstName} ${emp.lastName}`,
              leaveTypeId: encashForm.leaveTypeId,
              leaveTypeName: encashForm.leaveTypeName,
              encashedDays: Number(encashForm.encashedDays),
              basicSalary: emp.salaryStructure.basicSalary || 30000,
              grossSalary: emp.salaryStructure.grossSalary || 60000,
            });
            if (res.success) {
              setIsNewEncashmentOpen(false);
              setDataVersion(v => v + 1);
              alert(res.message);
            } else {
              alert(res.message);
            }
          }} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Select Employee</label>
              <select
                value={encashForm.employeeId}
                onChange={e => setEncashForm({ ...encashForm, employeeId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                required
              >
                <option value="">-- Select Employee --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Leave Type</label>
                <select
                  value={encashForm.leaveTypeId}
                  onChange={e => setEncashForm({ ...encashForm, leaveTypeId: e.target.value, leaveTypeName: e.target.options[e.target.selectedIndex].text })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  <option value="lt-privilege">Privilege Leave (Earned)</option>
                  <option value="lt-annual">Annual Leave</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Days to Encash</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={encashForm.encashedDays}
                  onChange={e => setEncashForm({ ...encashForm, encashedDays: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewEncashmentOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" className="bg-brand-600 text-white font-bold">Submit Encashment</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
