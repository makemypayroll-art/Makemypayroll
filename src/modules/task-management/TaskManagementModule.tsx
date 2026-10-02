// ====================================================================
// TASK MANAGEMENT & SEQUENTIAL TEAM PROJECT WORKFLOW MODULE
// Integrated into NovaPulse HRMS with Reporting Hierarchy Security
// ====================================================================

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  LayoutDashboard,
  UserCheck,
  Users,
  Layers,
  GitPullRequest,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { TaskService } from '../../services/taskService';
import { TaskItem, TeamProject, TaskStatus } from '../../database/schema';
import { StorageEngine } from '../../database/storageEngine';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';

// Sub-Tab Components
import { TaskDashboardTab } from './components/TaskDashboardTab';
import { MyTasksTab } from './components/MyTasksTab';
import { AssignedTasksTab } from './components/AssignedTasksTab';
import { TeamProjectsTab } from './components/TeamProjectsTab';
import { ProjectWorkflowTab } from './components/ProjectWorkflowTab';

// Modals
import { CreateTaskModal } from './components/CreateTaskModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ProjectDetailModal } from './components/ProjectDetailModal';

export const TaskManagementModule: React.FC = () => {
  const { currentUser, currentEmployee, isSuperAdmin, isHR } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Active Sub-Tab Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'my_tasks' | 'assigned_tasks' | 'projects' | 'workflows'>('dashboard');

  // Selected Entities & Modals
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  const [selectedProject, setSelectedProject] = useState<TeamProject | null>(null);
  const [isProjectDetailModalOpen, setIsProjectDetailModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);

  // Subscribe to storage changes for reactive state
  useEffect(() => {
    const unsub = StorageEngine.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsub;
  }, []);

  // Fetch Tasks & Projects
  const currentEmpId = currentEmployee?.id || currentUser.id;
  const allTenantTasks = TaskService.getAllTasks();
  const myTasks = TaskService.getMyTasks(currentEmpId);
  const isSuperOrHR = isSuperAdmin || isHR;
  const assignedTasks = TaskService.getAssignedTasks(currentEmpId, isSuperOrHR, currentUser.id);
  const allProjects = TaskService.getProjects();

  // Task Handlers
  const handleOpenTask = (task: TaskItem) => {
    setSelectedTask(task);
    setIsTaskDetailModalOpen(true);
  };

  const handleUpdateTask = (taskId: string, status: TaskStatus, progress: number) => {
    TaskService.updateTask(
      taskId,
      { status, progress },
      currentUser,
      currentEmployee
    );
    setDataVersion(v => v + 1);
  };

  const handleDeleteTask = (taskId: string) => {
    TaskService.deleteTask(taskId, currentUser, currentEmployee);
    setDataVersion(v => v + 1);
  };

  // Project Handlers
  const handleOpenProject = (project: TeamProject) => {
    setSelectedProject(project);
    setIsProjectDetailModalOpen(true);
  };

  const handleNavigateToWorkflow = (project: TeamProject) => {
    setSelectedProject(project);
    setActiveTab('workflows');
  };

  return (
    <div className="space-y-6">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Task Management
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Cross-department tasks, hierarchy-secured assignments, and sequential workflow tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="font-bold text-xs"
          >
            <Layers className="w-3.5 h-3.5 mr-1 text-purple-600" />
            New Project
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="font-bold text-xs shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Task
          </Button>
        </div>
      </div>

      {/* Clean SaaS Sub-Navigation Tabs (No Numeric Prefixes) */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'dashboard'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_tasks')}
          className={`pb-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'my_tasks'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          My Tasks
          <span className="ml-1 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {myTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assigned_tasks')}
          className={`pb-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'assigned_tasks'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Assigned Tasks
          <span className="ml-1 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {assignedTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`pb-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'projects'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Team Projects
          <span className="ml-1 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {allProjects.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workflows')}
          className={`pb-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'workflows'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GitPullRequest className="w-4 h-4" />
          Project Workflow
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'dashboard' && (
        <TaskDashboardTab
          tasks={allTenantTasks}
          projects={allProjects}
          onSelectTask={handleOpenTask}
          onSelectProject={handleOpenProject}
          onNavigateTab={tab => setActiveTab(tab)}
        />
      )}

      {activeTab === 'my_tasks' && (
        <MyTasksTab
          tasks={myTasks}
          onSelectTask={handleOpenTask}
          onUpdateTask={handleUpdateTask}
        />
      )}

      {activeTab === 'assigned_tasks' && (
        <AssignedTasksTab
          tasks={assignedTasks}
          onSelectTask={handleOpenTask}
          onOpenCreateModal={() => setIsCreateTaskModalOpen(true)}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {activeTab === 'projects' && (
        <TeamProjectsTab
          projects={allProjects}
          onSelectProject={handleOpenProject}
          onOpenCreateModal={() => setIsCreateProjectModalOpen(true)}
          onNavigateToWorkflow={handleNavigateToWorkflow}
        />
      )}

      {activeTab === 'workflows' && (
        <ProjectWorkflowTab
          projects={allProjects}
          selectedProject={selectedProject}
          onSelectProject={p => setSelectedProject(p)}
          onProjectUpdated={p => {
            setSelectedProject(p);
            setDataVersion(v => v + 1);
          }}
        />
      )}

      {/* Task Creation Modal */}
      {isCreateTaskModalOpen && (
        <CreateTaskModal
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          onTaskCreated={newTask => {
            setDataVersion(v => v + 1);
            setSelectedTask(newTask);
            setIsTaskDetailModalOpen(true);
          }}
        />
      )}

      {/* Task Detail Modal */}
      {isTaskDetailModalOpen && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={isTaskDetailModalOpen}
          onClose={() => {
            setIsTaskDetailModalOpen(false);
            setSelectedTask(null);
          }}
          onTaskUpdated={updated => {
            setSelectedTask(updated);
            setDataVersion(v => v + 1);
          }}
        />
      )}

      {/* Project Creation Modal */}
      {isCreateProjectModalOpen && (
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onProjectCreated={newProj => {
            setDataVersion(v => v + 1);
            setSelectedProject(newProj);
            setActiveTab('workflows');
          }}
        />
      )}

      {/* Project Detail Modal */}
      {isProjectDetailModalOpen && (
        <ProjectDetailModal
          project={selectedProject}
          isOpen={isProjectDetailModalOpen}
          onClose={() => {
            setIsProjectDetailModalOpen(false);
            setSelectedProject(null);
          }}
          onProjectUpdated={updated => {
            setSelectedProject(updated);
            setDataVersion(v => v + 1);
          }}
        />
      )}
    </div>
  );
};
