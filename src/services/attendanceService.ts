// Attendance Management & Real-time Calculation Service
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import { Attendance, AttendanceRegularization, AttendanceStatus, AttendancePunchSource, Shift } from '../database/schema';
import { ShiftService } from './shiftService';
import { EmployeeService } from './employeeService';
import { AuditService } from './auditService';

export class AttendanceService {
  public static getAll(): Attendance[] {
    return StorageEngine.getList<Attendance>(STORAGE_KEYS.ATTENDANCE);
  }

  public static getByEmployee(employeeId: string): Attendance[] {
    return this.getAll().filter(a => a.employeeId === employeeId);
  }

  public static getByDate(date: string): Attendance[] {
    return this.getAll().filter(a => a.date === date);
  }

  public static getByDateRange(startDate: string, endDate: string): Attendance[] {
    return this.getAll().filter(a => a.date >= startDate && a.date <= endDate);
  }

  public static getTodayAttendance(): Attendance[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getByDate(today);
  }

  public static getTodayAttendanceForEmployee(employeeId: string, date?: string): Attendance | undefined {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.getAll().find(a => a.employeeId === employeeId && a.date === targetDate);
  }

  public static getTodayStats(date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const records = this.getByDate(targetDate);
    const activeEmployees = EmployeeService.getAll().filter(e => e.employmentStatus === 'Active');

    const presentCount = records.filter(a => a.status === 'Present' || a.status === 'Work From Home' || a.status === 'On Duty').length;
    const lateCount = records.filter(a => a.status === 'Late Arrival').length;
    const leaveCount = records.filter(a => a.status === 'Leave').length;
    const halfDayCount = records.filter(a => a.status === 'Half-Day').length;
    const weeklyOffCount = records.filter(a => a.status === 'Weekly Off').length;
    const absentCount = Math.max(0, activeEmployees.length - (presentCount + lateCount + leaveCount + halfDayCount + weeklyOffCount));

    return {
      date: targetDate,
      totalEmployees: activeEmployees.length,
      presentCount,
      lateCount,
      leaveCount,
      halfDayCount,
      weeklyOffCount,
      absentCount,
      presentPercentage: activeEmployees.length > 0 ? Math.round(((presentCount + lateCount) / activeEmployees.length) * 100) : 0,
    };
  }

  public static recordPunch(params: {
    employeeId: string;
    type: 'IN' | 'OUT';
    time?: string; // "09:05:00"
    source?: AttendancePunchSource;
    location?: Attendance['checkInLocation'];
    notes?: string;
    markedBy?: string;
  }): Attendance {
    const today = new Date().toISOString().split('T')[0];
    const currentTime = params.time || new Date().toTimeString().split(' ')[0];
    const emp = EmployeeService.getById(params.employeeId);
    const shift = emp ? ShiftService.getShiftById(emp.assignedShiftId) : undefined;
    const punchSource = params.source || 'WEB';

    const existingRecords = this.getAll();
    const index = existingRecords.findIndex(a => a.employeeId === params.employeeId && a.date === today);

    if (params.type === 'IN') {
      if (index >= 0 && existingRecords[index]?.checkIn) {
        throw new Error(`Already checked in today at ${existingRecords[index].checkIn}. Duplicate Check In is not allowed.`);
      }

      let lateMinutes = 0;
      let calculatedStatus: AttendanceStatus = 'Present';

      if (shift) {
        const [shiftH, shiftM] = shift.startTime.split(':').map(Number);
        const [inH, inM] = currentTime.split(':').map(Number);
        const shiftStartMin = shiftH * 60 + shiftM;
        const inMin = inH * 60 + inM;
        const diff = inMin - shiftStartMin;

        if (diff > shift.gracePeriodMinutes) {
          lateMinutes = diff;
          calculatedStatus = 'Late Arrival';
        }
      }

      const newRecord: Attendance = {
        id: `att-${Date.now()}`,
        organizationId: StorageEngine.getActiveTenantId(),
        employeeId: params.employeeId,
        date: today,
        shiftId: shift ? shift.id : 'shift-gen-01',
        checkIn: currentTime,
        status: calculatedStatus,
        workDurationMinutes: 0,
        lateMinutes,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        isRegularized: false,
        punchSource: punchSource,
        checkInLocation: params.location,
        notes: params.notes,
        markedBy: params.markedBy || 'Self',
        markedAt: new Date().toISOString(),
      };

      if (index >= 0) {
        existingRecords[index] = {
          ...existingRecords[index],
          checkIn: currentTime,
          status: calculatedStatus,
          lateMinutes,
          punchSource,
          checkInLocation: params.location || existingRecords[index].checkInLocation,
          markedBy: params.markedBy || existingRecords[index].markedBy || 'Self',
          markedAt: new Date().toISOString(),
        };
        StorageEngine.setList(STORAGE_KEYS.ATTENDANCE, existingRecords);
        return existingRecords[index];
      } else {
        return StorageEngine.insert<Attendance>(STORAGE_KEYS.ATTENDANCE, newRecord);
      }
    } else {
      // Punch OUT
      const record = index >= 0 ? existingRecords[index] : null;
      if (!record || !record.checkIn) {
        throw new Error('Cannot Check Out before Checking In for today.');
      }
      if (record.checkOut) {
        throw new Error(`Already checked out today at ${record.checkOut}. Duplicate Check Out is not allowed.`);
      }

      // Calculate work duration
      let durationMinutes = 0;
      let status = record.status;
      if (record.checkIn) {
        const [inH, inM] = record.checkIn.split(':').map(Number);
        const [outH, outM] = currentTime.split(':').map(Number);
        durationMinutes = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));

        if (shift && durationMinutes < shift.halfDayThresholdHours * 60) {
          status = 'Half-Day';
        }
      }

