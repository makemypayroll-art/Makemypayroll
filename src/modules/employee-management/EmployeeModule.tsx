// MODULE 5: Centralized Employee Master & Lifecycle Management
import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  Edit2,
  Trash2,
  Building,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  FileText,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { EmployeeService } from '../../services/employeeService';
import { PayrollCycleService } from '../../services/payroll/payrollCycleService';
import { AttendancePolicyService } from '../../services/payroll/attendancePolicyService';
import { Employee, EmploymentStatus } from '../../database/schema';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Table, Column } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { exportToExcel } from '../../utils/exportUtils';
import { formatDate, formatCurrencyINR } from '../../utils/dateUtils';
import { StorageEngine } from '../../database/storageEngine';

export const EmployeeModule: React.FC = () => {
  const { currentUser, isSuperAdmin, isHR, isManager, activeTenant } = useAuth();
  const { departments, designations, branches, activeBranchId } = useOrganization();
  const [dataVersion, setDataVersion] = useState(0);

  const activeCycles = PayrollCycleService.getAll(activeTenant?.tenantId).filter(c => c.status === 'Active');
  const activePolicies = AttendancePolicyService.getAll(activeTenant?.tenantId).filter(p => p.status === 'Active');

  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Form State
  const [empForm, setEmpForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    personalEmail: '',
    dob: '1995-01-01',
    gender: 'Male' as const,
    departmentId: '',
    designationId: '',
    branchId: '',
    reportingManagerId: '',
    payrollCycleId: activeCycles[0]?.id || 'cycle-001',
    attendancePolicyId: activePolicies[0]?.id || 'pol-001',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: 'Full-time' as const,
    employmentStatus: 'Active' as EmploymentStatus,
    grossSalary: 60000,
    bankAccount: '',
    bankName: 'HDFC Bank',
    ifscCode: 'HDFC0000123',
    pan: 'ABCDE1234F',
    aadhaar: 'XXXX-XXXX-1234',
    uan: '100982348192',
  });

  useEffect(() => {
    const unsub = StorageEngine.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsub;
  }, []);

  let employees = EmployeeService.getAll();
  if (activeBranchId !== 'all') {
    employees = employees.filter(e => e.branchId === activeBranchId);
  }
  if (deptFilter !== 'all') {
    employees = employees.filter(e => e.departmentId === deptFilter);
  }
  if (statusFilter !== 'all') {
    employees = employees.filter(e => e.employmentStatus === statusFilter);
  }
  if (searchQuery) {
    employees = employees.filter(e => {
      const q = searchQuery.toLowerCase();
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      return name.includes(q) || e.employeeCode.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    });
  }

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();

    if (!empForm.payrollCycleId) {
      alert('Payroll Cycle is a mandatory field. Please select an active Payroll Cycle.');
      return;
    }

    if (!empForm.attendancePolicyId) {
      alert('Attendance Policy is a mandatory field. Please select an active Attendance Policy.');
      return;
    }

    const gross = Number(empForm.grossSalary) || 50000;
    const basic = Math.round(gross * 0.5);
    const hra = Math.round(gross * 0.25);
    const conv = 4000;
    const special = Math.max(0, gross - (basic + hra + conv));

    const nextNum = 1000 + EmployeeService.getAll().length + 1;
    const employeeCode = `NP-${nextNum}`;

    EmployeeService.create({
      employeeCode,
      organizationId: StorageEngine.getActiveTenantId(),
      branchId: empForm.branchId || branches[0]?.id || 'branch-delhi-01',
      departmentId: empForm.departmentId || departments[0]?.id || 'dept-eng-01',
      designationId: empForm.designationId || designations[0]?.id || 'desig-08',
      reportingManagerId: empForm.reportingManagerId || undefined,
      payrollCycleId: empForm.payrollCycleId,
      attendancePolicyId: empForm.attendancePolicyId,
      firstName: empForm.firstName,
      lastName: empForm.lastName,
      email: empForm.email,
      phone: empForm.phone,
      personalEmail: empForm.personalEmail,
      dob: empForm.dob,
      gender: empForm.gender,
      joiningDate: empForm.joiningDate,
      employmentType: empForm.employmentType,
      employmentStatus: empForm.employmentStatus,
      noticePeriodDays: 30,
      assignedShiftId: 'shift-gen-01',
      salaryStructure: {
        basicSalary: basic,
        hra: hra,
        conveyanceAllowance: conv,
        specialAllowance: special,
        medicalAllowance: 3000,
        otherAllowances: 0,
        grossSalary: gross,
        ctc: Math.round(gross * 13.2),
      },
      bankDetails: {
        accountHolderName: `${empForm.firstName} ${empForm.lastName}`,
        accountNumber: empForm.bankAccount || '918000000000',
        bankName: empForm.bankName,
        ifscCode: empForm.ifscCode,
        branchName: 'Main Branch',
      },
      statutoryDetails: {
        pan: empForm.pan,
        aadhaar: empForm.aadhaar,
        uan: empForm.uan,
        pfEligible: true,
        esiEligible: false,
        professionalTaxState: 'Uttar Pradesh',
      },
      emergencyContact: {
        name: 'Family Contact',
        relationship: 'Family',
        phone: empForm.phone,
      },
      documents: [],
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${empForm.firstName}`,
    });

    setIsCreateModalOpen(false);
    alert(`Employee created successfully with ID ${employeeCode}!`);
  };

  const handleExportEmployees = () => {
    const rows = employees.map(e => {
      const dept = departments.find(d => d.id === e.departmentId);
      const desig = designations.find(d => d.id === e.designationId);
      const branch = branches.find(b => b.id === e.branchId);
      return {
        'Employee ID': e.employeeCode,
        'Full Name': `${e.firstName} ${e.lastName}`,
        'Official Email': e.email,
        'Phone': e.phone,
        'Department': dept?.name || '—',
        'Designation': desig?.title || '—',
        'Branch Location': branch?.name || '—',
        'Joining Date': e.joiningDate,
        'Status': e.employmentStatus,
        'Gross Salary': e.salaryStructure.grossSalary,
      };
    });
    exportToExcel('NovaPulse_Employee_Master.xlsx', 'Employees', rows);
  };

  const employeeColumns: Column<Employee>[] = [
    {
      key: 'employee',
      header: 'Employee Profile',
      render: (emp) => (
        <div className="flex items-center gap-3">
          <img src={emp.avatarUrl} alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200" />
          <div>
            <div className="font-extrabold text-sm text-slate-900">{emp.firstName} {emp.lastName}</div>
            <div className="text-xs text-slate-400 font-mono">{emp.employeeCode} • {emp.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department & Role',
      render: (emp) => {
        const dept = departments.find(d => d.id === emp.departmentId);
        const desig = designations.find(d => d.id === emp.designationId);
        return (
          <div>
            <div className="text-xs font-bold text-slate-800">{desig?.title || '—'}</div>
            <div className="text-[11px] text-slate-500">{dept?.name || '—'}</div>
          </div>
        );
      },
    },
    {
      key: 'branch',
      header: 'Branch & Joining',
      render: (emp) => {
        const branch = branches.find(b => b.id === emp.branchId);
        return (
          <div>
            <div className="text-xs font-semibold text-slate-700">{branch?.city || 'Noida'}</div>
            <div className="text-[11px] text-slate-400">Joined {formatDate(emp.joiningDate)}</div>
          </div>
        );
      },
    },
    {
      key: 'payrollPolicy',
      header: 'Payroll & Policy',
      render: (emp) => {
        const cycle = PayrollCycleService.getById(emp.payrollCycleId || '');
        const policy = AttendancePolicyService.getById(emp.attendancePolicyId || '');
        return (
          <div className="space-y-0.5">
            <div className="text-xs font-extrabold text-slate-900">
              {cycle ? (
                <span>{cycle.name.split('(')[0]}</span>
              ) : (
                <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                  Cycle Unassigned
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              {policy ? (
                <span>{policy.name}</span>
              ) : (
                <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                  Policy Unassigned
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (emp) => {
        const mapVariant: any = {
          Active: 'success',
          Probation: 'warning',
          Notice: 'danger',
          Resigned: 'default',
          Terminated: 'danger',
        };
        return <Badge variant={mapVariant[emp.employmentStatus] || 'default'}>{emp.employmentStatus}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (emp) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="p-1.5"
            onClick={() => {
              setSelectedEmp(emp);
              setIsViewModalOpen(true);
            }}
            title="View Full Profile"
          >
            <Eye className="w-4 h-4 text-slate-600 hover:text-brand-800" />
          </Button>
          {(isSuperAdmin || isHR) && (
            <select
              value={emp.employmentStatus}
              onChange={(e) => {
                EmployeeService.updateStatus(emp.id, e.target.value as EmploymentStatus);
                setDataVersion(v => v + 1);
              }}
              className="text-[11px] border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 outline-none"
            >
              <option value="Active">Active</option>
              <option value="Probation">Probation</option>
              <option value="Notice">Notice</option>
              <option value="Resigned">Resigned</option>
              <option value="Terminated">Terminated</option>
            </select>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Employee Directory
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(isSuperAdmin || isHR) && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Add New Employee
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportEmployees}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Directory
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, ID, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none w-full sm:w-64 focus:border-brand-700"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Dept:</span>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Probation">Probation</option>
              <option value="Notice">Notice</option>
              <option value="Resigned">Resigned</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <Table
        columns={employeeColumns}
        data={employees}
        keyExtractor={e => e.id}
        pageSize={10}
        emptyMessage="No employees found matching criteria."
      />

      {/* Add Employee Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Employee Master Record"
        subtitle="Provide employee details, salary structure, and bank information"
        size="xl"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={empForm.firstName}
              onChange={e => setEmpForm({ ...empForm, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={empForm.lastName}
              onChange={e => setEmpForm({ ...empForm, lastName: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Official Email"
              type="email"
              value={empForm.email}
              onChange={e => setEmpForm({ ...empForm, email: e.target.value })}
              required
            />
            <Input
              label="Contact Phone"
              value={empForm.phone}
              onChange={e => setEmpForm({ ...empForm, phone: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Department"
              value={empForm.departmentId}
              onChange={e => setEmpForm({ ...empForm, departmentId: e.target.value })}
              required
            >
              <option value="">-- Choose Dept --</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>

            <Select
              label="Designation"
              value={empForm.designationId}
              onChange={e => setEmpForm({ ...empForm, designationId: e.target.value })}
              required
            >
              <option value="">-- Choose Role --</option>
              {designations.map(d => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </Select>

            <Select
              label="Branch Location"
              value={empForm.branchId}
              onChange={e => setEmpForm({ ...empForm, branchId: e.target.value })}
              required
            >
              <option value="">-- Choose Branch --</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Mandatory Payroll Cycle & Attendance Policy Mapping */}
          <div className="p-4 bg-brand-50/60 rounded-2xl border border-brand-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-600"></span>
              <span className="text-xs font-extrabold text-brand-950 uppercase tracking-wider">
                Mandatory Payroll & Attendance Mapping
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Payroll Cycle *"
                value={empForm.payrollCycleId}
                onChange={e => setEmpForm({ ...empForm, payrollCycleId: e.target.value })}
                required
              >
                <option value="">-- Select Payroll Cycle * --</option>
                {activeCycles.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.startDay}th – {c.endDay}th)
                  </option>
                ))}
              </Select>

              <Select
                label="Attendance Policy *"
                value={empForm.attendancePolicyId}
                onChange={e => setEmpForm({ ...empForm, attendancePolicyId: e.target.value })}
                required
              >
                <option value="">-- Select Attendance Policy * --</option>
                {activePolicies.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.fullDayHours}h Full / {p.halfDayHours}h Half)
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <Input
              label="Gross Monthly Salary (₹)"
              type="number"
              value={empForm.grossSalary}
              onChange={e => setEmpForm({ ...empForm, grossSalary: Number(e.target.value) })}
              required
            />
            <Input
              label="Bank Account Number"
              value={empForm.bankAccount}
              onChange={e => setEmpForm({ ...empForm, bankAccount: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="PAN Number"
              value={empForm.pan}
              onChange={e => setEmpForm({ ...empForm, pan: e.target.value })}
              required
            />
            <Input
              label="Aadhaar Number"
              value={empForm.aadhaar}
              onChange={e => setEmpForm({ ...empForm, aadhaar: e.target.value })}
              required
            />
            <Input
              label="PF UAN (Optional)"
              value={empForm.uan}
              onChange={e => setEmpForm({ ...empForm, uan: e.target.value })}
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Employee Profile Detail Modal */}
      {selectedEmp && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedEmp(null);
          }}
          title={`${selectedEmp.firstName} ${selectedEmp.lastName} — Employee Profile`}
          subtitle={`ID: ${selectedEmp.employeeCode} • ${selectedEmp.employmentStatus}`}
          size="xl"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <img src={selectedEmp.avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border" />
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedEmp.firstName} {selectedEmp.lastName}</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedEmp.email} • {selectedEmp.phone}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="success">{selectedEmp.employmentStatus}</Badge>
                  <span className="text-xs text-slate-500">Joined {formatDate(selectedEmp.joiningDate)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Job & Hierarchy</span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-bold text-slate-900">
                    {departments.find(d => d.id === selectedEmp.departmentId)?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Designation:</span>
                  <span className="font-bold text-slate-900">
                    {designations.find(d => d.id === selectedEmp.designationId)?.title || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Branch:</span>
                  <span className="font-bold text-slate-900">
                    {branches.find(b => b.id === selectedEmp.branchId)?.name || '—'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Payroll & Attendance Policy</span>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Payroll Cycle:</span>
                    {(isSuperAdmin || isHR) ? (
                      <select
                        value={selectedEmp.payrollCycleId || ''}
                        onChange={(e) => {
                          EmployeeService.update(selectedEmp.id, { payrollCycleId: e.target.value });
                          setSelectedEmp({ ...selectedEmp, payrollCycleId: e.target.value });
                          setDataVersion(v => v + 1);
                        }}
                        className="text-xs font-bold text-slate-900 border border-slate-300 rounded-lg px-2 py-1 bg-white outline-none"
                      >
                        <option value="">-- Assign Cycle --</option>
                        {activeCycles.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.startDay}th – {c.endDay}th)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-bold text-slate-900">
                        {PayrollCycleService.getById(selectedEmp.payrollCycleId || '')?.name || 'Unassigned'}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Attendance Policy:</span>
                    {(isSuperAdmin || isHR) ? (
                      <select
                        value={selectedEmp.attendancePolicyId || ''}
                        onChange={(e) => {
                          EmployeeService.update(selectedEmp.id, { attendancePolicyId: e.target.value });
                          setSelectedEmp({ ...selectedEmp, attendancePolicyId: e.target.value });
                          setDataVersion(v => v + 1);
                        }}
                        className="text-xs font-bold text-slate-900 border border-slate-300 rounded-lg px-2 py-1 bg-white outline-none"
                      >
                        <option value="">-- Assign Policy --</option>
                        {activePolicies.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.fullDayHours}h)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-bold text-slate-900">
                        {AttendancePolicyService.getById(selectedEmp.attendancePolicyId || '')?.name || 'Unassigned'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Salary & Compensation</span>
                {(isSuperAdmin || isHR || currentUser.employeeId === selectedEmp.id) ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Monthly:</span>
                      <span className="font-extrabold text-emerald-700">
                        {formatCurrencyINR(selectedEmp.salaryStructure.grossSalary)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Annual CTC:</span>
                      <span className="font-bold text-slate-900">
                        {formatCurrencyINR(selectedEmp.salaryStructure.ctc)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 italic">Confidential salary information restricted by RBAC.</p>
                )}
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Bank & Statutory</span>
                <div className="space-y-1">
                  <div>Bank: <span className="font-bold text-slate-900">{selectedEmp.bankDetails.bankName}</span></div>
                  <div>Account: <span className="font-bold text-slate-900 font-mono">{selectedEmp.bankDetails.accountNumber}</span></div>
                  <div>PAN: <span className="font-bold text-slate-900 font-mono">{selectedEmp.statutoryDetails.pan}</span></div>
                  <div>UAN: <span className="font-bold text-slate-900 font-mono">{selectedEmp.statutoryDetails.uan || '—'}</span></div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
