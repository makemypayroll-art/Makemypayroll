// MODULE 1: Centralized HRMS Executive Dashboard
import React, { useState, useEffect } from 'react';
import {
  Users,
  CalendarCheck,
  Clock,
  CalendarDays,
  LifeBuoy,
  FileSpreadsheet,
  Package,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Fingerprint,
  Download,
  CheckSquare,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { EmployeeService } from '../../services/employeeService';
import { AttendanceService } from '../../services/attendanceService';
import { LeaveService } from '../../services/leaveService';
import { ShiftService } from '../../services/shiftService';
import { TicketService } from '../../services/ticketService';
import { InventoryService } from '../../services/inventoryService';
import { OnboardingService } from '../../services/onboardingService';
import { PayrollService } from '../../services/payrollService';
import { TaskService } from '../../services/taskService';
import { StatCard } from '../../components/common/StatCard';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { exportToExcel } from '../../utils/exportUtils';
import { formatDate } from '../../utils/dateUtils';
import { StorageEngine } from '../../database/storageEngine';

const COLORS = ['#6b21a8', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

export const DashboardModule: React.FC<{ onNavigate: (module: string) => void }> = ({ onNavigate }) => {
  const { currentUser, currentEmployee, isSuperAdmin, isHR, isManager, isEmployee } = useAuth();
  const { branches, departments, activeBranchId } = useOrganization();
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const unsub = StorageEngine.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsub;
  }, []);

  // Fetch all current datasets
  let employees = EmployeeService.getAll();
  if (activeBranchId !== 'all') {
    employees = employees.filter(e => e.branchId === activeBranchId);
  }

  const activeEmployees = employees.filter(e => e.employmentStatus === 'Active');
  const inactiveEmployees = employees.filter(e => e.employmentStatus !== 'Active');

  const today = new Date().toISOString().split('T')[0];
  const attendanceStats = AttendanceService.getTodayStats(today);

  const presentCount = attendanceStats.presentCount;
  const lateCount = attendanceStats.lateCount;
  const leaveCount = attendanceStats.leaveCount;
  const halfDayCount = attendanceStats.halfDayCount;
  const absentCount = attendanceStats.absentCount;

  const pendingLeaves = LeaveService.getApplications().filter(a => a.status === 'pending');
  const pendingSwaps = ShiftService.getSwapRequests().filter(s => s.status === 'pending_peer' || s.status === 'peer_accepted');
  const openTickets = TicketService.getAll().filter(t => t.status === 'Open' || t.status === 'In Progress');
  const submittedOnboarding = OnboardingService.getAll().filter(o => o.status === 'submitted');
  const totalAssets = InventoryService.getAll().length;
  const allocatedAssets = InventoryService.getAll().filter(a => a.status === 'Allocated').length;

  // Task Management metrics
  const allTasks = TaskService.getAllTasks();
  const myTasks = currentEmployee ? TaskService.getMyTasks(currentEmployee.id) : allTasks;
  const myPendingTasks = myTasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');
  const myOverdueTasks = myTasks.filter(t => TaskService.isTaskOverdue(t));

  // Chart 1: Department Distribution
  const deptData = departments.map(d => ({
    name: d.name.split(' ')[0],
    value: employees.filter(e => e.departmentId === d.id).length,
  })).filter(d => d.value > 0);

  // Chart 2: Past 7 Days Attendance Trend
  const trendDates = [
    { date: '14 Sep', present: 9, late: 1, leave: 0, absent: 0 },
    { date: '15 Sep', present: 8, late: 0, leave: 1, absent: 1 },
    { date: '16 Sep', present: 8, late: 0, leave: 1, absent: 1 },
    { date: '17 Sep', present: 9, late: 1, leave: 0, absent: 0 },
    { date: '18 Sep', present: 10, late: 0, leave: 0, absent: 0 },
    { date: '21 Sep', present: presentCount || 8, late: lateCount || 2, leave: leaveCount || 1, absent: absentCount || 0 },
  ];

  // Check personal attendance for the currently authenticated employee record for today
  const myTodayAttendance = currentEmployee
    ? AttendanceService.getTodayAttendanceForEmployee(currentEmployee.id, today)
    : undefined;

  const hasClockedIn = !!myTodayAttendance?.checkIn;
  const hasClockedOut = !!myTodayAttendance?.checkOut;

  // Quick Punch Action
  const handleQuickPunch = (type: 'IN' | 'OUT') => {
    if (!currentEmployee) {
      alert('No active employee record is linked to this account.');
      return;
    }
    try {
      AttendanceService.recordPunch({
        employeeId: currentEmployee.id,
        type,
        source: 'WEB',
        location: { lat: 28.6280, lng: 77.3649, inGeofence: true, address: 'NovaPulse HQ' },
      });
      alert(type === 'IN' ? 'Check-In recorded successfully! Active session started.' : 'Check-Out recorded successfully! Shift completed.');
    } catch (err: any) {
      alert(err.message || `Failed to record check-${type.toLowerCase()}`);
    }
  };

  const handleExportSummary = () => {
    const summaryRows = [
      { Metric: 'Total Headcount', Value: employees.length },
      { Metric: 'Active Employees', Value: activeEmployees.length },
      { Metric: 'Today Present', Value: presentCount },
      { Metric: 'Today Late Arrival', Value: lateCount },
      { Metric: 'Today On Leave', Value: leaveCount },
      { Metric: 'Pending Leave Approvals', Value: pendingLeaves.length },
      { Metric: 'Pending Shift Swaps', Value: pendingSwaps.length },
      { Metric: 'Open Helpdesk Tickets', Value: openTickets.length },
      { Metric: 'Assets Allocated Ratio', Value: `${allocatedAssets} / ${totalAssets}` },
    ];
    exportToExcel('NovaPulse_HRMS_Dashboard_Summary.xlsx', 'Executive Summary', summaryRows);
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner & Quick Actions */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-950 via-brand-900 to-purple-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-800/80 border border-brand-700 text-brand-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Workforce Hub • {formatDate(today)}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Welcome back, {currentUser.fullName.split(' ')[0]}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentEmployee ? (
              <div className="bg-white/10 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-white/20 flex items-center gap-2 sm:gap-3">
                {!hasClockedIn && (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleQuickPunch('IN')}
                    leftIcon={<Fingerprint className="w-4 h-4" />}
                    className="font-extrabold shadow-md bg-emerald-600 hover:bg-emerald-700 border-0"
                  >
                    CHECK IN
                  </Button>
                )}

                {hasClockedIn && !hasClockedOut && (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold px-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-emerald-200">Session Active</span>
                      <span className="text-white/60">({myTodayAttendance?.checkIn})</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleQuickPunch('OUT')}
                      className="bg-rose-600 hover:bg-rose-700 text-white border-0 font-extrabold shadow-md"
                      leftIcon={<Clock className="w-4 h-4" />}
                    >
                      CHECK OUT
                    </Button>
                  </>
                )}

                {hasClockedIn && hasClockedOut && (
                  <div className="flex items-center gap-2 px-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-200 font-medium">
                      In: {myTodayAttendance.checkIn} • Out: {myTodayAttendance.checkOut}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-400/30">
                      ✓ Completed ({myTodayAttendance.workHours || 8}h)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 flex items-center gap-2 text-xs text-brand-200">
                <span className="w-2 h-2 rounded-full bg-amber-400/80"></span>
                <span>Administrative Session • No Employee Profile</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSummary}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30"
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export Metrics
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <StatCard
          title="Total Workforce"
          value={activeEmployees.length}
          subtitle={`${inactiveEmployees.length} Inactive / Exited`}
          trend={{ value: '+2 this month', isPositive: true }}
          icon={<Users className="w-6 h-6" />}
          iconBgColor="bg-brand-100 text-brand-800"
          onClick={() => onNavigate('employees')}
        />

        <StatCard
          title="Today's Attendance"
          value={`${presentCount + lateCount} / ${activeEmployees.length}`}
          subtitle={`${lateCount} Late • ${leaveCount} On Leave`}
          trend={{ value: `${Math.round(((presentCount + lateCount) / (activeEmployees.length || 1)) * 100)}% Present`, isPositive: true }}
          icon={<CalendarCheck className="w-6 h-6" />}
          iconBgColor="bg-emerald-100 text-emerald-800"
          onClick={() => onNavigate('attendance')}
        />

        <StatCard
          title="Pending Approvals"
          value={pendingLeaves.length + pendingSwaps.length}
          subtitle={`${pendingLeaves.length} Leaves • ${pendingSwaps.length} Shifts`}
          icon={<Clock className="w-6 h-6" />}
          iconBgColor="bg-amber-100 text-amber-800"
          onClick={() => onNavigate(pendingLeaves.length > 0 ? 'leaves' : 'shifts')}
        />

        <StatCard
          title="Helpdesk Tickets"
          value={openTickets.length}
          subtitle={`${openTickets.filter(t => t.priority === 'High' || t.priority === 'Urgent').length} High Priority`}
          icon={<LifeBuoy className="w-6 h-6" />}
          iconBgColor="bg-sky-100 text-sky-800"
          onClick={() => onNavigate('tickets')}
        />

        <StatCard
          title="My Pending Tasks"
          value={myPendingTasks.length}
          subtitle={myOverdueTasks.length > 0 ? `${myOverdueTasks.length} Overdue SLA` : `${allTasks.filter(t => t.status === 'In Progress').length} Active in Org`}
          icon={<CheckSquare className="w-6 h-6" />}
          iconBgColor="bg-purple-100 text-purple-800"
          onClick={() => onNavigate('tasks')}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Attendance Trend Bar Chart */}
        <div className="lg:col-span-8">
          <Card
            title="Weekly Attendance & Punctuality Trend"
            subtitle="Daily breakdown of on-time, late arrivals, leaves, and absences"
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('attendance')}>
                View Details <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            }
          >
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendDates}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      color: '#fff',
                      border: 'none',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="present" name="Present / On-Time" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late Arrival" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="leave" name="Approved Leave" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Department Breakdown Donut */}
        <div className="lg:col-span-4">
          <Card
            title="Department Distribution"
            subtitle="Staff headcount by department"
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('employees')}>
                Master <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            }
          >
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deptData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {deptData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
              {deptData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-slate-600 truncate">{d.name}:</span>
                  <span className="font-bold text-slate-900">{d.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Action Items & Quick Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Shift Swaps Queue */}
        <Card
          title="Pending Shift Swap Requests"
          subtitle="Requests requiring peer or manager approval"
          action={
            <Button size="sm" variant="ghost" onClick={() => onNavigate('shifts')}>
              Shift Center <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          }
        >
          {pendingSwaps.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No pending shift swap requests at this time.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingSwaps.slice(0, 4).map(swap => {
                const empA = EmployeeService.getById(swap.requesterEmployeeId);
                const empB = EmployeeService.getById(swap.targetEmployeeId);
                return (
                  <div key={swap.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {empA?.firstName} ➔ {empB?.firstName} (Swap on {swap.requesterDate})
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">Reason: {swap.reason}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={swap.status === 'peer_accepted' ? 'warning' : 'info'}>
                        {swap.status === 'peer_accepted' ? 'Manager Review' : 'Peer Pending'}
                      </Badge>
                      {(isSuperAdmin || isManager) && swap.status === 'peer_accepted' && (
                        <Button
                          size="sm"
                          variant="success"
                          className="text-xs px-2.5 py-1"
                          onClick={() => {
                            ShiftService.approveSwapManager(swap.id, currentUser.employeeId, true);
                            setDataVersion(v => v + 1);
                          }}
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Pending Leave Requests Queue */}
        <Card
          title="Pending Leave Applications"
          subtitle="Awaiting reporting manager or HR authorization"
          action={
            <Button size="sm" variant="ghost" onClick={() => onNavigate('leaves')}>
              Leave Hub <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          }
        >
          {pendingLeaves.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No pending leave applications.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingLeaves.slice(0, 4).map(app => {
                const emp = EmployeeService.getById(app.employeeId);
                const leaveType = LeaveService.getLeaveTypeById(app.leaveTypeId);
                return (
                  <div key={app.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {emp?.firstName} {emp?.lastName} ({leaveType?.name})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {app.startDate} to {app.endDate} ({app.totalDays} day{app.totalDays > 1 ? 's' : ''})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isSuperAdmin || isHR || isManager) && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            className="text-xs px-2.5 py-1"
                            onClick={() => {
                              LeaveService.approveLeave(app.id, currentUser.employeeId, true);
                              setDataVersion(v => v + 1);
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="text-xs px-2.5 py-1"
                            onClick={() => {
                              LeaveService.approveLeave(app.id, currentUser.employeeId, false, 'Rejected by manager');
                              setDataVersion(v => v + 1);
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* My Active Tasks Queue */}
        <Card
          title="My Actionable Tasks"
          subtitle="Assigned deliverables & deadlines"
          action={
            <Button size="sm" variant="ghost" onClick={() => onNavigate('tasks')}>
              Task Hub <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          }
        >
          {myPendingTasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              ✓ All assigned tasks completed.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myPendingTasks.slice(0, 4).map(task => {
                const isOverdue = TaskService.isTaskOverdue(task);
                return (
                  <div
                    key={task.id}
                    onClick={() => onNavigate('tasks')}
                    className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 rounded-lg px-1 transition-colors"
                  >
                    <div className="overflow-hidden space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                          {task.taskCode}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {task.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Due: <span className={isOverdue ? 'text-rose-600 font-bold' : 'font-semibold'}>{task.dueDate}</span> • {task.progress}% done
                      </div>
                    </div>
                    <Badge variant={isOverdue ? 'danger' : task.priority === 'Urgent' ? 'danger' : 'info'}>
                      {isOverdue ? 'Overdue' : task.priority}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
