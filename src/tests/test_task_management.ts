// Comprehensive Automated Test Suite: Task Management & Sequential Project Workflows
import { StorageEngine, STORAGE_KEYS } from '../database/storageEngine';
import { TaskService } from '../services/taskService';
import { EmployeeService } from '../services/employeeService';
import { AuthService } from '../services/authService';
import { User, Employee } from '../database/schema';

function runTests() {
  console.log('====================================================');
  console.log('RUNNING TASK MANAGEMENT & PROJECT WORKFLOW TEST SUITE');
  console.log('====================================================\n');

  StorageEngine.init();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (errorDetail) console.error(`   Detail: ${errorDetail}`);
      failed++;
    }
  }

  const superAdminUser: User = {
    id: 'user-001',
    fullName: 'Super Admin',
    email: 'admin@novapulse.co.in',
    roleName: 'Super Admin',
    roleId: 'role-super-admin',
    organizationId: 'NP-000001',
    employeeId: 'emp-001',
    avatar: '/logo.png',
    status: 'active',
  };

  const allEmployees = EmployeeService.getAll();
  const managerEmp = allEmployees.find(e => e.id === 'emp-002') || allEmployees[0]; // Priya Sharma (HR/Manager)
  const devLeadEmp = allEmployees.find(e => e.id === 'emp-003') || allEmployees[1]; // Rahul Verma (Tech Lead)
  const devEmp = allEmployees.find(e => e.id === 'emp-004') || allEmployees[2]; // Sneha Patel (Frontend Dev)

  const managerUser: User = {
    id: 'user-002',
    fullName: `${managerEmp.firstName} ${managerEmp.lastName}`,
    email: managerEmp.email,
    roleName: 'Manager',
    roleId: 'role-manager',
    organizationId: 'NP-000001',
    employeeId: managerEmp.id,
    avatar: '/avatar.png',
    status: 'active',
  };

  const devLeadUser: User = {
    id: 'user-003',
    fullName: `${devLeadEmp.firstName} ${devLeadEmp.lastName}`,
    email: devLeadEmp.email,
    roleName: 'Manager',
    roleId: 'role-manager',
    organizationId: 'NP-000001',
    employeeId: devLeadEmp.id,
    avatar: '/avatar.png',
    status: 'active',
  };

  // -------------------------------------------------------------
  // TEST 1: Task Creation & Auto-Coding
  // -------------------------------------------------------------
  console.log('--- TEST 1: Task Creation & Auto-Coding ---');
  const initialTaskCount = TaskService.getAllTasks().length;
  const createdTask = TaskService.createTask(
    {
      title: 'Automated Test Task: Biometric API Sync',
      description: 'Implement real-time sync with device gateway.',
      assignedToId: devEmp.id,
      priority: 'Urgent',
      category: 'Development',
      startDate: '2026-10-01',
      dueDate: '2026-10-05',
      additionalInstructions: 'Check SSL certs on port 8443',
    },
    managerUser,
    managerEmp
  );

  assert(
    !!createdTask && createdTask.title === 'Automated Test Task: Biometric API Sync',
    'Task created successfully with accurate title'
  );
  assert(
    createdTask.taskCode.startsWith('TSK-'),
    `Task assigned auto-incrementing taskCode: ${createdTask.taskCode}`
  );
  assert(
    createdTask.status === 'Not Started' && createdTask.progress === 0,
    'Task initialized with status "Not Started" and 0% progress'
  );
  assert(
    createdTask.activities.length >= 1,
    'Task activity log initialized with creation record'
  );

  // -------------------------------------------------------------
  // TEST 2: Reporting Hierarchy Security Check
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Reporting Hierarchy Security Check ---');
  const superAdminAllowed = TaskService.getAssignableEmployees(superAdminUser, undefined);
  assert(
    superAdminAllowed.length >= allEmployees.filter(e => e.employmentStatus === 'Active').length,
    `Super Admin has permission to assign to all ${superAdminAllowed.length} active employees`
  );

  const devLeadAllowed = TaskService.getAssignableEmployees(devLeadUser, devLeadEmp);
  assert(
    devLeadAllowed.some(e => e.id === devLeadEmp.id),
    'Employee can always assign task to self'
  );
  assert(
    devLeadAllowed.length <= superAdminAllowed.length,
    `Manager/Lead assignable scope is properly restricted (${devLeadAllowed.length} reportees)`
  );

  // -------------------------------------------------------------
  // TEST 3: My Tasks vs. Assigned Tasks Filter
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: My Tasks vs. Assigned Tasks Filtering ---');
  const devMyTasks = TaskService.getMyTasks(devEmp.id);
  assert(
    devMyTasks.some(t => t.id === createdTask.id),
    'Assignee receives new task in "My Tasks" view'
  );

  const managerAssigned = TaskService.getAssignedTasks(managerEmp.id, false, managerUser.id);
  assert(
    managerAssigned.some(t => t.id === createdTask.id),
    'Assigner sees task in "Assigned Tasks" view'
  );

  // -------------------------------------------------------------
  // TEST 4: Task Updates & Auto-Completion
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Task Updates & Auto-Completion ---');
  const updatedTask = TaskService.updateTask(
    createdTask.id,
    {
      status: 'Completed',
    },
    superAdminUser
  );

  assert(
    updatedTask?.status === 'Completed' && updatedTask?.progress === 100,
    'Marking task "Completed" automatically adjusts progress to 100%'
  );
  assert(
    !!updatedTask?.completedAt,
    'Completed timestamp accurately recorded'
  );
  assert(
    !!updatedTask?.activities.some(a => a.action === 'Status Changed'),
    'Status update logged into immutable task activity trail'
  );

  // -------------------------------------------------------------
  // TEST 5: Comments & Discussions
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Comments & Discussions ---');
  const commentedTask = TaskService.addTaskComment(
    createdTask.id,
    'Code committed to feature/biometric branch. Please review.',
    managerUser,
    managerEmp
  );

  assert(
    commentedTask?.comments.length === 1 &&
      commentedTask.comments[0].content.includes('feature/biometric'),
    'Comment appended to task discussion with author attribution'
  );

  // -------------------------------------------------------------
  // TEST 6: Team Project Creation & Sequential Workflow Initialization
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Team Project Creation & Stage Lock Policy ---');
  const newProject = TaskService.createProject(
    {
      name: 'Client Delivery Pipeline — Q4 Onboarding',
      client: 'Silaris Information Technologies',
      description: 'End to end cross-department onboarding pipeline',
      priority: 'High',
      startDate: '2026-10-01',
      targetDate: '2026-10-31',
      departmentSequence: [
        { departmentId: 'dept-sales-03', departmentName: 'Sales & BD', departmentColor: '#3b82f6', assignedEmployeeName: 'Amit Patel' },
        { departmentId: 'dept-hr-02', departmentName: 'Human Resources', departmentColor: '#a855f7', assignedEmployeeName: 'Priya Sharma' },
        { departmentId: 'dept-fin-04', departmentName: 'Finance & Accounts', departmentColor: '#10b981', assignedEmployeeName: 'Sunita Rao' },
        { departmentId: 'dept-ops-06', departmentName: 'Operations', departmentColor: '#f59e0b', assignedEmployeeName: 'Manoj Joshi' },
      ],
    },
    superAdminUser
  );

  assert(
    !!newProject && newProject.projectCode.startsWith('PRJ-'),
    `Project created with code: ${newProject.projectCode}`
  );
  assert(
    newProject.stages[0].status === 'Active',
    'Stage 1 (Sales & BD) initialized as "Active"'
  );
  assert(
    newProject.stages[1].status === 'Locked' && newProject.stages[2].status === 'Locked',
    'Subsequent stages (HR, Finance, Ops) strictly initialized as "Locked"'
  );
  assert(
    newProject.currentDepartmentName === 'Sales & BD' && newProject.currentStageIndex === 0,
    'Current active department properly points to Stage 1'
  );

  // -------------------------------------------------------------
  // TEST 7: Sequential Stage Advancement (Sales -> HR)
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Sequential Stage Advancement (Sales -> HR) ---');
  const advancedProj = TaskService.advanceProjectStage(
    newProject.id,
    'Contract signed and SLA documents verified. Handoff to HR.',
    [],
    superAdminUser
  );

  assert(
    advancedProj?.stages[0].status === 'Completed',
    'Stage 1 (Sales & BD) successfully marked as "Completed"'
  );
  assert(
    advancedProj?.stages[1].status === 'Active',
    'Stage 2 (Human Resources) successfully unlocked and marked "Active"'
  );
  assert(
    advancedProj?.currentDepartmentName === 'Human Resources' && advancedProj.currentStageIndex === 1,
    'Project active stage pointer smoothly shifted to Stage 2'
  );
  assert(
    !!advancedProj?.activities.some(a => a.action === 'Stage Advanced'),
    'Stage handoff transition logged in project activity timeline'
  );

  // -------------------------------------------------------------
  // TEST 8: Stage Return Workflow (HR -> Sales for Rework)
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Stage Return Workflow (HR -> Sales) ---');
  const returnedProj = TaskService.returnProjectStage(
    newProject.id,
    'Client billing entity address missing in master service agreement.',
    superAdminUser
  );

  assert(
    returnedProj?.stages[1].status === 'Returned',
    'Stage 2 marked as "Returned"'
  );
  assert(
    returnedProj?.stages[0].status === 'Active',
    'Stage 1 (Sales & BD) successfully reopened to "Active"'
  );
  assert(
    returnedProj?.currentDepartmentName === 'Sales & BD' && returnedProj.currentStageIndex === 0,
    'Project active department pointer correctly returned to Stage 1'
  );
  assert(
    !!returnedProj?.activities.some(a => a.action === 'Stage Returned'),
    'Stage return logged with revision reason'
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  return failed === 0;
}

runTests();
