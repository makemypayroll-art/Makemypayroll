// NovaPulse HRMS — Complete TypeScript Database Schema

export type UserRoleType = 
  | 'Super Admin'
  | 'HR Admin'
  | 'HR Executive'
  | 'Manager'
  | 'Team Leader'
  | 'Payroll Admin'
  | 'IT Admin'
  | 'Department Executive'
  | 'Employee';

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Intern';
export type EmploymentStatus = 'Active' | 'Probation' | 'Notice' | 'Resigned' | 'Terminated';

export type AttendanceStatus = 
  | 'Present'
  | 'Absent'
  | 'Half-Day'
  | 'Late Arrival'
  | 'Early Departure'
  | 'Weekly Off'
  | 'Leave'
  | 'Holiday'
  | 'Work From Home'
  | 'On Duty';

export type ShiftSwapStatus = 
  | 'pending_peer'
  | 'peer_accepted'
  | 'peer_rejected'
  | 'approved_by_manager'
  | 'rejected_by_manager'
  | 'cancelled';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type TicketCategory = 'HR' | 'IT' | 'Payroll' | 'Attendance' | 'Admin' | 'Facilities' | 'Other';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TicketStatus = 'Open' | 'Assigned' | 'In Progress' | 'Waiting for Employee' | 'Resolved' | 'Closed';

export type OnboardingStatus = 'draft' | 'sent' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

export type AssetCategory = 
  | 'Laptop'
  | 'Desktop'
  | 'Mobile Phone'
  | 'SIM Card'
  | 'Biometric Device'
  | 'CCTV Equipment'
  | 'Office Equipment'
  | 'Furniture'
  | 'Other Asset';

export type AssetCondition = 'Brand New' | 'Excellent' | 'Good' | 'Fair' | 'Damaged' | 'Under Repair' | 'Retired';
export type AssetStatus = 'Available' | 'Allocated' | 'Maintenance' | 'Disposed';

export type PayrollStatus = 'Draft' | 'Calculated' | 'Under Review' | 'Approved' | 'Finalized' | 'Paid';

export type TenantStatus = 
  | 'ACTIVE'
  | 'TRIAL'
  | 'PAYMENT_PENDING'
  | 'ON_HOLD'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type PaymentStatus = 
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'PENDING'
  | 'OVERDUE'
  | 'WAIVED'
  | 'REFUNDED';

export type SubscriptionPlan = 
  | 'Trial'
  | 'Monthly'
  | 'Quarterly'
  | 'Half-Yearly'
  | 'Annual'
  | 'Enterprise Custom';

// -------------------------------------------------------------
// MULTI-TENANT SAAS ENTITIES
// -------------------------------------------------------------

export interface Tenant {
  id: string; // "NP-000001"
  tenantId: string; // "NP-000001"
  companyName: string;
  legalName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  gstin?: string;
  industry: string;
  logo: string;
  clientCode: string; // "CLI-001"
  slug: string; // "ignite"
  subdomain?: string; // "ignite"
  customDomain?: string; // "hrms.ignite.com"
  loginSlug: string; // "https://ignite.makemypayroll.com" or "app.novapulse.co.in/t/NP-000001"
  status: TenantStatus;
  licensedEmployees: number;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  trialEndDate?: string;
  paymentStatus: PaymentStatus;
  enabledModules?: string[];
  primaryAdmin: {
    name: string;
    email: string;
    phone: string;
    userId?: string;
  };
  setupCompleted: boolean;
  setupStep: number;
  holdDetails?: {
    heldAt: string;
    heldBy: string;
    reason: string;
  };
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  companyName: string;
  planName: SubscriptionPlan;
  billingCycle: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annual' | 'Custom';
  startDate: string;
  endDate: string;
  licensedEmployees: number;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  renewalDate: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
}

export interface TenantLicenseChange {
  id: string;
  tenantId: string;
  companyName: string;
  previousLimit: number;
  newLimit: number;
  changedBy: string;
  reason: string;
  timestamp: string;
}

export interface TenantPayment {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  companyName: string;
  plan: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paymentDate: string;
  dueDate: string;
  status: PaymentStatus;
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
}

