// Geo-Location, Geofencing & Sequential Distance Tracking Service
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import {
  OfficeGeoLocation,
  EmployeeGeoTrackingConfig,
  GeoLocationPoint,
  GeoFenceEvent,
  Employee,
} from '../database/schema';
import { AuditService } from './auditService';
import { EmployeeService } from './employeeService';

export class GeoLocationService {
  public static getAll(): OfficeGeoLocation[] {
    return StorageEngine.getList<OfficeGeoLocation>(STORAGE_KEYS.GEO_LOCATIONS);
  }

  public static getByBranch(branchId: string): OfficeGeoLocation | undefined {
    return this.getAll().find(g => g.branchId === branchId);
  }

  public static create(geo: Omit<OfficeGeoLocation, 'id'>): OfficeGeoLocation {
    const newGeo: OfficeGeoLocation = {
      ...geo,
      id: `geo-${Date.now()}`,
    };
    return StorageEngine.insert<OfficeGeoLocation>(STORAGE_KEYS.GEO_LOCATIONS, newGeo);
  }

  public static update(id: string, updates: Partial<OfficeGeoLocation>): OfficeGeoLocation | undefined {
    return StorageEngine.update<OfficeGeoLocation>(STORAGE_KEYS.GEO_LOCATIONS, id, updates);
  }

  // -------------------------------------------------------------
  // HAVERSINE & SEQUENTIAL DISTANCE CALCULATION
  // -------------------------------------------------------------

  /**
   * Calculates Haversine distance in meters between two lat/lng coordinates
   */
  public static calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Calculates cumulative travelled distance from sequential valid GPS points:
   * P1 -> P2 + P2 -> P3 + ... + P(n-1) -> Pn
   * Returns distance in kilometers with 2 decimal precision.
   */
  public static calculateSequentialDistanceKm(points: GeoLocationPoint[]): number {
    if (!points || points.length < 2) return 0;

    // Sort chronologically by timestamp
    const sorted = [...points].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let totalMeters = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const p1 = sorted[i];
      const p2 = sorted[i + 1];

      // Ignore zero-coordinate or corrupt points
      if (!p1.latitude || !p1.longitude || !p2.latitude || !p2.longitude) continue;

      const stepDist = this.calculateDistanceMeters(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

      // Filter out micro-jitter (< 5m) to avoid GPS drift inflation
      if (stepDist >= 5) {
        totalMeters += stepDist;
      }
    }

    return Number((totalMeters / 1000).toFixed(2));
  }

  /**
   * Checks if user coordinate is within any authorized branch perimeter
   */
  public static verifyGeofence(userLat: number, userLng: number): {
    isAuthorized: boolean;
    nearestBranch?: OfficeGeoLocation;
    distanceMeters: number;
  } {
    const locations = this.getAll().filter(l => l.isActive);
    if (locations.length === 0) return { isAuthorized: true, distanceMeters: 0 };

    let nearest: OfficeGeoLocation = locations[0];
    let minDistance = Infinity;

    for (const loc of locations) {
      const dist = this.calculateDistanceMeters(userLat, userLng, loc.latitude, loc.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = loc;
      }
    }

    return {
      isAuthorized: minDistance <= nearest.radiusMeters,
      nearestBranch: nearest,
      distanceMeters: minDistance,
    };
  }

  // -------------------------------------------------------------
  // EMPLOYEE TRACKING CONFIGURATION (CONTROL)
  // -------------------------------------------------------------

  public static getTrackingConfigs(tenantId?: string): EmployeeGeoTrackingConfig[] {
    const targetTenant = tenantId || StorageEngine.getActiveTenantId();
    const list = StorageEngine.getList<EmployeeGeoTrackingConfig>(STORAGE_KEYS.GEO_TRACKING_CONFIGS);
    return list.filter(c => !c.organizationId || c.organizationId === targetTenant);
  }

  public static getTrackingConfigByEmployee(employeeId: string): EmployeeGeoTrackingConfig {
    const tenantId = StorageEngine.getActiveTenantId();
    const list = this.getTrackingConfigs(tenantId);
    const found = list.find(c => c.employeeId === employeeId);
    if (found) return found;

    // Default configuration: Field/Sales employees enabled by default, others off
    const emp = EmployeeService.getById(employeeId);
    const isFieldRole = emp?.designationId === 'desig-04' || (emp?.firstName === 'Rajesh'); // e.g. Sales Executive

    const defaultConfig: EmployeeGeoTrackingConfig = {
      id: `gtc-${employeeId}`,
      organizationId: tenantId,
      employeeId,
      isTrackingEnabled: isFieldRole,
      isGeofencingEnabled: true,
      allowedRadiusMeters: 500,
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      updatedAt: new Date().toISOString(),
    };

    StorageEngine.insert<EmployeeGeoTrackingConfig>(STORAGE_KEYS.GEO_TRACKING_CONFIGS, defaultConfig);
    return defaultConfig;
  }

