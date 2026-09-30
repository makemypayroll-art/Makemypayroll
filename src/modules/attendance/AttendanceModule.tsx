// MODULE 3: Attendance Management & Manual Attendance Redesign
import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Clock,
  Fingerprint,
  Plus,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  MapPin,
  Users,
  Save,
  Check,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { AttendanceService } from '../../services/attendanceService';
import { EmployeeService } from '../../services/employeeService';
import { ShiftService } from '../../services/shiftService';
import { GeoLocationService } from '../../services/geoLocationService';
import { Attendance, AttendanceStatus, AttendanceRegularization, Employee } from '../../database/schema';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Table, Column } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { exportToExcel } from '../../utils/exportUtils';
import { formatDate, formatDurationMinutes } from '../../utils/dateUtils';
import { StorageEngine } from '../../database/storageEngine';

export const AttendanceModule: React.FC = () => {
  const { currentUser, currentEmployee, isSuperAdmin, isHR, isManager, isEmployee } = useAuth();
  const { departments, branches } = useOrganization();
  const [dataVersion, setDataVersion] = useState(0);

  const [activeTab, setActiveTab] = useState<'daily' | 'manual' | 'regularizations' | 'biometric'>('daily');
  const [selectedDate, setSelectedDate] = useState('2026-09-21');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Attendance Grid State
  const [manualDate, setManualDate] = useState(selectedDate);
  const [manualDeptFilter, setManualDeptFilter] = useState('all');
  const [manualSearch, setManualSearch] = useState('');
  const [manualStatusMap, setManualStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [manualNotesMap, setManualNotesMap] = useState<Record<string, string>>({});
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // Modals & GPS
  const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [isGpsLocating, setIsGpsLocating] = useState(false);

  const [punchForm, setPunchForm] = useState({
    employeeId: currentEmployee?.id || 'emp-001',
    type: 'IN' as 'IN' | 'OUT',
    time: '09:00:00',
    source: 'ADMIN_MANUAL' as any,
  });

  const [regForm, setRegForm] = useState({
    date: selectedDate,
    requestedCheckIn: '09:00:00',
    requestedCheckOut: '18:00:00',
    requestedStatus: 'Present' as AttendanceStatus,
    reason: '',
  });

  useEffect(() => {
    const unsub = StorageEngine.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsub;
  }, []);

  const allAttendance = AttendanceService.getAll();
  const allEmployees = EmployeeService.getAll();
  const shifts = ShiftService.getShifts();
  const regularizations = AttendanceService.getRegularizations();

  // Scope employees for manual attendance:
  // Managers see only direct reports; HR/Admin/SuperAdmin see full organization workforce
  let eligibleEmployees = allEmployees.filter(e => e.employmentStatus === 'Active');
  if (isManager && !isHR && !isSuperAdmin && currentEmployee) {
    eligibleEmployees = eligibleEmployees.filter(e => e.reportingManagerId === currentEmployee.id || e.id === currentEmployee.id);
  }

  // Populate manual status map when manual date changes or attendance updates
  useEffect(() => {
    const recordsForDate = AttendanceService.getByDate(manualDate);
    const initialMap: Record<string, AttendanceStatus> = {};
    const initialNotes: Record<string, string> = {};

    eligibleEmployees.forEach(emp => {
      const rec = recordsForDate.find(r => r.employeeId === emp.id);
      if (rec) {
        initialMap[emp.id] = rec.status;
        if (rec.notes) initialNotes[emp.id] = rec.notes;
      }
    });

    setManualStatusMap(initialMap);
    setManualNotesMap(initialNotes);
  }, [manualDate, dataVersion]);

  const todayStr = new Date().toISOString().split('T')[0];
  const myTodayAttendance = currentEmployee
    ? allAttendance.find(a => a.employeeId === currentEmployee.id && (a.date === todayStr || a.date === selectedDate))
    : undefined;

  const hasClockedIn = !!myTodayAttendance?.checkIn;
  const hasClockedOut = !!myTodayAttendance?.checkOut;

  // Filter daily attendance records
  let filteredRecords = allAttendance.filter(a => a.date === selectedDate);
  if (statusFilter !== 'all') {
    filteredRecords = filteredRecords.filter(a => a.status === statusFilter);
  }
  if (isEmployee && !isHR && !isSuperAdmin && !isManager && currentEmployee) {
    filteredRecords = filteredRecords.filter(a => a.employeeId === currentEmployee.id);
  } else if (isManager && !isHR && !isSuperAdmin && currentEmployee) {
    filteredRecords = filteredRecords.filter(a => {
      const emp = EmployeeService.getById(a.employeeId);
      return emp?.reportingManagerId === currentEmployee.id || emp?.id === currentEmployee.id;
    });
  }
  if (searchQuery) {
    filteredRecords = filteredRecords.filter(a => {
      const emp = EmployeeService.getById(a.employeeId);
      const name = `${emp?.firstName} ${emp?.lastName}`.toLowerCase();
      return name.includes(searchQuery.toLowerCase()) || emp?.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  // --- Handlers ---

  const handleStandardPunch = (type: 'IN' | 'OUT') => {
    if (!currentEmployee) {
      alert('No employee profile available.');
      return;
    }
    try {
      AttendanceService.recordPunch({
        employeeId: currentEmployee.id,
        type,
        source: 'WEB',
        location: { lat: 28.6280, lng: 77.3649, inGeofence: true, address: 'Web Workspace Check-In' },
        markedBy: currentUser.fullName,
      });
      alert(`Successfully recorded Check-${type} for today!`);
    } catch (err: any) {
      alert(err.message || `Failed to record Check-${type}`);
    }
  };

  const handleGpsPunch = (type: 'IN' | 'OUT') => {
    if (!currentEmployee) return;
    if (!navigator.geolocation) {
      handleStandardPunch(type);
      return;
    }
    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const verification = GeoLocationService.verifyGeofence(lat, lng);

        try {
          AttendanceService.recordPunch({
            employeeId: currentEmployee.id,
            type,
            source: 'MOBILE',
            location: {
              lat,
              lng,
              inGeofence: verification.isAuthorized,
              address: verification.nearestBranch?.name || 'Mobile GPS Clock-In',
              distanceFromOfficeMeters: verification.distanceMeters,
            },
            markedBy: currentUser.fullName,
          });

          alert(
            `Check-${type} recorded successfully via GPS!\n\n` +
            `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}\n` +
            `Geofence: ${verification.isAuthorized ? '✓ Inside Office Perimeter' : '⚠ Remote / Outside Geofence'}`
          );
        } catch (err: any) {
          alert(err.message || `Failed to record Check-${type}`);
        }
      },
      (err) => {
        setIsGpsLocating(false);
        alert(`Location permission required for location-based attendance/tracking (${err.message}). Recording standard web check-${type.toLowerCase()}.`);
        handleStandardPunch(type);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleSaveManualAttendance = () => {
    const entriesToSave = Object.entries(manualStatusMap).map(([empId, status]) => ({
      employeeId: empId,
      status,
      notes: manualNotesMap[empId] || undefined,
    }));

    if (entriesToSave.length === 0) {
      alert('Please select attendance status for at least one employee.');
      return;
    }

    const res = AttendanceService.saveManualAttendanceBatch({
      date: manualDate,
      entries: entriesToSave,
      user: {
        id: currentUser.id,
        name: currentUser.fullName,
        role: currentUser.roleName,
      },
    });

    setManualSuccessMsg(`Successfully saved attendance for ${res.count} employee(s) on ${formatDate(manualDate)}!`);
    setTimeout(() => setManualSuccessMsg(null), 4000);
  };

  const handleMarkAllPresent = () => {
    const newMap = { ...manualStatusMap };
    filteredManualEmployees.forEach(emp => {
      newMap[emp.id] = 'Present';
    });
    setManualStatusMap(newMap);
  };

  // Filtered employees for manual attendance table
  const filteredManualEmployees = eligibleEmployees.filter(e => {
    const matchesDept = manualDeptFilter === 'all' || e.departmentId === manualDeptFilter;
    const name = `${e.firstName} ${e.lastName}`.toLowerCase();
    const code = e.employeeCode.toLowerCase();
    const matchesSearch = !manualSearch || name.includes(manualSearch.toLowerCase()) || code.includes(manualSearch.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const attendanceColumns: Column<Attendance>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (att) => {
        const emp = EmployeeService.getById(att.employeeId);
        return (
          <div className="flex items-center gap-3">
            <img src={emp?.avatarUrl || '/avatar.png'} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
            <div>
              <div className="font-bold text-slate-900">{emp?.firstName} {emp?.lastName}</div>
              <div className="text-xs text-slate-400 font-mono">{emp?.employeeCode}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'timing',
      header: 'Punches (In / Out)',
      render: (att) => (
        <div>
          <div className="font-mono text-xs font-bold text-slate-900">
            {att.checkIn ? att.checkIn : '—'} ➔ {att.checkOut ? att.checkOut : '—'}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Source: <span className="font-mono font-bold text-brand-700">{att.punchSource || 'WEB'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Work Duration',
      render: (att) => (
        <div>
          <div className="text-xs font-bold text-slate-800">
            {formatDurationMinutes(att.workDurationMinutes)}
          </div>
          {att.lateMinutes > 0 && (
            <span className="text-[10px] font-bold text-rose-600">
              Late by {att.lateMinutes}m
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Attendance Status',
      render: (att) => {
        const mapVariant: any = {
          'Present': 'present',
          'Absent': 'absent',
          'Half-Day': 'halfday',
          'Late Arrival': 'late',
          'Leave': 'leave',
          'Work From Home': 'wfh',
          'Weekly Off': 'default',
        };
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={mapVariant[att.status] || 'default'}>{att.status}</Badge>
            {att.isRegularized && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Regularized
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'markedBy',
      header: 'Recorded By',
      render: (att) => (
        <div className="text-xs text-slate-600">
          <div className="font-semibold">{att.markedBy || 'System / Biometric'}</div>
          {att.lastEditedBy && (
            <div className="text-[10px] text-amber-700 font-medium">Edited by {att.lastEditedBy}</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-2xl w-fit overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5 inline mr-1.5" />
            Daily Attendance Log
          </button>
          
          {(isSuperAdmin || isHR || isManager) && (
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 inline mr-1.5 text-brand-600" />
              Manual Attendance Grid
            </button>
          )}

          <button
            onClick={() => setActiveTab('regularizations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'regularizations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 inline mr-1.5" />
            Regularization Requests ({regularizations.filter(r => r.status === 'pending').length})
          </button>
          
          <button
            onClick={() => setActiveTab('biometric')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'biometric' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 inline mr-1.5" />
            Biometric Hardware Gateway
          </button>
        </div>

        {/* Global Check-In / Check-Out Lifecycle Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {!hasClockedIn ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={() => handleStandardPunch('IN')}
                leftIcon={<CalendarCheck className="w-4 h-4" />}
                className="font-extrabold shadow-md"
              >
                CHECK IN
              </Button>
              <Button
                size="sm"
                variant="outline"
                isLoading={isGpsLocating}
                onClick={() => handleGpsPunch('IN')}
                leftIcon={<MapPin className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                GPS In
              </Button>
            </div>
          ) : !hasClockedOut ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-1.5 rounded-xl">
              <span className="text-xs font-extrabold text-emerald-900 px-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Checked In: {myTodayAttendance.checkIn}
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleStandardPunch('OUT')}
                leftIcon={<Clock className="w-4 h-4" />}
                className="font-extrabold"
              >
                CHECK OUT
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Checked Out: {myTodayAttendance.checkIn} ➔ {myTodayAttendance.checkOut}</span>
              <Badge variant="success">✓ {formatDurationMinutes(myTodayAttendance.workDurationMinutes)}</Badge>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsRegModalOpen(true)}
            leftIcon={<Clock className="w-4 h-4" />}
          >
            Regularize
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = filteredRecords.map(a => {
                const emp = EmployeeService.getById(a.employeeId);
                return {
                  'Date': a.date,
                  'Employee Code': emp?.employeeCode || 'N/A',
                  'Employee Name': `${emp?.firstName} ${emp?.lastName}`,
                  'Check In': a.checkIn || '—',
                  'Check Out': a.checkOut || '—',
                  'Status': a.status,
                  'Work Duration': formatDurationMinutes(a.workDurationMinutes),
                  'Source': a.punchSource,
                  'Marked By': a.markedBy || 'System',
                };
              });
              exportToExcel(`Attendance_Report_${selectedDate}.xlsx`, 'Daily Attendance', rows);
            }}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export
          </Button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: DAILY ATTENDANCE LOG                                   */}
      {/* ============================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="Present">Present</option>
                  <option value="Late Arrival">Late Arrival</option>
                  <option value="Half-Day">Half-Day</option>
                  <option value="Leave">Leave</option>
                  <option value="Weekly Off">Weekly Off</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none w-56"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>

          <Table
            columns={attendanceColumns}
            data={filteredRecords}
            keyExtractor={a => a.id}
            pageSize={10}
            emptyMessage="No attendance records found for the selected date and filters."
          />
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: MANUAL ATTENDANCE GRID (REDESIGNED)                     */}
      {/* ============================================================= */}
      {activeTab === 'manual' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-700" />
                  <span>Manual Attendance Register</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct list-based attendance entry for field, factory, and non-biometric personnel.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMarkAllPresent}
                  leftIcon={<Check className="w-4 h-4 text-emerald-600" />}
                >
                  Mark All Present (P)
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveManualAttendance}
                  leftIcon={<Save className="w-4 h-4" />}
                  className="font-extrabold shadow-md"
                >
                  SAVE ATTENDANCE
                </Button>
              </div>
            </div>

            {/* Filter controls: Date, Department, Search */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={e => setManualDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Department</label>
                <select
                  value={manualDeptFilter}
                  onChange={e => setManualDeptFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Search Employee</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name or code..."
                    value={manualSearch}
                    onChange={e => setManualSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none"
                  />
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                </div>
              </div>
            </div>

            {manualSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{manualSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Employee Attendance List Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-4 text-center">
                      <div className="font-mono text-slate-800">Attendance Options</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                        AB • P • WO • L • Late • HD
                      </div>
                    </th>
                    <th className="py-3 px-4">Status & Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredManualEmployees.map(emp => {
                    const selectedStatus = manualStatusMap[emp.id];
                    const existingRecord = allAttendance.find(a => a.employeeId === emp.id && a.date === manualDate);
                    const dept = departments.find(d => d.id === emp.departmentId);

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Employee Identity */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={emp.avatarUrl || '/avatar.png'}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-extrabold text-slate-900">{emp.firstName} {emp.lastName}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {dept?.name || 'General'}
                        </td>

                        {/* Segmented Radio Controls (AB, P, WO, L, Late, HD) */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                            {[
                              { label: 'AB', status: 'Absent' as AttendanceStatus, color: 'text-rose-700 hover:bg-rose-100 active:bg-rose-200', activeBg: 'bg-rose-600 text-white font-extrabold shadow-xs' },
                              { label: 'P', status: 'Present' as AttendanceStatus, color: 'text-emerald-700 hover:bg-emerald-100', activeBg: 'bg-emerald-600 text-white font-extrabold shadow-xs' },
                              { label: 'WO', status: 'Weekly Off' as AttendanceStatus, color: 'text-slate-700 hover:bg-slate-200', activeBg: 'bg-slate-600 text-white font-extrabold shadow-xs' },
                              { label: 'L', status: 'Leave' as AttendanceStatus, color: 'text-purple-700 hover:bg-purple-100', activeBg: 'bg-purple-600 text-white font-extrabold shadow-xs' },
                              { label: 'Late', status: 'Late Arrival' as AttendanceStatus, color: 'text-amber-700 hover:bg-amber-100', activeBg: 'bg-amber-600 text-white font-extrabold shadow-xs' },
                              { label: 'HD', status: 'Half-Day' as AttendanceStatus, color: 'text-sky-700 hover:bg-sky-100', activeBg: 'bg-sky-600 text-white font-extrabold shadow-xs' },
                            ].map(opt => {
                              const isChecked = selectedStatus === opt.status;
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => {
                                    setManualStatusMap(prev => ({ ...prev, [emp.id]: opt.status }));
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    isChecked ? opt.activeBg : `text-slate-600 hover:bg-white`
                                  }`}
                                  title={`Mark ${opt.status}`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* Status & Indicator */}
                        <td className="py-3 px-4">
                          {existingRecord ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Recorded: {existingRecord.status}
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Source: {existingRecord.punchSource || 'WEB'}
                              </div>
                            </div>
                          ) : selectedStatus ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Selected: {selectedStatus} (Unsaved)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Not marked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredManualEmployees.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs">
                No eligible employees match the current filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: REGULARIZATION REQUESTS                                */}
      {/* ============================================================= */}
      {activeTab === 'regularizations' && (
        <Card title="Attendance Regularization Workflow" subtitle="Employee-initiated exception and miss-punch adjustments">
          <Table
            columns={[
              {
                key: 'emp',
                header: 'Employee',
                render: (r) => {
                  const emp = EmployeeService.getById(r.employeeId);
                  return (
                    <div>
                      <div className="font-bold text-slate-900">{emp?.firstName} {emp?.lastName}</div>
                      <div className="text-xs text-slate-400 font-mono">{emp?.employeeCode}</div>
                    </div>
                  );
                },
              },
              { key: 'date', header: 'Date', render: (r) => <span className="font-mono text-xs">{r.date}</span> },
              {
                key: 'requested',
                header: 'Requested Timings',
                render: (r) => (
                  <div className="font-mono text-xs">
                    {r.requestedCheckIn} ➔ {r.requestedCheckOut} ({r.requestedStatus})
                  </div>
                ),
              },
              { key: 'reason', header: 'Reason', render: (r) => <span className="text-xs text-slate-600">{r.reason}</span> },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>
                    {r.status}
                  </Badge>
                ),
              },
              {
                key: 'action',
                header: 'Action',
                render: (r) => {
                  if (r.status !== 'pending') return <span className="text-xs text-slate-400">Resolved</span>;
                  if (!isSuperAdmin && !isHR && !isManager) return <span className="text-xs text-slate-400">Pending Review</span>;
                  return (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => {
                          AttendanceService.approveRegularization(r.id, currentEmployee?.id || 'emp-001', true);
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          AttendanceService.approveRegularization(r.id, currentEmployee?.id || 'emp-001', false);
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            data={regularizations}
            keyExtractor={r => r.id}
            pageSize={10}
            emptyMessage="No pending regularization requests."
          />
        </Card>
      )}

      {/* ============================================================= */}
      {/* TAB 4: BIOMETRIC HARDWARE GATEWAY                             */}
      {/* ============================================================= */}
      {activeTab === 'biometric' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
          <Card title="Biometric Cloud Gateway" subtitle="Direct real-time TCP/IP integration with physical biometric devices">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Main Office Gate Terminal (ZKTeco ProFace)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-400/30">
                    ONLINE
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-400">IP: 192.168.1.200 • Port: 4370 • Protocol: ADMS Cloud Push</div>
                <div className="text-xs text-slate-300">Synchronized Punches Today: <span className="font-bold text-white">42 records</span></div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Plant & Factory Gate Terminal (Essl SilkBio)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-400/30">
                    ONLINE
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-400">IP: 192.168.2.150 • Port: 4370 • Protocol: Push SDK</div>
                <div className="text-xs text-slate-300">Synchronized Punches Today: <span className="font-bold text-white">18 records</span></div>
              </div>
            </div>
          </Card>

          <Card title="Hardware Gateway Status" subtitle="Continuous heartbeat and zero data loss buffer">
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span>Polling Frequency</span>
                <span className="font-bold font-mono">Real-time Webhook Push</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span>Total Terminals Configured</span>
                <span className="font-bold font-mono">2 Units</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span>Biometric Data Buffer</span>
                <span className="font-bold font-mono text-emerald-600">0 Pending (100% Synced)</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span>Last Gateway Sync</span>
                <span className="font-bold font-mono">Just now (Auto-refresh)</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Regularization Modal */}
      {isRegModalOpen && (
        <Modal
          isOpen={isRegModalOpen}
          onClose={() => setIsRegModalOpen(false)}
          title="Apply for Attendance Regularization"
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!currentEmployee) return;
              AttendanceService.submitRegularization({
                employeeId: currentEmployee.id,
                date: regForm.date,
                requestedCheckIn: regForm.requestedCheckIn,
                requestedCheckOut: regForm.requestedCheckOut,
                requestedStatus: regForm.requestedStatus,
                reason: regForm.reason,
              });
              setIsRegModalOpen(false);
              alert('Regularization request submitted successfully.');
            }}
            className="space-y-4"
          >
            <Input
              label="Date"
              type="date"
              value={regForm.date}
              onChange={e => setRegForm({ ...regForm, date: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Requested Check-In"
                type="time"
                value={regForm.requestedCheckIn}
                onChange={e => setRegForm({ ...regForm, requestedCheckIn: e.target.value })}
                required
              />
              <Input
                label="Requested Check-Out"
                type="time"
                value={regForm.requestedCheckOut}
                onChange={e => setRegForm({ ...regForm, requestedCheckOut: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reason for Adjustment</label>
              <textarea
                value={regForm.reason}
                onChange={e => setRegForm({ ...regForm, reason: e.target.value })}
                rows={3}
                placeholder="Explain the reason for regularization (e.g. biometric reader failure, client meeting, outdoor duty)..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs outline-none focus:border-brand-500"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsRegModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Submit Regularization</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
