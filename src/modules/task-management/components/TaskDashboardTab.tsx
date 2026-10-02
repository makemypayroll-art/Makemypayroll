import React from 'react';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingUp,
  Shield,
  Activity,
  Calendar,
  User,
  Building2,
} from 'lucide-react';
import { StatCard } from '../../../components/common/StatCard';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { TaskItem, TeamProject, TaskPriority } from '../../../database/schema';
import { formatDateTime } from '../../../utils/dateUtils';

interface TaskDashboardTabProps {
  tasks: TaskItem[];
  projects: TeamProject[];
  onSelectTask: (task: TaskItem) => void;
  onSelectProject: (project: TeamProject) => void;
  onNavigateTab: (tab: 'my_tasks' | 'assigned_tasks' | 'projects' | 'workflows') => void;
}

export const TaskDashboardTab: React.FC<TaskDashboardTabProps> = ({
  tasks,
  projects,
  onSelectTask,
  onSelectProject,
  onNavigateTab,
}) => {
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const overdueTasks = tasks.filter(t => t.status === 'Overdue').length;
  const activeProjects = projects.filter(p => p.status === 'In Progress').length;

  const urgentTasks = tasks.filter(t => t.priority === 'Urgent' && t.status !== 'Completed');
  const highPriorityTasks = tasks.filter(t => t.priority === 'High' && t.status !== 'Completed');

  // Department Distribution
  const departmentWorkload: Record<string, { total: number; completed: number }> = {};
  tasks.forEach(t => {
    const dept = t.departmentName || 'General';
    if (!departmentWorkload[dept]) {
      departmentWorkload[dept] = { total: 0, completed: 0 };
    }
    departmentWorkload[dept].total += 1;
    if (t.status === 'Completed') {
      departmentWorkload[dept].completed += 1;
    }
  });

  // Recent Activity Feed aggregated from tasks & projects
  const recentActivities: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
    type: 'task' | 'project';
    item: TaskItem | TeamProject;
  }> = [];

  tasks.forEach(t => {
    (t.activities || []).forEach(a => {
      recentActivities.push({
        id: a.id,
        title: `${t.taskCode}: ${a.action}`,
        description: a.details || `${a.userName} updated ${t.title}`,
        timestamp: a.timestamp,
        type: 'task',
        item: t,
      });
    });
  });

  projects.forEach(p => {
    (p.activities || []).forEach(a => {
      recentActivities.push({
        id: a.id,
        title: `${p.projectCode}: ${a.action}`,
        description: a.details || `${a.userName} in ${p.name}`,
        timestamp: a.timestamp,
        type: 'project',
        item: p,
      });
    });
  });

  recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const topActivities = recentActivities.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* 5 Primary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Tasks"
          value={totalTasks}
          icon={<CheckSquare className="w-6 h-6 text-brand-700" />}
          iconBgColor="bg-brand-50"
          onClick={() => onNavigateTab('assigned_tasks')}
        />
        <StatCard
          title="In Progress"
          value={inProgressTasks}
          icon={<Clock className="w-6 h-6 text-indigo-700" />}
          iconBgColor="bg-indigo-50"
          onClick={() => onNavigateTab('my_tasks')}
        />
        <StatCard
          title="Completed"
          value={completedTasks}
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />}
          iconBgColor="bg-emerald-50"
          subtitle={`${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% completion rate`}
        />
        <StatCard
          title="Overdue"
          value={overdueTasks}
          icon={<AlertTriangle className="w-6 h-6 text-rose-700" />}
          iconBgColor="bg-rose-50"
        />
        <StatCard
          title="Active Projects"
          value={activeProjects}
          icon={<Layers className="w-6 h-6 text-purple-700" />}
          iconBgColor="bg-purple-50"
          onClick={() => onNavigateTab('projects')}
        />
      </div>

      {/* Grid: Attention Items & Active Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent & High Priority Tasks */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                Critical & Urgent Priority Tasks
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tasks requiring immediate attention or nearing deadline
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('my_tasks')}
              className="text-xs font-bold"
            >
              View My Tasks
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          <div className="space-y-2.5">
            {urgentTasks.length === 0 && highPriorityTasks.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                ✓ No urgent or critical tasks pending. All deliverables on track!
              </div>
            ) : (
              [...urgentTasks, ...highPriorityTasks].slice(0, 5).map(task => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="p-3.5 bg-slate-50 hover:bg-white rounded-xl border border-slate-200/80 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {task.taskCode}
                      </span>
                      <Badge variant={task.priority === 'Urgent' ? 'danger' : 'warning'}>
                        {task.priority}
                      </Badge>
                      <span className="text-xs text-slate-600 font-semibold">{task.category}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 truncate">{task.title}</h4>
                    <p className="text-[11px] text-slate-500">
                      Assigned to <span className="font-bold text-slate-700">{task.assignedToName}</span> • Due: <span className="font-bold text-rose-600">{task.dueDate}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Progress</span>
                      <span className="text-xs font-extrabold text-brand-700">{task.progress}%</span>
                    </div>
                    <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand-600 h-full rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Department Workload Summary */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              Department Task Workload
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Task distribution across teams</p>
          </div>

          <div className="space-y-3.5">
            {Object.keys(departmentWorkload).length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No department tasks logged.</div>
            ) : (
              Object.entries(departmentWorkload).map(([dept, counts]) => {
                const pct = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
                return (
                  <div key={dept} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{dept}</span>
                      <span className="font-semibold text-slate-600">
                        {counts.completed}/{counts.total} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-brand-600 to-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Cross-Department Live Activity Feed */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-600" />
              Real-Time Task & Workflow Activity Timeline
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Live audit trail of task transitions, comments, and project stage submissions</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {topActivities.map(act => (
            <div
              key={act.id}
              onClick={() => {
                if (act.type === 'task') onSelectTask(act.item as TaskItem);
                else onSelectProject(act.item as TeamProject);
              }}
              className="p-3.5 bg-slate-50 hover:bg-brand-50/50 rounded-xl border border-slate-200/80 hover:border-brand-300 transition-all cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 truncate">{act.title}</span>
                <span className="text-[10px] text-slate-400 shrink-0">{formatDateTime(act.timestamp)}</span>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2">{act.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