      const updatedRecord: Attendance = {
        ...record,
        checkOut: currentTime,
        workDurationMinutes: durationMinutes,
        workHours: Number((durationMinutes / 60).toFixed(1)),
        status,
        checkOutLocation: params.location || record.checkOutLocation,
        lastEditedBy: params.markedBy || 'Self',
        lastEditedAt: new Date().toISOString(),
      };

      if (index >= 0) {
        existingRecords[index] = updatedRecord;
        StorageEngine.setList(STORAGE_KEYS.ATTENDANCE, existingRecords);
        return updatedRecord;
      } else {
        return StorageEngine.insert<Attendance>(STORAGE_KEYS.ATTENDANCE, updatedRecord);
      }
    }
  }

  // -------------------------------------------------------------
  // BATCH MANUAL ATTENDANCE (MANAGER / HR / ADMIN)
  // -------------------------------------------------------------

  public static saveManualAttendanceBatch(params: {
    date: string;
    entries: Array<{
      employeeId: string;
      status: AttendanceStatus;
      notes?: string;
    }>;
    user: {
      id: string;
      name: string;
      role: string;
    };
  }): { count: number; updated: Attendance[] } {
    const { date, entries, user } = params;
    const tenantId = StorageEngine.getActiveTenantId();
    const now = new Date().toISOString();

    // Determine canonical punch source based on role
    let punchSource: AttendancePunchSource = 'MANAGER_MANUAL';
    const roleLower = user.role.toLowerCase();
    if (roleLower.includes('super admin') || roleLower.includes('platform')) {
      punchSource = 'ADMIN_MANUAL';
    } else if (roleLower.includes('hr') || roleLower.includes('admin')) {
      punchSource = 'HR_MANUAL';
    }

    const allAtt = this.getAll();
    const updatedRecords: Attendance[] = [];

    entries.forEach(entry => {
      const emp = EmployeeService.getById(entry.employeeId);
      const shift = emp ? ShiftService.getShiftById(emp.assignedShiftId) : undefined;
      const index = allAtt.findIndex(a => a.employeeId === entry.employeeId && a.date === date);

      // Map status times & durations
      let checkIn: string | undefined = undefined;
      let checkOut: string | undefined = undefined;
      let workDurationMinutes = 0;
      let lateMinutes = 0;

      if (entry.status === 'Present' || entry.status === 'Work From Home' || entry.status === 'On Duty') {
        checkIn = shift ? shift.startTime + ':00' : '09:00:00';
        checkOut = shift ? shift.endTime + ':00' : '18:00:00';
        workDurationMinutes = 540; // 9 hours
      } else if (entry.status === 'Late Arrival') {
        checkIn = '09:30:00';
        checkOut = '18:30:00';
        workDurationMinutes = 540;
        lateMinutes = 30;
      } else if (entry.status === 'Half-Day') {
        checkIn = '09:00:00';
        checkOut = '13:30:00';
        workDurationMinutes = 270; // 4.5 hours
      } else {
        // Absent, Leave, Weekly Off
        checkIn = undefined;
        checkOut = undefined;
        workDurationMinutes = 0;
      }

      if (index >= 0) {
        // Edit existing record
        const prev = allAtt[index];
        const isChanged = prev.status !== entry.status;
        allAtt[index] = {
          ...prev,
          status: entry.status,
          checkIn: checkIn || prev.checkIn,
          checkOut: checkOut || prev.checkOut,
          workDurationMinutes: workDurationMinutes || prev.workDurationMinutes,
          lateMinutes,
          punchSource,
          notes: entry.notes || prev.notes,
          lastEditedBy: user.name,
          lastEditedAt: now,
        };
        updatedRecords.push(allAtt[index]);

        if (isChanged) {
          AuditService.log({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            module: 'Manual Attendance',
            action: 'UPDATE',
            description: `Updated attendance for ${emp?.firstName || entry.employeeId} on ${date} from ${prev.status} to ${entry.status}`,
            recordId: prev.id,
          });
        }
      } else {
        // Create new manual attendance record
        const newAtt: Attendance = {
          id: `att-man-${Date.now()}-${entry.employeeId}`,
          organizationId: tenantId,
          employeeId: entry.employeeId,
          date,
          shiftId: shift ? shift.id : 'shift-gen-01',
          checkIn,
          checkOut,
          status: entry.status,
          workDurationMinutes,
          lateMinutes,
          earlyDepartureMinutes: 0,
          overtimeMinutes: 0,
          isRegularized: false,
          punchSource,
          notes: entry.notes,
          markedBy: user.name,
          markedAt: now,
        };
        allAtt.push(newAtt);
        updatedRecords.push(newAtt);

        AuditService.log({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          module: 'Manual Attendance',
          action: 'CREATE',
          description: `Marked manual attendance (${entry.status}) for ${emp?.firstName || entry.employeeId} on ${date} [Source: ${punchSource}]`,
          recordId: newAtt.id,
        });
      }
    });

    StorageEngine.setList(STORAGE_KEYS.ATTENDANCE, allAtt);
    return { count: updatedRecords.length, updated: updatedRecords };
  }

  // --- Regularization Requests ---

  public static getRegularizations(): AttendanceRegularization[] {
    return StorageEngine.getList<AttendanceRegularization>(STORAGE_KEYS.REGULARIZATIONS);
  }

  public static submitRegularization(params: {
    employeeId: string;
    date: string;
    requestedCheckIn: string;
    requestedCheckOut: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }): AttendanceRegularization {
    const newReg: AttendanceRegularization = {
      id: `reg-${Date.now()}`,
      organizationId: StorageEngine.getActiveTenantId(),
      employeeId: params.employeeId,
      date: params.date,
      requestedCheckIn: params.requestedCheckIn,
      requestedCheckOut: params.requestedCheckOut,
      requestedStatus: params.requestedStatus,
      reason: params.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    return StorageEngine.insert<AttendanceRegularization>(STORAGE_KEYS.REGULARIZATIONS, newReg);
  }

  public static approveRegularization(
    regId: string,
    approverEmployeeId: string,
    approve: boolean,
    comment?: string
  ): AttendanceRegularization | undefined {
    const regList = this.getRegularizations();
    const reg = regList.find(r => r.id === regId);
    if (!reg) return undefined;

    const newStatus = approve ? 'approved' : 'rejected';
    const updated = StorageEngine.update<AttendanceRegularization>(STORAGE_KEYS.REGULARIZATIONS, regId, {
      status: newStatus,
      approverEmployeeId,
      approverComment: comment,
      resolvedAt: new Date().toISOString(),
    });

    if (approve) {
      // Find or create attendance record for that date
      const allAtt = this.getAll();
      const attIndex = allAtt.findIndex(a => a.employeeId === reg.employeeId && a.date === reg.date);

      const [inH, inM] = reg.requestedCheckIn.split(':').map(Number);
      const [outH, outM] = reg.requestedCheckOut.split(':').map(Number);
      const duration = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));

      if (attIndex >= 0) {
        allAtt[attIndex] = {
          ...allAtt[attIndex],
          checkIn: reg.requestedCheckIn,
          checkOut: reg.requestedCheckOut,
          status: reg.requestedStatus,
          workDurationMinutes: duration,
          lateMinutes: 0,
          isRegularized: true,
        };
        StorageEngine.setList(STORAGE_KEYS.ATTENDANCE, allAtt);
      } else {
        StorageEngine.insert<Attendance>(STORAGE_KEYS.ATTENDANCE, {
          id: `att-${Date.now()}`,
          organizationId: StorageEngine.getActiveTenantId(),
          employeeId: reg.employeeId,
          date: reg.date,
          shiftId: 'shift-gen-01',
          checkIn: reg.requestedCheckIn,
          checkOut: reg.requestedCheckOut,
          status: reg.requestedStatus,
          workDurationMinutes: duration,
          lateMinutes: 0,
          earlyDepartureMinutes: 0,
          overtimeMinutes: 0,
          isRegularized: true,
          punchSource: 'HR_MANUAL',
        });
      }
    }

    return updated;
  }
}

