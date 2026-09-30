// MODULE 9: Geo-Location, Geofencing & Workforce Tracking Module
import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Compass,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  Crosshair,
  Shield,
  Layers,
  Navigation,
  Activity,
  History,
  Route,
  Search,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle,
  Clock,
  Calendar,
  Check,
  User,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { GeoLocationService } from '../../services/geoLocationService';
import { AttendanceService } from '../../services/attendanceService';
import { EmployeeService } from '../../services/employeeService';
import {
  OfficeGeoLocation,
  EmployeeGeoTrackingConfig,
  GeoLocationPoint,
  GeoFenceEvent,
  Employee,
} from '../../database/schema';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Table, Column } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { StorageEngine } from '../../database/storageEngine';
import { formatDate } from '../../utils/dateUtils';

export const GeoLocationModule: React.FC = () => {
  const { currentUser, currentEmployee, isSuperAdmin, isHR, isManager } = useAuth();
  const { branches, departments, activeBranchId } = useOrganization();
  const [dataVersion, setDataVersion] = useState(0);

  // Active Tab: 'workforce' | 'live_map' | 'history' | 'geofences'
  const [activeTab, setActiveTab] = useState<'workforce' | 'live_map' | 'history' | 'geofences'>('workforce');

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('emp-004');
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Geofence Creation Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [geoForm, setGeoForm] = useState({
    name: '',
    branchId: 'branch-delhi-01',
    address: '',
    latitude: 28.6280,
    longitude: 77.3649,
    radiusMeters: 250,
    isRestricted: true,
    isActive: true,
  });

  // GPS Simulator / Tester state
  const [testLat, setTestLat] = useState<number>(28.6285);
  const [testLng, setTestLng] = useState<number>(77.3652);
  const [testResult, setTestResult] = useState<any>(null);

  // Simulate new GPS Point modal
  const [isSimulatePointModalOpen, setIsSimulatePointModalOpen] = useState(false);
  const [simPointForm, setSimPointForm] = useState({
    latitude: 28.6145,
    longitude: 77.3530,
    address: 'Sector 60 Metro Station',
    speedKmh: 28,
  });

  useEffect(() => {
    const unsub = StorageEngine.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsub;
  }, []);

  // Data fetching
  let employees = EmployeeService.getAll();
  if (activeBranchId !== 'all') {
    employees = employees.filter(e => e.branchId === activeBranchId);
  }

  // Scoping: Managers see direct reports, SuperAdmin/HR see all
  if (isManager && !isSuperAdmin && !isHR && currentEmployee) {
    employees = employees.filter(e => e.reportingManagerId === currentEmployee.id || e.id === currentEmployee.id);
  }

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'all' || emp.departmentId === deptFilter;
    return matchesSearch && matchesDept;
  });

  const geoLocations = GeoLocationService.getAll();
  const allAttendance = AttendanceService.getAll();
  const today = new Date().toISOString().split('T')[0];

  // Tracking configs map
  const trackingConfigs = GeoLocationService.getTrackingConfigs();

  const handleToggleTracking = (employeeId: string, currentVal: boolean) => {
    try {
      GeoLocationService.updateTrackingConfig(employeeId, {
        isTrackingEnabled: !currentVal,
      }, currentUser.fullName);
    } catch (err: any) {
      alert(err.message || 'Failed to update tracking config');
    }
  };

  const handleToggleGeofencing = (employeeId: string, currentVal: boolean) => {
    try {
      GeoLocationService.updateTrackingConfig(employeeId, {
        isGeofencingEnabled: !currentVal,
      }, currentUser.fullName);
    } catch (err: any) {
      alert(err.message || 'Failed to update geofence config');
    }
  };

  const handleCreateGeo = (e: React.FormEvent) => {
    e.preventDefault();
    GeoLocationService.create({
      organizationId: StorageEngine.getActiveTenantId(),
      ...geoForm,
      latitude: Number(geoForm.latitude),
      longitude: Number(geoForm.longitude),
      radiusMeters: Number(geoForm.radiusMeters),
    });
    setIsAddModalOpen(false);
  };

  const handleTestGeofence = () => {
    const res = GeoLocationService.verifyGeofence(Number(testLat), Number(testLng));
    setTestResult(res);
  };

  const handleSimulateNewPoint = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      GeoLocationService.recordLocationPoint({
        employeeId: selectedEmployeeId,
        latitude: Number(simPointForm.latitude),
        longitude: Number(simPointForm.longitude),
        address: simPointForm.address,
        speedKmh: Number(simPointForm.speedKmh),
        accuracyMeters: 8,
      });
      setIsSimulatePointModalOpen(false);
      alert('New GPS breadcrumb recorded successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to record location point');
    }
  };

  // Selected Employee Details for Map & History
  const selectedEmp = employees.find(e => e.id === selectedEmployeeId) || employees[0];
  const selectedEmpConfig = selectedEmp ? GeoLocationService.getTrackingConfigByEmployee(selectedEmp.id) : null;
  const selectedEmpPointsToday = selectedEmp ? GeoLocationService.getLocationPoints(selectedEmp.id, today) : [];
  const selectedEmpPointsHistory = selectedEmp ? GeoLocationService.getLocationPoints(selectedEmp.id, historyDate) : [];
  const selectedEmpEventsHistory = selectedEmp ? GeoLocationService.getGeoFenceEvents(selectedEmp.id, historyDate) : [];

  const sequentialDistanceToday = GeoLocationService.calculateSequentialDistanceKm(selectedEmpPointsToday);
  const sequentialDistanceHistory = GeoLocationService.calculateSequentialDistanceKm(selectedEmpPointsHistory);
  const latestPoint = selectedEmp ? GeoLocationService.getLatestLocation(selectedEmp.id, today) : null;

  const selectedEmpAttendanceToday = selectedEmp
    ? allAttendance.find(a => a.employeeId === selectedEmp.id && a.date === today)
    : null;

  // TAB 1: Workforce Tracking Columns
  const workforceColumns: Column<Employee>[] = [
    {
      key: 'employee',
      header: 'Employee Details',
      render: (emp) => {
        const dept = departments.find(d => d.id === emp.departmentId);
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm border border-brand-200 shadow-sm">
              {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900">
                {emp.firstName} {emp.lastName}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {emp.employeeCode} • {dept?.name || 'General'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'tracking',
      header: 'GPS Live Tracking',
      render: (emp) => {
        const cfg = GeoLocationService.getTrackingConfigByEmployee(emp.id);
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleTracking(emp.id, cfg.isTrackingEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                cfg.isTrackingEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              title={cfg.isTrackingEnabled ? 'Tracking is ON. Click to disable.' : 'Tracking is OFF. Click to enable.'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  cfg.isTrackingEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-xs font-bold ${cfg.isTrackingEnabled ? 'text-emerald-700' : 'text-slate-500'}`}>
              {cfg.isTrackingEnabled ? 'TRACKING ON' : 'DISABLED'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'geofencing',
      header: 'Geofence Enforcement',
      render: (emp) => {
        const cfg = GeoLocationService.getTrackingConfigByEmployee(emp.id);
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleGeofencing(emp.id, cfg.isGeofencingEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                cfg.isGeofencingEnabled ? 'bg-brand-600' : 'bg-slate-300'
              }`}
              title={cfg.isGeofencingEnabled ? 'Geofencing is ON. Click to disable.' : 'Geofencing is OFF. Click to enable.'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  cfg.isGeofencingEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-xs font-bold ${cfg.isGeofencingEnabled ? 'text-brand-700' : 'text-slate-500'}`}>
              {cfg.isGeofencingEnabled ? 'ENFORCED' : 'OFF'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'checkInStatus',
      header: 'Attendance Today',
      render: (emp) => {
        const att = allAttendance.find(a => a.employeeId === emp.id && a.date === today);
        if (!att || !att.checkIn) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              <Clock className="w-3.5 h-3.5" />
              Not Checked In
            </span>
          );
        }
        return (
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              In: {att.checkIn}
            </div>
            {att.checkOut && (
              <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                Out: {att.checkOut}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'latestLocation',
      header: 'Latest GPS Location',
      render: (emp) => {
        const point = GeoLocationService.getLatestLocation(emp.id, today);
        if (!point) {
          return (
            <div className="text-xs text-slate-400 italic">
              No GPS fix recorded today
            </div>
          );
        }
        return (
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
              <span className="truncate max-w-[200px]" title={point.address || 'GPS Coordinate'}>
                {point.address || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              {new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {point.inGeofence ? 'Inside Office' : 'Field / Transit'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'distanceTravelled',
      header: 'Sequential Distance',
      render: (emp) => {
        const points = GeoLocationService.getLocationPoints(emp.id, today);
        const distKm = GeoLocationService.calculateSequentialDistanceKm(points);
        return (
          <div>
            <span className="font-mono font-extrabold text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
              {distKm > 0 ? `${distKm.toFixed(2)} km` : '0.00 km'}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {points.length} GPS breadcrumbs
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Action',
      render: (emp) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelectedEmployeeId(emp.id);
            setActiveTab('live_map');
          }}
          leftIcon={<Eye className="w-3.5 h-3.5" />}
          className="text-xs"
        >
          View Map
        </Button>
      ),
    },
  ];

  // TAB 4: Geofence Columns
  const geoColumns: Column<OfficeGeoLocation>[] = [
    {
      key: 'name',
      header: 'Geofence Perimeter & Branch',
      render: (g) => {
        const branch = branches.find(b => b.id === g.branchId);
        return (
          <div>
            <div className="font-extrabold text-sm text-slate-900">{g.name}</div>
            <div className="text-xs text-slate-500">{branch?.name || 'Main HQ'}</div>
          </div>
        );
      },
    },
    {
      key: 'address',
      header: 'Physical Address',
      render: (g) => <span className="text-xs text-slate-700">{g.address}</span>,
    },
    {
      key: 'coordinates',
      header: 'GPS Center Coordinates',
      render: (g) => (
        <div className="font-mono text-xs text-slate-700">
          Lat: {g.latitude.toFixed(6)}, Lng: {g.longitude.toFixed(6)}
        </div>
      ),
    },
    {
      key: 'radius',
      header: 'Authorized Radius',
      render: (g) => (
        <span className="font-bold text-xs text-brand-800 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
          {g.radiusMeters} Meters
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Enforcement Status',
      render: (g) => (
        <Badge variant={g.isActive ? 'success' : 'default'}>
          {g.isActive ? 'Active Enforcement' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with 4 Canonical Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-brand-600" />
            Geo Location & Workforce Tracking Hub
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise GPS tracking, sequential distance calculation, geofencing perimeters & field workforce intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'geofences' && (isSuperAdmin || isHR) && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Branch Geofence
            </Button>
          )}

          {activeTab === 'live_map' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSimulatePointModalOpen(true)}
              leftIcon={<Activity className="w-4 h-4" />}
            >
              Simulate GPS Point
            </Button>
          )}
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 max-w-fit">
        <button
          onClick={() => setActiveTab('workforce')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'workforce'
              ? 'bg-white text-brand-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          Field Workforce Tracking
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
            {filteredEmployees.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('live_map')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'live_map'
              ? 'bg-white text-brand-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Route className="w-4 h-4" />
          Live Map & Trail Visualizer
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-white text-brand-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          Location History & Geofence Logs
        </button>

        <button
          onClick={() => setActiveTab('geofences')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'geofences'
              ? 'bg-white text-brand-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          Office Geofence Boundaries
          <span className="px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-800 text-[10px]">
            {geoLocations.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FIELD WORKFORCE TRACKING CONTROLS & MONITORING */}
      {/* ========================================================================= */}
      {activeTab === 'workforce' && (
        <div className="space-y-4">
          {/* Quick Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search workforce by name or code..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Departments</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Live Geofence Verification Engine Active
            </div>
          </div>

          {/* Workforce Table */}
          <Table
            columns={workforceColumns}
            data={filteredEmployees}
            keyExtractor={e => e.id}
            pageSize={10}
            emptyMessage="No employees found matching filter criteria."
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LIVE MAP & BREADCRUMB TRAIL VISUALIZER */}
      {/* ========================================================================= */}
      {activeTab === 'live_map' && (
        <div className="space-y-6">
          {/* Employee Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Select Employee:
              </span>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </option>
                ))}
              </select>

              {selectedEmpConfig?.isTrackingEnabled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Tracking Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                  Tracking Disabled
                </span>
              )}
            </div>

            {/* Sequential Distance Calculation Highlight Card */}
            <div className="flex items-center gap-3 bg-brand-50 border border-brand-200 px-4 py-2 rounded-xl">
              <div>
                <div className="text-[10px] font-bold uppercase text-brand-700">Cumulative Travelled Today</div>
                <div className="text-base font-extrabold text-brand-950 font-mono">
                  {sequentialDistanceToday.toFixed(2)} km
                </div>
              </div>
              <div className="text-[10px] text-brand-600 border-l border-brand-200 pl-3 leading-tight max-w-[160px]">
                Calculated sequentially via <span className="font-bold">∑ dist(P<sub>i</sub>, P<sub>i+1</sub>)</span> with 5m jitter filter.
              </div>
            </div>
          </div>

          {/* Map & Trail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Live Interactive Map Visualizer */}
            <div className="lg:col-span-8 space-y-4">
              <Card
                title={`Live GPS Trail Visualizer — ${selectedEmp?.firstName} ${selectedEmp?.lastName}`}
                subtitle={`Displaying chronological breadcrumb waypoints and geofence status for ${formatDate(today)}`}
              >
                {selectedEmpPointsToday.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
                    <div className="text-sm font-bold text-slate-700">
                      Location unavailable: Device offline or GPS permission not granted
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      No GPS breadcrumbs have been transmitted for this employee yet today. Once the mobile/web client sends authenticated coordinates, the interactive trail will render here.
                    </p>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setIsSimulatePointModalOpen(true)}
                      leftIcon={<Plus className="w-4 h-4" />}
                    >
                      Record Test GPS Coordinate
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Simulated Map Visualizer Canvas */}
                    <div className="relative min-h-[380px] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden p-6 flex flex-col justify-between">
                      {/* Grid overlay */}
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#a855f7_1.5px,transparent_1.5px)] [background-size:24px_24px]"></div>

                      {/* Top status bar over map */}
                      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 text-xs text-white">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-brand-400" />
                          <span className="font-bold text-slate-200">Office Perimeter: Delhi NCR HQ (250m Geofence)</span>
                        </div>
                        <div className="font-mono text-emerald-400 font-bold">
                          {selectedEmpPointsToday.length} GPS Waypoints Captured
                        </div>
                      </div>

                      {/* Trail Waypoints Visualizer */}
                      <div className="relative z-10 my-8 flex flex-col md:flex-row items-center justify-between gap-4 px-2">
                        {selectedEmpPointsToday.map((pt, idx) => {
                          const isLast = idx === selectedEmpPointsToday.length - 1;
                          const isFirst = idx === 0;
                          return (
                            <div key={pt.id} className="flex md:flex-col items-center gap-3 md:gap-2 text-center group">
                              <div className="relative">
                                {isLast && (
                                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 animate-ping absolute -inset-2"></div>
                                )}
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-lg relative z-10 border-2 ${
                                    isFirst
                                      ? 'bg-brand-600 text-white border-brand-300'
                                      : isLast
                                      ? 'bg-emerald-600 text-white border-emerald-300'
                                      : 'bg-slate-800 text-slate-200 border-slate-600'
                                  }`}
                                >
                                  P{idx + 1}
                                </div>
                              </div>

                              <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-left md:text-center text-[11px] text-slate-300 max-w-[170px]">
                                <div className="font-bold text-white truncate" title={pt.address}>
                                  {pt.address?.split('(')[0] || `Point ${idx + 1}`}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="mt-0.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      pt.inGeofence
                                        ? 'bg-brand-900/60 text-brand-300 border border-brand-700/50'
                                        : 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                                    }`}
                                  >
                                    {pt.inGeofence ? 'In Geofence' : 'Field Site'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bottom Map Legend */}
                      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 bg-slate-900/80 backdrop-blur-sm p-3 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-md bg-brand-600"></span> Origin / Check-In
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-md bg-emerald-600"></span> Current Location
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-md bg-slate-700"></span> Intermediate Stops
                          </span>
                        </div>
                        <div className="font-mono text-xs text-slate-300">
                          Total Distance: <span className="text-white font-bold">{sequentialDistanceToday.toFixed(2)} km</span>
                        </div>
                      </div>
                    </div>

                    {/* Chronological Waypoints List */}
                    <div className="space-y-2 pt-2">
                      <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                        Sequential GPS Waypoints Log
                      </div>
                      <div className="space-y-2">
                        {selectedEmpPointsToday.map((pt, idx) => (
                          <div
                            key={pt.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-bold font-mono px-2 py-1 rounded bg-slate-200 text-slate-800 text-[11px]">
                                P{idx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900">{pt.address || 'GPS Coordinate'}</div>
                                <div className="text-slate-500 font-mono text-[11px]">
                                  Lat: {pt.latitude.toFixed(4)}, Lng: {pt.longitude.toFixed(4)} • Speed: {pt.speedKmh || 0} km/h
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  pt.inGeofence
                                    ? 'bg-brand-100 text-brand-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {pt.inGeofence ? 'Within Office Geofence' : `${pt.distanceFromOfficeMeters}m from HQ`}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                {new Date(pt.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* GPS Geofence Simulator & Punch Verification Tool */}
            <div className="lg:col-span-4 space-y-6">
              <Card
                title="Geofence Punch Simulator"
                subtitle="Test GPS punch verification against branch perimeters"
              >
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Input
                      label="Test Latitude"
                      type="number"
                      step="0.0001"
                      value={testLat}
                      onChange={e => setTestLat(Number(e.target.value))}
                    />
                    <Input
                      label="Test Longitude"
                      type="number"
                      step="0.0001"
                      value={testLng}
                      onChange={e => setTestLng(Number(e.target.value))}
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={handleTestGeofence}
                    leftIcon={<Crosshair className="w-4 h-4" />}
                  >
                    Verify Geofence Boundary
                  </Button>

                  {testResult && (
                    <div
                      className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in duration-200 ${
                        testResult.isAuthorized
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          : 'bg-rose-50 text-rose-900 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        {testResult.isAuthorized ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span>Inside Authorized Perimeter!</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 text-rose-600" />
                            <span>Outside Office Perimeter!</span>
                          </>
                        )}
                      </div>
                      <div>
                        Distance to branch:{' '}
                        <span className="font-bold font-mono">{testResult.distanceMeters} meters</span>
                      </div>
                      <div>
                        Nearest Office:{' '}
                        <span className="font-bold">{testResult.nearestBranch?.name}</span>
                      </div>
                      <div className="text-[11px] opacity-80 pt-1 border-t border-slate-200/50">
                        {testResult.isAuthorized
                          ? 'Punch status: Validated with authorized office GPS tag.'
                          : 'Punch status: Flagged as Field / Remote punch.'}
                      </div>
                    </div>
                  )}

                  {/* Quick Preset Coordinates */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500 mb-2">QUICK TEST PRESETS:</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTestLat(28.6280);
                          setTestLng(77.3649);
                        }}
                      >
                        Noida HQ (Inside)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTestLat(28.5830);
                          setTestLng(77.3180);
                        }}
                      >
                        Sector 18 (Outside)
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Selected Employee Quick Card */}
              {selectedEmp && (
                <Card title="Workforce Profile Info">
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Employee:</span>
                      <span className="font-bold text-slate-900">{selectedEmp.firstName} {selectedEmp.lastName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Code:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedEmp.employeeCode}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Work Shift:</span>
                      <span className="font-semibold text-slate-700">General Morning (09:00 - 18:00)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Today's Check-In:</span>
                      <span className="font-bold text-emerald-700">
                        {selectedEmpAttendanceToday?.checkIn || 'Pending Punch'}
                      </span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LOCATION HISTORY & GEOFENCE BREACH LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* History Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-extrabold text-slate-700 uppercase">Select Date:</span>
                <input
                  type="date"
                  value={historyDate}
                  onChange={e => setHistoryDate(e.target.value)}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-extrabold text-slate-700 uppercase">Employee:</span>
                <select
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} ({e.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Daily Metric Badges */}
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                <span className="text-slate-500">Waypoints:</span>{' '}
                <span className="text-slate-900 font-mono">{selectedEmpPointsHistory.length}</span>
              </div>
              <div className="bg-brand-50 px-3 py-2 rounded-xl border border-brand-200 text-brand-900">
                <span className="text-brand-600">Total Distance:</span>{' '}
                <span className="font-mono">{sequentialDistanceHistory.toFixed(2)} km</span>
              </div>
            </div>
          </div>

          {/* Historical GPS Logs & Geofence Events Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* GPS Breadcrumb History Table */}
            <div className="lg:col-span-7">
              <Card
                title={`Historical GPS Trail (${formatDate(historyDate)})`}
                subtitle="Sequential coordinates logged during working hours"
              >
                {selectedEmpPointsHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No GPS points recorded for this employee on {formatDate(historyDate)}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedEmpPointsHistory.map((pt, idx) => (
                      <div
                        key={pt.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-800 font-bold flex items-center justify-center text-xs font-mono">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900">{pt.address || 'Field Location'}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Lat: {pt.latitude.toFixed(6)}, Lng: {pt.longitude.toFixed(6)} • ±{pt.accuracyMeters || 10}m
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pt.inGeofence
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {pt.inGeofence ? 'Office Geofence' : 'Field Client'}
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {new Date(pt.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Geofence Perimeter Transition Events */}
            <div className="lg:col-span-5">
              <Card
                title="Geofence Boundary Events"
                subtitle="Automated perimeter entry, departure and return logs"
              >
                {selectedEmpEventsHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No geofence breach or transition events recorded for this date.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedEmpEventsHistory.map(evt => (
                      <div
                        key={evt.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                              evt.eventType === 'ENTERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : evt.eventType === 'EXITED'
                                ? 'bg-amber-100 text-amber-800'
                                : evt.eventType === 'RETURNED'
                                ? 'bg-brand-100 text-brand-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            EVENT: {evt.eventType}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-slate-900">{evt.locationName}</div>
                        {evt.details && (
                          <div className="text-[11px] text-slate-600">{evt.details}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: OFFICE GEOFENCE BOUNDARIES MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'geofences' && (
        <div className="space-y-6">
          <Table
            columns={geoColumns}
            data={geoLocations}
            keyExtractor={g => g.id}
            pageSize={10}
          />
        </div>
      )}

      {/* Modal: Add New Branch Geofence */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Branch Geofence"
        subtitle="Specify branch location and perimeter radius in meters"
      >
        <form onSubmit={handleCreateGeo} className="space-y-4">
          <Input
            label="Geofence Name"
            placeholder="e.g. Noida HQ Geofence"
            value={geoForm.name}
            onChange={e => setGeoForm({ ...geoForm, name: e.target.value })}
            required
          />

          <Select
            label="Assign to Branch"
            value={geoForm.branchId}
            onChange={e => setGeoForm({ ...geoForm, branchId: e.target.value })}
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>

          <Input
            label="Physical Address"
            value={geoForm.address}
            onChange={e => setGeoForm({ ...geoForm, address: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="0.000001"
              value={geoForm.latitude}
              onChange={e => setGeoForm({ ...geoForm, latitude: Number(e.target.value) })}
              required
            />
            <Input
              label="Longitude"
              type="number"
              step="0.000001"
              value={geoForm.longitude}
              onChange={e => setGeoForm({ ...geoForm, longitude: Number(e.target.value) })}
              required
            />
          </div>

          <Input
            label="Authorized Radius (Meters)"
            type="number"
            value={geoForm.radiusMeters}
            onChange={e => setGeoForm({ ...geoForm, radiusMeters: Number(e.target.value) })}
            required
          />

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Geofence
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Simulate New GPS Point */}
      <Modal
        isOpen={isSimulatePointModalOpen}
        onClose={() => setIsSimulatePointModalOpen(false)}
        title="Record Live GPS Breadcrumb"
        subtitle={`Simulate incoming GPS coordinate for ${selectedEmp?.firstName} ${selectedEmp?.lastName}`}
      >
        <form onSubmit={handleSimulateNewPoint} className="space-y-4">
          <Input
            label="Location Description / Address"
            value={simPointForm.address}
            onChange={e => setSimPointForm({ ...simPointForm, address: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="0.0001"
              value={simPointForm.latitude}
              onChange={e => setSimPointForm({ ...simPointForm, latitude: Number(e.target.value) })}
              required
            />
            <Input
              label="Longitude"
              type="number"
              step="0.0001"
              value={simPointForm.longitude}
              onChange={e => setSimPointForm({ ...simPointForm, longitude: Number(e.target.value) })}
              required
            />
          </div>

          <Input
            label="Speed (km/h)"
            type="number"
            value={simPointForm.speedKmh}
            onChange={e => setSimPointForm({ ...simPointForm, speedKmh: Number(e.target.value) })}
            required
          />

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsSimulatePointModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Record GPS Breadcrumb
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
