// Automated Test Suite for Attendance, Check-In, Geo-Tracking & Profile Security
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import { AttendanceService } from '../services/attendanceService';
import { GeoLocationService } from '../services/geoLocationService';
import { EmployeeService } from '../services/employeeService';
import { AttendanceStatus } from '../database/schema';

export function runAttendanceGeoTestSuite(): { passed: number; failed: number; results: { name: string; success: boolean; details?: string }[] } {
  const results: { name: string; success: boolean; details?: string }[] = [];
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      results.push({ name, success: true, details });
      console.log(`[PASS] ${name}`);
    } else {
      failed++;
      results.push({ name, success: false, details });
      console.error(`[FAIL] ${name}: ${details || 'Assertion failed'}`);
    }
  }

  console.log('=== STARTING ATTENDANCE & GEO-LOCATION TEST SUITE ===');

  const testDate = '2026-09-30';
  const tenantId = 'org-silaris-01';
  StorageEngine.setActiveTenantId(tenantId);

  // -------------------------------------------------------------
  // TEST 1: Check-In Lifecycle for Every Profile / Designation
  // -------------------------------------------------------------
  try {
    const testEmployeeId = 'emp-001'; // Executive / SuperAdmin
    
    // Clear any existing punch for testDate
    const existing = AttendanceService.getTodayAttendanceForEmployee(testEmployeeId, testDate);
    if (existing) {
      StorageEngine.remove(STORAGE_KEYS.ATTENDANCE, existing.id);
    }

    const checkInRecord = AttendanceService.recordPunch({
      employeeId: testEmployeeId,
      type: 'IN',
      source: 'WEB',
      time: '09:00:00',
      location: { lat: 28.6280, lng: 77.3649, inGeofence: true, address: 'Office Gate' },
    });

    assert(
      'Check-In initiates active session',
      checkInRecord.checkIn === '09:00:00' && checkInRecord.status === 'Present' && !checkInRecord.checkOut,
      `Check-in recorded: ${JSON.stringify(checkInRecord)}`
    );

    // -------------------------------------------------------------
    // TEST 2: Duplicate Check-In Blocking
    // -------------------------------------------------------------
    let duplicateBlocked = false;
    try {
      AttendanceService.recordPunch({
        employeeId: testEmployeeId,
        type: 'IN',
        source: 'WEB',
        time: '09:15:00',
      });
    } catch (e: any) {
      duplicateBlocked = e.message.includes('already checked in') || e.message.includes('Duplicate Check In');
    }
    assert('Duplicate Check-In blocked when session is active', duplicateBlocked);

    // -------------------------------------------------------------
    // TEST 3: Check-Out & Working Duration Calculation
    // -------------------------------------------------------------
    const checkOutRecord = AttendanceService.recordPunch({
      employeeId: testEmployeeId,
      type: 'OUT',
      source: 'WEB',
      time: '18:00:00',
      location: { lat: 28.6280, lng: 77.3649, inGeofence: true, address: 'Office Gate' },
    });

    assert(
      'Check-Out calculates working duration accurately',
      checkOutRecord.checkOut === '18:00:00' && checkOutRecord.workDurationMinutes === 540 && checkOutRecord.workHours === 9,
      `Work hours: ${checkOutRecord.workHours}, Duration: ${checkOutRecord.workDurationMinutes}m`
    );

  } catch (err: any) {
    assert('Check-In lifecycle execution', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Canonical Sources
  // -------------------------------------------------------------
  try {
    const sources = ['WEB', 'MOBILE', 'BIOMETRIC', 'MANAGER_MANUAL', 'HR_MANUAL', 'ADMIN_MANUAL'] as const;
    let allSourcesRecorded = true;

    sources.forEach((src, idx) => {
      const empId = `emp-src-${idx}`;
      const rec = AttendanceService.recordPunch({
        employeeId: empId,
        type: 'IN',
        source: src,
        time: `09:0${idx}:00`,
      });
      if (rec.punchSource !== src) {
        allSourcesRecorded = false;
      }
    });

    assert('Canonical attendance punch sources supported (WEB, MOBILE, BIOMETRIC, MANUAL)', allSourcesRecorded);
  } catch (err: any) {
    assert('Punch sources validation', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: Manual Attendance Grid with all 6 statuses
  // -------------------------------------------------------------
  try {
    const manualDate = '2026-09-29';
    const statusMap: { [empId: string]: AttendanceStatus } = {
      'emp-001': 'Present',
      'emp-002': 'Absent',
      'emp-003': 'Weekly Off',
      'emp-004': 'Leave',
      'emp-005': 'Late Arrival',
      'emp-006': 'Half-Day',
    };

    const entries = Object.entries(statusMap).map(([empId, status]) => ({
      employeeId: empId,
      status,
      notes: 'Batch manual reconciliation test',
    }));

    const batchRes = AttendanceService.saveManualAttendanceBatch({
      date: manualDate,
      entries,
      user: {
        id: 'user-001',
        name: 'HR Administrator',
        role: 'HR Admin',
      },
    });

    const savedRecords = batchRes.updated;
    const isAllSaved = savedRecords.length === 6 &&
      savedRecords.some(r => r.status === 'Present') &&
      savedRecords.some(r => r.status === 'Absent') &&
      savedRecords.some(r => r.status === 'Weekly Off') &&
      savedRecords.some(r => r.status === 'Leave') &&
      savedRecords.some(r => r.status === 'Late Arrival') &&
      savedRecords.some(r => r.status === 'Half-Day');

    assert('Manual Attendance supports all 6 canonical statuses (P, AB, WO, L, Late, HD)', isAllSaved);
    assert('Audit fields populated on manual attendance', savedRecords.every(r => r.lastEditedBy === 'HR Administrator'));
  } catch (err: any) {
    assert('Manual attendance batch marking', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: Sequential Distance vs Straight-Line Calculation
  // -------------------------------------------------------------
  try {
    // Points: Office -> Site 1 (3.1km) -> Site 2 (4.2km) -> Site 3 (2.5km) -> Office (7.8km)
    // Straight line distance from Office to Site 3 is ~8km.
    // Sequential distance sum is ~17.6km.
    const mockTrail = [
      { id: 't1', organizationId: tenantId, employeeId: 'emp-geo-01', date: testDate, timestamp: '2026-09-30T09:00:00Z', latitude: 28.6280, longitude: 77.3649 }, // Office
      { id: 't2', organizationId: tenantId, employeeId: 'emp-geo-01', date: testDate, timestamp: '2026-09-30T10:30:00Z', latitude: 28.6139, longitude: 77.3524 }, // Site 1 (~2.0 km)
      { id: 't3', organizationId: tenantId, employeeId: 'emp-geo-01', date: testDate, timestamp: '2026-09-30T12:00:00Z', latitude: 28.5830, longitude: 77.3180 }, // Site 2 (~4.9 km)
      { id: 't4', organizationId: tenantId, employeeId: 'emp-geo-01', date: testDate, timestamp: '2026-09-30T15:00:00Z', latitude: 28.5700, longitude: 77.3250 }, // Site 3 (~1.6 km)
      { id: 't5', organizationId: tenantId, employeeId: 'emp-geo-01', date: testDate, timestamp: '2026-09-30T17:00:00Z', latitude: 28.6280, longitude: 77.3649 }, // Office (~7.5 km)
    ];

    const sequentialDist = GeoLocationService.calculateSequentialDistanceKm(mockTrail as any);
    const straightLineDist = GeoLocationService.calculateDistanceMeters(28.6280, 77.3649, 28.6280, 77.3649) / 1000;

    assert(
      'Sequential distance calculation sums cumulative path segments',
      sequentialDist > 14 && sequentialDist < 18,
      `Calculated sequential distance: ${sequentialDist} km (Straight line from start to end was ${straightLineDist} km)`
    );

    // Jitter test: Two points separated by < 5m should be filtered out
    const jitterTrail = [
      { id: 'j1', organizationId: tenantId, employeeId: 'emp-geo-02', date: testDate, timestamp: '2026-09-30T09:00:00Z', latitude: 28.628000, longitude: 77.364900 },
      { id: 'j2', organizationId: tenantId, employeeId: 'emp-geo-02', date: testDate, timestamp: '2026-09-30T09:00:10Z', latitude: 28.628002, longitude: 77.364902 }, // ~0.3m jitter
    ];
    const jitterDist = GeoLocationService.calculateSequentialDistanceKm(jitterTrail as any);
    assert('GPS micro-jitter (< 5m) ignored in sequential distance', jitterDist === 0, `Jitter distance: ${jitterDist} km`);
  } catch (err: any) {
    assert('Sequential distance calculation', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Geofence Verification (Inside vs Outside)
  // -------------------------------------------------------------
  try {
    const insideResult = GeoLocationService.verifyGeofence(28.6280, 77.3649); // Noida HQ coords
    const outsideResult = GeoLocationService.verifyGeofence(28.5355, 77.3910); // Greater Noida coords (~12km away)

    assert('Geofence accurately validates inside office coordinate', insideResult.isAuthorized && insideResult.distanceMeters < 50);
    assert('Geofence accurately rejects outside office coordinate', !outsideResult.isAuthorized && outsideResult.distanceMeters > 5000);
  } catch (err: any) {
    assert('Geofence verification test', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 8: Employee Geo Tracking Configuration Toggle
  // -------------------------------------------------------------
  try {
    const targetEmpId = 'emp-004';
    const updated = GeoLocationService.updateTrackingConfig(targetEmpId, {
      isTrackingEnabled: true,
      isGeofencingEnabled: true,
    }, 'Test Admin');

    const config = GeoLocationService.getTrackingConfigByEmployee(targetEmpId);
    assert('Employee tracking configuration persisted and readable', config.isTrackingEnabled === true && config.isGeofencingEnabled === true);
  } catch (err: any) {
    assert('Geo tracking configuration test', false, err.message);
  }

  console.log(`=== TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
  return { passed, failed, results };
}