export interface AdminImpersonationSession {
  id: string;
  superAdminId: string;
  superAdminName: string;
  tenantId: string;
  companyName: string;
  startedAt: string;
  endedAt?: string;
  reason?: string;
}

// -------------------------------------------------------------
// CORE ENTITIES
// -------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  gstNumber?: string;
  udyamNumber?: string;
  panNumber?: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  city: string;
  state: string;
  country: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  isHeadquarters: boolean;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  headEmployeeId?: string;
  headEmployeeName?: string;
  color: string;
}

export interface Designation {
  id: string;
  organizationId: string;
  departmentId: string;
  title: string;
  level: string;
  minSalary?: number;
  maxSalary?: number;
}

export interface PermissionSet {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
  manage: boolean;
}

export interface Role {
  id: string;
  organizationId: string;
  name: UserRoleType;
  description: string;
  isSystem: boolean;
  permissions: Record<string, PermissionSet>;
}

export interface User {
  id: string;
  organizationId: string;
  employeeId: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: UserRoleType;
  avatar: string;
  status: 'active' | 'suspended';
  lastLogin?: string;
}

export interface SalaryStructure {
  basicSalary: number;
  hra: number;
  conveyanceAllowance: number;
  specialAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  grossSalary: number;
  ctc: number;
}

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  branchName: string;
}

export interface StatutoryDetails {
  pan: string;
  aadhaar: string;
  uan?: string;
  pfEligible: boolean;
  esiEligible: boolean;
  esicNumber?: string;
  professionalTaxState: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}

export interface EmployeeDocument {
  id: string;
  type: 'Aadhaar' | 'PAN' | 'Resume' | 'Offer Letter' | 'Degree Certificate' | 'Experience Letter' | 'Payslip' | 'Photo';
  name: string;
  fileUrl: string;
  uploadDate: string;
  status: 'Verified' | 'Pending' | 'Rejected';
}

export interface Employee {
  id: string;
  employeeCode: string;
  organizationId: string;
  branchId: string;
  departmentId: string;
  designationId: string;
  reportingManagerId?: string;
  
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  personalEmail?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup?: string;
  maritalStatus?: 'Single' | 'Married' | 'Other';
  
  joiningDate: string;
  probationEndDate?: string;
  confirmationDate?: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  
  noticePeriodDays: number;
  resignationDate?: string;
  exitDate?: string;
  relievingReason?: string;
  
  assignedShiftId: string;
  salaryStructure: SalaryStructure;
  bankDetails: BankDetails;
  statutoryDetails: StatutoryDetails;
  emergencyContact: EmergencyContact;
  documents: EmployeeDocument[];
  
  avatarUrl: string;
  currentAddress?: string;
  permanentAddress?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// SHIFT MANAGEMENT
// -------------------------------------------------------------

export interface Shift {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  breakDurationMinutes: number;
  gracePeriodMinutes: number;
  halfDayThresholdHours: number;
  fullDayThresholdHours: number;
  isNightShift: boolean;
  workingDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  weeklyOffs: number[];  // [0, 6] = Sat & Sun
  color: string;
}

export interface ShiftRoster {
  id: string;
  organizationId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  isWeeklyOff: boolean;
  isHoliday: boolean;
  assignedBy?: string;
  updatedAt: string;
}

export interface ShiftSwapRequest {
  id: string;
  organizationId: string;
  requesterEmployeeId: string;
  targetEmployeeId: string;
  requesterDate: string;
  requesterShiftId: string;
  targetDate: string;
  targetShiftId: string;
  reason: string;
  status: ShiftSwapStatus;
  peerResponseDate?: string;
  managerId?: string;
  managerComment?: string;
  managerApprovedAt?: string;
  createdAt: string;
}

// -------------------------------------------------------------
// ATTENDANCE MANAGEMENT
// -------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lng: number;
  inGeofence: boolean;
  address?: string;
  distanceFromOfficeMeters?: number;
}

