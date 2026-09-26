// Onboarding Master & Candidate Self-Service Service
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import { OnboardingInvite, CandidateOnboardingData, Employee } from '../database/schema';
import { EmployeeService } from './employeeService';
import { LeaveService } from './leaveService';
import { AuditService } from './auditService';

export class OnboardingService {
  public static getAll(): OnboardingInvite[] {
    return StorageEngine.getList<OnboardingInvite>(STORAGE_KEYS.ONBOARDING_INVITES);
  }

  public static getById(id: string): OnboardingInvite | undefined {
    return this.getAll().find(i => i.id === id);
  }

  public static getByToken(token: string): OnboardingInvite | undefined {
    return this.getAll().find(i => i.token === token);
  }

  public static createInvite(params: {
    candidateName: string;
    candidateEmail?: string;
    candidatePhone?: string;
    email?: string;
    phone?: string;
    departmentId?: string;
    designationId?: string;
    branchId?: string;
    expectedJoiningDate?: string;
    joiningDate?: string;
    assignedShiftId?: string;
    offeredGrossSalary?: number;
    offeredCtc?: number;
    organizationId?: string;
  }): OnboardingInvite {
    const token = `np-inv-${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14-day validity

    const email = params.candidateEmail || params.email || 'candidate@example.com';
    const phone = params.candidatePhone || params.phone || '+91 99999 00000';
    const joiningDate = params.expectedJoiningDate || params.joiningDate || new Date().toISOString().split('T')[0];
    const orgId = params.organizationId || StorageEngine.getActiveTenantId();
    const offeredGross = params.offeredGrossSalary || (params.offeredCtc ? Math.round(params.offeredCtc / 13.2) : 60000);

    const newInvite: OnboardingInvite = {
      id: `onb-${Date.now()}`,
      organizationId: orgId,
      token,
      candidateName: params.candidateName,
      candidateEmail: email,
      candidatePhone: phone,
      departmentId: params.departmentId || 'dept-eng-01',
      designationId: params.designationId || 'desig-01',
      branchId: params.branchId || 'branch-delhi-01',
      expectedJoiningDate: joiningDate,
      assignedShiftId: params.assignedShiftId || 'shift-gen-01',
      offeredGrossSalary: offeredGross,
      status: 'sent',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    return StorageEngine.insert<OnboardingInvite>(STORAGE_KEYS.ONBOARDING_INVITES, newInvite);
  }

  public static submitCandidateData(
    token: string,
    data: Partial<CandidateOnboardingData>
  ): OnboardingInvite | undefined {
    const invite = this.getByToken(token);
    if (!invite) return undefined;

    return StorageEngine.update<OnboardingInvite>(STORAGE_KEYS.ONBOARDING_INVITES, invite.id, {
      submittedData: data,
      status: 'submitted',
    });
  }

  public static approveOnboarding(
    inviteId: string,
    reviewerEmployeeId: string,
    notes?: string
  ): { success: boolean; message: string; employee?: Employee } {
    const invite = this.getById(inviteId);
    if (!invite || !invite.submittedData) {
      return { success: false, message: 'Onboarding record or candidate data not found.' };
    }

    // Generate unique employee code
    const allEmployees = EmployeeService.getAll();
    const nextCodeNum = 1000 + allEmployees.length + 1;
    const employeeCode = `NP-${nextCodeNum}`;

    const sub = invite.submittedData;
    const gross = invite.offeredGrossSalary || 60000;
    const basic = Math.round(gross * 0.5);
    const hra = Math.round(gross * 0.25);
    const conv = 4000;
    const special = Math.max(0, gross - (basic + hra + conv));

    // Create Employee record
    const newEmployee = EmployeeService.create({
      employeeCode,
      organizationId: StorageEngine.getActiveTenantId(),
      branchId: invite.branchId,
      departmentId: invite.departmentId,
      designationId: invite.designationId,
      firstName: sub.firstName || invite.candidateName.split(' ')[0],
      lastName: sub.lastName || invite.candidateName.split(' ').slice(1).join(' ') || 'Employee',
      email: invite.candidateEmail,
      phone: invite.candidatePhone,
      personalEmail: sub.personalEmail || invite.candidateEmail,
      dob: sub.dob || '1995-01-01',
      gender: (sub.gender as any) || 'Male',
      bloodGroup: sub.bloodGroup || 'O+',
      joiningDate: invite.expectedJoiningDate,
      employmentType: 'Full-time',
      employmentStatus: 'Active',
      noticePeriodDays: 30,
      assignedShiftId: invite.assignedShiftId || 'shift-gen-01',
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
      bankDetails: sub.bankDetails || {
        accountHolderName: invite.candidateName,
        accountNumber: '9182000000000',
        bankName: 'HDFC Bank',
        ifscCode: 'HDFC0000123',
        branchName: 'Noida',
      },
      statutoryDetails: sub.statutoryDetails || {
        pan: 'ABCDE1234F',
        aadhaar: 'XXXX-XXXX-1234',
        pfEligible: true,
        esiEligible: false,
        professionalTaxState: 'Uttar Pradesh',
      },
      emergencyContact: sub.emergencyContact || {
        name: 'Emergency Contact',
        relationship: 'Family',
        phone: invite.candidatePhone,
      },
      documents: (sub.documents || []).map((d, i) => ({
        id: `doc-${Date.now()}-${i}`,
        type: (d.type as any) || 'Aadhaar',
        name: d.name,
        fileUrl: d.fileUrl,
        uploadDate: d.uploadDate || new Date().toISOString().split('T')[0],
        status: 'Verified',
      })),
      avatarUrl: sub.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${invite.candidateName}`,
      currentAddress: sub.currentAddress || '',
      permanentAddress: sub.permanentAddress || '',
    });

    // Create Initial Leave Balances for new employee
    const leaveTypes = LeaveService.getLeaveTypes();
    leaveTypes.forEach(lt => {
      StorageEngine.insert(STORAGE_KEYS.LEAVE_BALANCES, {
        id: `lb-${newEmployee.id}-${lt.code.toLowerCase()}`,
        organizationId: StorageEngine.getActiveTenantId(),
        employeeId: newEmployee.id,
        leaveTypeId: lt.id,
        year: 2026,
        allocated: lt.annualQuota,
        used: 0,
        pending: 0,
        balance: lt.annualQuota,
      });
    });

    // Mark Invite as Approved
    StorageEngine.update<OnboardingInvite>(STORAGE_KEYS.ONBOARDING_INVITES, inviteId, {
      status: 'approved',
      reviewerNotes: notes,
      reviewedByEmployeeId: reviewerEmployeeId,
      reviewedAt: new Date().toISOString(),
      convertedEmployeeId: newEmployee.id,
    });

    AuditService.log(
      'APPROVE',
      'Onboarding',
      `Approved onboarding for ${invite.candidateName} and generated Employee Code ${employeeCode}`,
      { id: reviewerEmployeeId, name: 'HR Admin', role: 'HR Admin' },
      { recordId: newEmployee.id }
    );

    return { success: true, message: `Onboarding approved! Employee created with code ${employeeCode}.`, employee: newEmployee };
  }

  public static convertToEmployee(
    inviteId: string,
    reviewerEmployeeId: string = 'user-001'
  ): { success: boolean; message: string; employee?: Employee } {
    const invite = this.getById(inviteId);
    if (!invite) return { success: false, message: 'Invite not found.' };

    if (!invite.submittedData) {
      invite.submittedData = {
        firstName: invite.candidateName.split(' ')[0],
        lastName: invite.candidateName.split(' ').slice(1).join(' ') || 'Candidate',
        personalEmail: invite.candidateEmail,
        dob: '1995-01-01',
        gender: 'Male',
        bloodGroup: 'O+',
        currentAddress: 'Corporate HQ Guest Accommodation',
        permanentAddress: 'Corporate HQ Guest Accommodation',
        bankDetails: {
          accountHolderName: invite.candidateName,
          accountNumber: '9182000000000',
          bankName: 'HDFC Bank Ltd.',
          ifscCode: 'HDFC0001234',
          branchName: 'Corporate Hub',
        },
        statutoryDetails: {
          pan: 'ABCDE9999Z',
          aadhaar: 'XXXX-XXXX-9999',
          pfEligible: true,
          esiEligible: false,
          professionalTaxState: 'Telangana',
        },
        emergencyContact: {
          name: 'Next of Kin',
          relationship: 'Family',
          phone: invite.candidatePhone,
        },
        documents: [],
      };
      StorageEngine.update<OnboardingInvite>(STORAGE_KEYS.ONBOARDING_INVITES, inviteId, {
        submittedData: invite.submittedData,
        status: 'submitted',
      });
    }

    return this.approveOnboarding(inviteId, reviewerEmployeeId);
  }
}
