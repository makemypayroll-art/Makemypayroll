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
  payrollCycleId?: string;
  attendancePolicyId?: string;
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

export type AttendancePunchSource =
  | 'WEB'
  | 'MOBILE'
  | 'BIOMETRIC'
  | 'MANAGER_MANUAL'
  | 'HR_MANUAL'
  | 'ADMIN_MANUAL'
  | 'Web Portal'
  | 'Mobile GPS'
  | 'Biometric Machine'
  | 'Manual HR';

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
  workHours?: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  isRegularized: boolean;
  punchSource: AttendancePunchSource;
  checkInLocation?: GeoPoint;
  checkOutLocation?: GeoPoint;
  notes?: string;
  markedBy?: string;
  markedAt?: string;
  lastEditedBy?: string;
  lastEditedAt?: string;
}

export interface EmployeeGeoTrackingConfig {
  id: string;
  organizationId: string;
  employeeId: string;
  isTrackingEnabled: boolean;
  isGeofencingEnabled: boolean;
  allowedRadiusMeters?: number;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface GeoLocationPoint {
  id: string;
  organizationId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string or HH:MM:SS
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  address?: string;
  inGeofence: boolean;
  distanceFromOfficeMeters?: number;
  speedKmh?: number;
}

export interface GeoFenceEvent {
  id: string;
  organizationId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  eventType: 'ENTERED' | 'EXITED' | 'OUTSIDE' | 'RETURNED';
  locationName: string;
  latitude: number;
  longitude: number;
  details?: string;
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
// PAYROLL CONFIGURATION: CYCLES & ATTENDANCE POLICIES
// -------------------------------------------------------------

export interface PayrollCycle {
  id: string; // e.g. "cycle-001"
  organizationId: string;
  name: string; // e.g. "Monthly (1st to 30th/31st)", "Mid-Month (20th to 19th)", "Cut-off (26th to 25th)"
  startDay: number; // 1 to 31
  endDay: number; // 1 to 31
  isDefault?: boolean;
  status: 'Active' | 'Inactive';
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendancePolicy {
  id: string; // e.g. "pol-001"
  organizationId: string;
  name: string; // e.g. "Standard Corporate Policy", "Factory Staff Policy"
  description?: string;
  isDefault?: boolean;
  status: 'Active' | 'Inactive';
  
  // Basic Attendance Settings
  fullDayHours: number; // e.g. 8 or 9
  halfDayHours: number; // e.g. 4.5
  fullDayCreditToleranceMinutes: number; // e.g. 15
  minimumOtHoursDaily: number; // e.g. 1
  otPunchGapSeconds: number; // e.g. 60
  maxLeaveCarryoverDays: number; // e.g. 10
  
  // Policy Controls
  enableOvertime: boolean;
  overtimePayScale: number; // 1.0, 1.5, 2.0
  countOutsideShiftHours: boolean;
  salesProductivityAttendance: boolean;
  
  // OT Detection
  otDetectionEnabled: boolean;
  otDetectionMode: 'after_shift' | 'before_shift' | 'both';
  otWindowMinutes: number;
  
  // Late Coming Configuration
  dailyLateAllowanceMinutes: number; // Grace allowance in minutes
  lateComingGraceMinutes: number;
  maxMonthlyLatenessAllowed: number; // e.g. 3
  latePenaltyType: 'Deduction' | 'HalfDay' | 'Warning' | 'None';
  latePenaltyValue: number; // e.g. 0.5 (half-day LOP)
  
  // Full-Day Credit Logic
  fullDayCreditLogic: 'inside_shift_only' | 'can_stay_late';
  differentWorkingHoursPerDay?: Record<string, number>;
  
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
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
  leaveEncashment?: number;
  reimbursements?: number;
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
  loanEmi?: number;
  advanceRecovery?: number;
  otherDeductions: number;
  totalDeductions: number;
}

export interface PayslipEmployerContrib {
  pfEmployer: number;
  esiEmployer: number;
  epsEmployer?: number;
  epfEmployer?: number;
  edliEmployer?: number;
  pfAdminCharges?: number;
}

export interface Payslip {
  id: string;
  organizationId: string;
  tenantId?: string;
  payrollPeriodId: string;
  referenceNumber?: string;
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
  esiNumber?: string;
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
// ADVANCED PAYROLL STATUTORY, TAX, LOANS & ADVANCES
// -------------------------------------------------------------

export interface PayrollStatutoryConfig {
  id: string;
  tenantId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  // PF Configuration
  pfEnabled: boolean;
  pfWageCeiling: number; // default 15000
  pfEmployeeRate: number; // 12%
  pfEmployerEpfRate: number; // 3.67%
  pfEmployerEpsRate: number; // 8.33% (capped at ceiling)
  pfAdminRate: number; // 0.5%
  pfEdliRate: number; // 0.5%
  // ESI Configuration
  esiEnabled: boolean;
  esiGrossWageThreshold: number; // default 21000
  esiEmployeeRate: number; // 0.75%
  esiEmployerRate: number; // 3.25%
  // Tax / TDS Configuration
  standardDeductionNew: number; // 75000
  standardDeductionOld: number; // 50000
  cessRate: number; // 4%
  // Leave Encashment
  leaveEncashmentBasis: 'BASIC' | 'BASIC_DA' | 'GROSS';
  minLeaveBalanceForEncashment: number;
  maxEncashableDaysPerYear: number;
  // Overtime
  overtimeMultiplier: number; // 1.5x or 2.0x
  overtimeBasis: 'HOURLY_GROSS' | 'HOURLY_BASIC' | 'FIXED_HOURLY';
  fixedHourlyRate?: number;
  updatedAt: string;
}

export type TaxRegime = 'NEW' | 'OLD';

export interface EmployeeTaxProfile {
  id: string;
  tenantId: string;
  employeeId: string;
  financialYear: string; // "2026-2027"
  pan: string;
  regime: TaxRegime;
  declarationStatus: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'LOCKED';
  section80CDeclared: number; // max 150000
  section80DDeclared: number; // Mediclaim
  hraExemptionDeclared: number;
  homeLoanInterestDeclared: number; // Section 24
  otherExemptionsDeclared: number;
  previousEmployerGross: number;
  previousEmployerTds: number;
  annualGrossProjected: number;
  totalTaxableIncome: number;
  annualTaxLiability: number;
  tdsAlreadyDeducted: number;
  monthlyTdsToDeduct: number;
  updatedAt: string;
}

export interface EmployeePfProfile {
  id: string;
  tenantId: string;
  employeeId: string;
  pfApplicable: boolean;
  uan?: string;
  pfMemberId?: string;
  voluntaryPfPercent?: number;
  isEpsEligible: boolean;
  updatedAt: string;
}

export interface EmployeeEsiProfile {
  id: string;
  tenantId: string;
  employeeId: string;
  esiApplicable: boolean;
  esiNumber?: string;
  isEligible: boolean;
  updatedAt: string;
}

export type LoanStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Disbursed'
  | 'Active'
  | 'Completed'
  | 'Paused'
  | 'Rejected'
  | 'Cancelled';

export interface EmployeeLoan {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName?: string;
  loanType: 'Personal Loan' | 'Emergency Aid' | 'Home / Vehicle Loan' | 'Education Support' | 'Festival Loan';
  principalAmount: number;
  interestRateAnnualPercent: number; // 0 for interest-free
  tenureMonths: number;
  monthlyEmi: number;
  startMonth: string; // "YYYY-MM"
  endMonth: string;   // "YYYY-MM"
  outstandingPrincipal: number;
  outstandingInterest: number;
  emisPaidCount: number;
  status: LoanStatus;
  approvalDate?: string;
  approvedBy?: string;
  disbursementDate?: string;
  rejectionReason?: string;
  isDeductionPaused?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeAdvance {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName?: string;
  advanceAmount: number;
  requestDate: string;
  reason: string;
  approvedAmount: number;
  recoveryStartMonth: string; // "YYYY-MM"
  recoveryMonthlyAmount: number;
  installmentsCount: number;
  installmentsRecoveredCount: number;
  outstandingAmount: number;
  status: 'Pending' | 'Approved' | 'Active' | 'Recovered' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReimbursementType = 'Travel' | 'Food' | 'Medical' | 'Mobile' | 'Internet' | 'Fuel' | 'Other';
export type ReimbursementStatus = 'Submitted' | 'Manager Approved' | 'HR Approved' | 'Approved' | 'Paid' | 'Rejected';

export interface EmployeeReimbursement {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName?: string;
  expenseType: ReimbursementType;
  expenseDate: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  receiptFileName?: string;
  status: ReimbursementStatus;
  payoutMethod: 'Payroll' | 'Direct Transfer';
  approvedAmount?: number;
  managerApprovedBy?: string;
  managerApprovedAt?: string;
  hrApprovedBy?: string;
  hrApprovedAt?: string;
  rejectionReason?: string;
  paidPayrollPeriodId?: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveEncashmentRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName?: string;
  leaveTypeId: string;
  leaveTypeName: string;
  eligibleBalanceDays: number;
  encashedDays: number;
  calculationBasis: 'BASIC' | 'BASIC_DA' | 'GROSS';
  perDayRate: number;
  encashmentAmount: number;
  status: 'Pending' | 'Approved' | 'Processed' | 'Rejected';
  payrollPeriodId?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface EmployeeOvertimeRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  otHours: number;
  hourlyRate: number;
  multiplier: number;
  otAmount: number;
  attendanceRecordId?: string;
  shiftId?: string;
  status: 'Pending' | 'Approved' | 'Processed' | 'Rejected';
  payrollPeriodId?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

// -------------------------------------------------------------
// MMP INSIGHTS — AI WORKFORCE INTELLIGENCE DATA MODELS
// -------------------------------------------------------------

export type MMPDatasetStatus = 'PROCESSING' | 'READY' | 'ERROR' | 'ARCHIVED';

export interface MMPColumnMapping {
  employeeIdentifier: string;
  employeeName: string;
  department: string;
  date: string;
  workingHours: string;
  productiveHours: string;
  overtimeHours: string;
  taskCount?: string;
  completedTasks?: string;
  attendanceStatus?: string;
  performanceScore?: string;
}

export interface MMPDataset {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  fileName: string;
  fileType: 'xlsx' | 'xls' | 'csv' | 'internal_hrms';
  rowCount: number;
  columnCount: number;
  detectedColumns: string[];
  columnMapping: MMPColumnMapping;
  dataSummary: {
    departmentsCount: number;
    employeesCount: number;
    dateRange: { from: string; to: string };
    missingValuesCount: number;
    duplicateRowsCount: number;
    invalidValuesCount: number;
  };
  status: MMPDatasetStatus;
  createdAt: string;
}

export interface MMPDatasetRow {
  id: string;
  datasetId: string;
  tenantId: string;
  employeeIdentifier: string;
  employeeName: string;
  department: string;
  date: string;
  workingHours: number;
  productiveHours: number;
  overtimeHours: number;
  taskCount: number;
  completedTasks: number;
  attendanceStatus: string;
  performanceScore?: number;
  rawData?: Record<string, any>;
}

export interface MMPAnalyticsMetrics {
  totalEmployees: number;
  activeEmployees: number;
  attendanceRatePercent: number;
  absenteeismRatePercent: number;
  avgWorkingHours: number;
  avgProductiveHours: number;
  productivityRatioPercent: number; // (Productive / Working) * 100
  totalOvertimeHours: number;
  overtimeRatePercent: number;
  taskCompletionRatePercent: number;
  productivityScore: number; // 0 to 100 transparent formula
  scoreFormulaDescription: string;
  departmentMetrics: Array<{
    department: string;
    employeeCount: number;
    attendanceRate: number;
    avgWorkingHours: number;
    avgProductiveHours: number;
    productivityRatio: number;
    overtimeHours: number;
    taskCompletionRate: number;
    productivityScore: number;
  }>;
  employeeTopProductivity: Array<{
    employeeName: string;
    department: string;
    productivityRatio: number;
    score: number;
    attendanceRate: number;
  }>;
  employeeDecliningTrend: Array<{
    employeeName: string;
    department: string;
    previousPeriodRatio: number;
    currentPeriodRatio: number;
    deltaPercent: number;
  }>;
  anomalies: Array<{
    type: 'HIGH_ATTENDANCE_LOW_OUTPUT' | 'EXCESSIVE_OVERTIME' | 'PRODUCTIVITY_DROP' | 'TASK_BOTTLENECK';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    title: string;
    description: string;
    affectedCount: number;
  }>;
  periodComparison?: {
    currentPeriod: string;
    previousPeriod: string;
    productivityDelta: number;
    attendanceDelta: number;
    overtimeDelta: number;
  };
}

export interface MMPAIInsightItem {
  type: 'FACT' | 'OBSERVATION' | 'POSSIBLE_EXPLANATION' | 'RECOMMENDATION';
  category: 'PRODUCTIVITY' | 'ATTENDANCE' | 'OVERTIME' | 'WORKLOAD' | 'RISK';
  title: string;
  description: string;
  metricReference?: string;
}

export interface MMPAIAnalysis {
  id: string;
  tenantId: string;
  datasetId: string;
  prompt: string;
  executiveSummary: string;
  keyInsights: MMPAIInsightItem[];
  areasToInvestigate: string[];
  recommendedActions: string[];
  dataLimitations: string[];
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
}

export interface MMPSavedInsight {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  title: string;
  prompt: string;
  analysis: MMPAIAnalysis;
  metrics: MMPAnalyticsMetrics;
  datasetName: string;
  dataPeriod: string;
  tags: string[];
  createdAt: string;
}

export interface MMPAIUsage {
  id: string;
  tenantId: string;
  userId: string;
  monthYear: string; // "2026-09"
  requestCount: number;
  monthlyLimit: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  lastRequestAt: string;
}

export interface MMPAISettings {
  id: string;
  tenantId: string;
  isAiEnabled: boolean;
  defaultProvider: 'openai' | 'anthropic' | 'makemypayroll_engine';
  defaultModel: string;
  monthlyRequestLimit: number; // default 100
  dailyRequestLimit: number;   // default 20
  maxFileSizeMB: number;       // default 10
  maxRows: number;             // default 5000
  allowedRoles: string[];      // ['Super Admin', 'Tenant Admin', 'HR Admin', 'Manager']
  updatedAt: string;
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