export interface Attendance {
  id: string;
  organizationId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  checkIn?: string;  // ISO timestamp or "09:05:00"
  checkOut?: string; // ISO timestamp or "18:15:00"
  status: AttendanceStatus;
  workDurationMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  isRegularized: boolean;
  punchSource: 'Biometric Machine' | 'Web Portal' | 'Mobile GPS' | 'Manual HR';
  checkInLocation?: GeoPoint;
  checkOutLocation?: GeoPoint;
  notes?: string;
}

export interface AttendanceRegularization {
  id: string;
  organizationId: string;
  employeeId: string;
  attendanceId?: string;
  date: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  requestedStatus: AttendanceStatus;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approverEmployeeId?: string;
  approverComment?: string;
  createdAt: string;
  resolvedAt?: string;
}

// -------------------------------------------------------------
// LEAVE MANAGEMENT
// -------------------------------------------------------------

export interface LeaveType {
  id: string;
  organizationId: string;
  name: string;
  code: string; // CL, SL, EL, ML, PL, CO, LOP
  description: string;
  annualQuota: number;
  accrualFrequency: 'monthly' | 'quarterly' | 'annual';
  carryForwardMax: number;
  isHalfDayAllowed: boolean;
  requiresDoc: boolean;
  isPaid: boolean;
  color: string;
}

export interface LeaveBalance {
  id: string;
  organizationId: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocated: number;
  used: number;
  pending: number;
  balance: number;
}

export interface LeaveApplication {
  id: string;
  organizationId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalDays: number;
  isHalfDay: boolean;
  halfDaySession?: 'first_half' | 'second_half';
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  approverEmployeeId?: string;
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
}

// -------------------------------------------------------------
// TICKET MANAGEMENT
// -------------------------------------------------------------

export interface TicketComment {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName: string;
  authorRole: string;
  message: string;
  isInternalOnly: boolean;
  attachments?: string[];
  createdAt: string;
}

export interface Ticket {
  id: string;
  organizationId: string;
  ticketCode: string;
  employeeId: string;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedToEmployeeId?: string;
  assignedDepartmentId?: string;
  attachments: string[];
  slaHours: number;
  isSlaBreached: boolean;
  resolutionNotes?: string;
  comments: TicketComment[];
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// ONBOARDING MASTER
// -------------------------------------------------------------

export interface CandidateOnboardingData {
  firstName: string;
  lastName: string;
  personalEmail: string;
  phone: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup?: string;
  maritalStatus?: string;
  currentAddress: string;
  permanentAddress: string;
  emergencyContact: EmergencyContact;
  bankDetails: BankDetails;
  statutoryDetails: StatutoryDetails;
  education: Array<{ degree: string; institution: string; passingYear: number; percentage: string }>;
  previousExperience: Array<{ company: string; designation: string; fromDate: string; toDate: string; ctc: string }>;
  documents: Array<{ type: string; name: string; fileUrl: string; uploadDate: string }>;
  photoUrl?: string;
}

export interface OnboardingInvite {
  id: string;
  organizationId: string;
  token: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  departmentId: string;
  designationId: string;
  branchId: string;
  expectedJoiningDate: string;
  assignedShiftId?: string;
  offeredGrossSalary?: number;
  status: OnboardingStatus;
  submittedData?: Partial<CandidateOnboardingData>;
  reviewerNotes?: string;
  reviewedByEmployeeId?: string;
  reviewedAt?: string;
  convertedEmployeeId?: string;
  createdAt: string;
  expiresAt: string;
}

// -------------------------------------------------------------
// INVENTORY / ASSET MANAGEMENT
// -------------------------------------------------------------

export interface AssetInventory {
  id: string;
  organizationId: string;
  assetTag: string; // e.g. "NP-LAP-001"
  name: string;
  category: AssetCategory;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseCost: number;
  warrantyExpiryDate: string;
  vendorName: string;
  vendorContact: string;
  condition: AssetCondition;
  status: AssetStatus;
  allocatedToEmployeeId?: string;
  allocatedDate?: string;
  branchId: string;
  notes?: string;
}

export interface AssetAllocationHistory {
  id: string;
  organizationId: string;
  assetId: string;
  employeeId: string;
  action: 'ALLOCATED' | 'RETURNED' | 'MAINTENANCE_SENT' | 'REPAIRED';
  date: string;
  condition: AssetCondition;
  handledByEmployeeId: string;
  notes?: string;
}

// -------------------------------------------------------------
// GEO-LOCATION MANAGEMENT
// -------------------------------------------------------------

export interface OfficeGeoLocation {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isRestricted: boolean;
  isActive: boolean;
}

// -------------------------------------------------------------
// PAYROLL MANAGEMENT
// -------------------------------------------------------------

export interface PayrollPeriod {
  id: string;
  organizationId: string;
  month: number; // 1 to 12
  year: number;
  totalWorkingDays: number;
  status: PayrollStatus;
  processedDate?: string;
  processedByUserId?: string;
  totalEmployees: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
}

export interface PayslipEarnings {
  basicSalary: number;
  hra: number;
  conveyanceAllowance: number;
  specialAllowance: number;
  medicalAllowance: number;
  overtimePay: number;
  incentives: number;
  bonus: number;
  otherAllowances: number;
  totalGross: number;
}

export interface PayslipDeductions {
  pfEmployee: number;
  esiEmployee: number;
  professionalTax: number;
  tds: number;
  lopDeduction: number;
  loanAdvanceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
}

export interface PayslipEmployerContrib {
  pfEmployer: number;
  esiEmployer: number;
}

export interface Payslip {
  id: string;
  organizationId: string;
  payrollPeriodId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
  branchName: string;
  bankAccount: string;
  bankName: string;
  ifscCode: string;
  pan: string;
  uan?: string;
  month: number;
  year: number;
  