  public static updateTrackingConfig(
    employeeId: string,
    updates: Partial<EmployeeGeoTrackingConfig>,
    updatedBy: string = 'Authorized Manager'
  ): EmployeeGeoTrackingConfig {
    const current = this.getTrackingConfigByEmployee(employeeId);
    const updated: EmployeeGeoTrackingConfig = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    StorageEngine.upsert<EmployeeGeoTrackingConfig>(STORAGE_KEYS.GEO_TRACKING_CONFIGS, updated);

    AuditService.log({
      userId: 'user-001',
      userName: updatedBy,
      userRole: 'Manager',
      module: 'Geo Location & Tracking',
      action: 'UPDATE',
      description: `Updated location tracking policy for employee ${employeeId}: Tracking=${updated.isTrackingEnabled ? 'ON' : 'OFF'}, Geofence=${updated.isGeofencingEnabled ? 'ON' : 'OFF'}`,
      recordId: employeeId,
    });

    return updated;
  }

  // -------------------------------------------------------------
  // GPS LOCATION POINTS & TRAIL RECORDING
  // -------------------------------------------------------------

  public static getLocationPoints(employeeId?: string, date?: string): GeoLocationPoint[] {
    const tenantId = StorageEngine.getActiveTenantId();
    const today = date || new Date().toISOString().split('T')[0];
    let all = StorageEngine.getList<GeoLocationPoint>(STORAGE_KEYS.GEO_LOCATION_POINTS);

    if (tenantId) {
      all = all.filter(p => !p.organizationId || p.organizationId === tenantId);
    }
    if (employeeId) {
      all = all.filter(p => p.employeeId === employeeId);
    }
    if (date) {
      all = all.filter(p => p.date === date);
    }

    // If points list is empty for active demo field employee (Rajesh Patel), initialize realistic trajectory
    if (employeeId === 'emp-004' && all.length === 0) {
      const demoTrail = this.generateDemoTrail('emp-004', today, tenantId);
      demoTrail.forEach(p => StorageEngine.insert<GeoLocationPoint>(STORAGE_KEYS.GEO_LOCATION_POINTS, p));
      return demoTrail;
    }

    return all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  public static getLatestLocation(employeeId: string, date?: string): GeoLocationPoint | null {
    const points = this.getLocationPoints(employeeId, date);
    if (points.length === 0) return null;
    return points[points.length - 1];
  }

  public static recordLocationPoint(params: {
    employeeId: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    address?: string;
    speedKmh?: number;
  }): GeoLocationPoint {
    const tenantId = StorageEngine.getActiveTenantId();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const config = this.getTrackingConfigByEmployee(params.employeeId);
    if (!config.isTrackingEnabled) {
      throw new Error(`Location tracking is disabled for employee ${params.employeeId}`);
    }

    const verification = this.verifyGeofence(params.latitude, params.longitude);

    const point: GeoLocationPoint = {
      id: `glp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      organizationId: tenantId,
      employeeId: params.employeeId,
      date: today,
      timestamp: now,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracyMeters: params.accuracyMeters || 10,
      address: params.address || verification.nearestBranch?.name || 'Field Location',
      inGeofence: verification.isAuthorized,
      distanceFromOfficeMeters: verification.distanceMeters,
      speedKmh: params.speedKmh || 0,
    };

    StorageEngine.insert<GeoLocationPoint>(STORAGE_KEYS.GEO_LOCATION_POINTS, point);

    // Geofence event detection
    const previousPoints = this.getLocationPoints(params.employeeId, today);
    if (previousPoints.length > 1) {
      const lastPoint = previousPoints[previousPoints.length - 2];
      if (lastPoint.inGeofence && !point.inGeofence) {
        this.recordGeoFenceEvent({
          employeeId: params.employeeId,
          eventType: 'EXITED',
          locationName: verification.nearestBranch?.name || 'Office Perimeter',
          latitude: params.latitude,
          longitude: params.longitude,
          details: `Departed office geofence for field client meetings`,
        });
      } else if (!lastPoint.inGeofence && point.inGeofence) {
        this.recordGeoFenceEvent({
          employeeId: params.employeeId,
          eventType: 'RETURNED',
          locationName: verification.nearestBranch?.name || 'Office Perimeter',
          latitude: params.latitude,
          longitude: params.longitude,
          details: `Returned to office geofence perimeter`,
        });
      }
    }

    return point;
  }

  // -------------------------------------------------------------
  // GEOFENCE EVENTS
  // -------------------------------------------------------------

  public static getGeoFenceEvents(employeeId?: string, date?: string): GeoFenceEvent[] {
    const tenantId = StorageEngine.getActiveTenantId();
    let events = StorageEngine.getList<GeoFenceEvent>(STORAGE_KEYS.GEO_FENCE_EVENTS);

    if (tenantId) {
      events = events.filter(e => !e.organizationId || e.organizationId === tenantId);
    }
    if (employeeId) {
      events = events.filter(e => e.employeeId === employeeId);
    }
    if (date) {
      events = events.filter(e => e.date === date);
    }

    if (employeeId === 'emp-004' && events.length === 0) {
      const today = date || new Date().toISOString().split('T')[0];
      const demoEvents = this.generateDemoEvents('emp-004', today, tenantId);
      demoEvents.forEach(e => StorageEngine.insert<GeoFenceEvent>(STORAGE_KEYS.GEO_FENCE_EVENTS, e));
      return demoEvents;
    }

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public static recordGeoFenceEvent(params: {
    employeeId: string;
    eventType: GeoFenceEvent['eventType'];
    locationName: string;
    latitude: number;
    longitude: number;
    details?: string;
  }): GeoFenceEvent {
    const tenantId = StorageEngine.getActiveTenantId();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const event: GeoFenceEvent = {
      id: `gfe-${Date.now()}`,
      organizationId: tenantId,
      employeeId: params.employeeId,
      date: today,
      timestamp: now,
      eventType: params.eventType,
      locationName: params.locationName,
      latitude: params.latitude,
      longitude: params.longitude,
      details: params.details,
    };

    StorageEngine.insert<GeoFenceEvent>(STORAGE_KEYS.GEO_FENCE_EVENTS, event);
    return event;
  }

  // -------------------------------------------------------------
  // SEED TRAIL GENERATOR FOR DEMO FIELD EMPLOYEES
  // -------------------------------------------------------------

  private static generateDemoTrail(employeeId: string, date: string, tenantId: string): GeoLocationPoint[] {
    return [
      {
        id: `p1-${employeeId}`,
        organizationId: tenantId,
        employeeId,
        date,
        timestamp: `${date}T09:00:00Z`,
        latitude: 28.6280,
        longitude: 77.3649,
        address: 'Noida HQ (Office Check-In)',
        inGeofence: true,
        distanceFromOfficeMeters: 0,
        speedKmh: 0,
      },
      {
        id: `p2-${employeeId}`,
        organizationId: tenantId,
        employeeId,
        date,
        timestamp: `${date}T10:15:00Z`,
        latitude: 28.6139,
        longitude: 77.3524,
        address: 'Sector 59 Industrial Complex (Client Site A)',
        inGeofence: false,
        distanceFromOfficeMeters: 3100,
        speedKmh: 24,
      },
      {
        id: `p3-${employeeId}`,
        organizationId: tenantId,
        employeeId,
        date,
        timestamp: `${date}T11:45:00Z`,
        latitude: 28.5830,
        longitude: 77.3180,
        address: 'Sector 18 Commercial Hub (Client Site B)',
        inGeofence: false,
        distanceFromOfficeMeters: 6800,
        speedKmh: 35,
      },
      {
        id: `p4-${employeeId}`,
        organizationId: tenantId,
        employeeId,
        date,
        timestamp: `${date}T14:30:00Z`,
        latitude: 28.5700,
        longitude: 77.3250,
        address: 'Sector 29 Corporate Towers (Client Site C)',
        inGeofence: false,
        distanceFromOfficeMeters: 8200,
        speedKmh: 18,
      },
      {
        id: `p5-${employeeId}`,
        organizationId: tenantId,
        employeeId,
        date,
        timestamp: `${date}T16:45:00Z`,
        latitude: 28.6275,
        longitude: 77.3645,
        address: 'Noida HQ Gate (Returned to Office)',
        inGeofence: true,
        distanceFromOfficeMeters: 45,
        speedKmh: 5,
      },
    ];
  }

  private static generateDemoEvents(employeeId: string, date: string, tenantId: string): GeoFenceEvent[] {
    return [
      {
        id: `gfe-01-${employeeId}`,
        organizationId: tenantId,
        employeeId,
        date,
        timestamp: `${date}T09:02:00Z`,
        eventType: 'ENTERED',
        locationName: 'Delhi NCR Corporate HQ',
        latitude: 28.6280,
        longitude: 77.3649,
        details: 'Checked in at office gate terminal',
      },
      {
        id: `gfe-02-${employeeId}`,
        organizationId: tenantId,
        employeeId,
        date,
        timestamp: `${date}T09:45:00Z`,
        eventType: 'EXITED',
        locationName: 'Delhi NCR Corporate HQ',
        latitude: 28.6250,
        longitude: 77.3620,
        details: 'Departed office geofence for scheduled client meetings',
      },
      {
        id: `gfe-03-${employeeId}`,
        organizationId: tenantId,
        employeeId,
        date,
        timestamp: `${date}T16:45:00Z`,
        eventType: 'RETURNED',
        locationName: 'Delhi NCR Corporate HQ',
        latitude: 28.6275,
        longitude: 77.3645,
        details: 'Returned to office geofence perimeter for daily debrief',
      },
    ];
  }
}