  totalWorkingDays: number;
  paymentDays: number;
  presentDays: number;
  lopDays: number;
  paidLeaveDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  overtimeHours: number;
  
  earnings: PayslipEarnings;
  deductions: PayslipDeductions;
  employerContributions: PayslipEmployerContrib;
  netSalary: number;
  netSalaryInWords: string;
  
  status: PayrollStatus;
  paymentDate?: string;
  paymentReference?: string;
  generatedAt: string;
}

// -------------------------------------------------------------
// HOLIDAYS, AUDIT & NOTIFICATIONS
// -------------------------------------------------------------

export interface Holiday {
  id: string;
  organizationId: string;
  branchId?: string; // empty means all branches
  name: string;
  date: string; // YYYY-MM-DD
  isOptional: boolean;
  description?: string;
}

export interface Notification {
  id: string;
  organizationId: string;
  recipientUserId?: string;
  recipientEmployeeId?: string;
  title: string;
  message: string;
  type: 'leave' | 'shift' | 'attendance' | 'ticket' | 'onboarding' | 'payroll' | 'asset' | 'system';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'EXPORT'
  | 'LOGIN'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_CHANGED'
  | 'TENANT_ACCESS_DENIED'
  | 'TENANT_MISMATCH'
  | 'ACCOUNT_SUSPENDED_ACCESS_ATTEMPT'
  | 'ACCOUNT_ON_HOLD_ACCESS_ATTEMPT'
  | 'PROCESS'
  | 'IMPERSONATE'
  | 'EXIT_IMPERSONATION'
  | (string & {});

export interface AuditLog {
  id: string;
  organizationId: string;
  tenantId?: string;
  userId: string;
  userName: string;
  userRole: string;
  module: string;
  action: AuditAction;
  description: string;
  recordId?: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
  ipAddress?: string;
}

export interface SystemPolicySettings {
  attendance: {
    defaultGracePeriodMinutes: number;
    halfDayWorkHours: number;
    fullDayWorkHours: number;
    autoDeductLateAfterOccurrences: number;
    overtimeThresholdHours: number;
    geofenceStrictEnforcement: boolean;
  };
  leave: {
    maxConsecutiveLeaveDays: number;
    advanceNoticeDaysRequired: number;
    allowNegativeBalance: boolean;
  };
  payroll: {
    pfCeilingAmount: number;
    pfEmployeeRatePercent: number;
    pfEmployerRatePercent: number;
    esiWageThreshold: number;
    esiEmployeeRatePercent: number;
    esiEmployerRatePercent: number;
    standardWorkingDaysPerMonth: number;
  };
}
