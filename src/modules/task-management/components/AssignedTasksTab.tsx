import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Clock,
  Calendar,
  User,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Sliders,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Table, Column } from '../../../components/common/Table';
import { TaskItem, TaskPriority, TaskStatus } from '../../../database/schema';

interface AssignedTasksTabProps {
  tasks: TaskItem[];
  onSelectTask: (task: TaskItem) => void;
  onOpenCreateModal: () => void;
  onDeleteTask: (taskId: string) => void;
}

export const AssignedTasksTab: React.FC<AssignedTasksTabProps> = ({
  tasks,
  onSelectTask,
  onOpenCreateModal,
  onDeleteTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const departments = Array.from(new Set(tasks.map(t => t.departmentName).filter(Boolean)));

  const filteredTasks = tasks.filter(t => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.taskCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignedToName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignedByName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesDept = departmentFilter === 'all' || t.departmentName === departmentFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesDept;
  });

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Urgent':
        return <Badge variant="danger">Urgent</Badge>;
      case 'High':
        return <Badge variant="warning">High</Badge>;
      case 'Medium':
        return <Badge variant="info">Medium</Badge>;
      case 'Low':
        return <Badge variant="default">Low</Badge>;
    }
  };

  const getStatusBadge = (st: TaskStatus) => {
    switch (st) {
      case 'Completed':
        return <Badge variant="success">Completed</Badge>;
      case 'In Progress':
        return <Badge variant="purple">In Progress</Badge>;
      case 'Pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'Overdue':
        return <Badge variant="danger">Overdue</Badge>;
      case 'Cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="default">Not Started</Badge>;
    }
  };

  const columns: Column<TaskItem>[] = [
    {
      key: 'taskCode',
      header: 'Task Code & Title',
      render: task => (
        <div
          onClick={() => onSelectTask(task)}
          className="cursor-pointer group space-y-0.5 max-w-xs"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              {task.taskCode}
            </span>
            <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
              {task.category}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
            {task.title}
          </p>
        </div>
      ),
    },
    {
      key: 'assignedToName',
      header: 'Assigned To',
      render: task => (
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-900 block">{task.assignedToName}</span>
          <span className="text-[11px] text-slate-500 block">{task.departmentName || 'General'}</span>
        </div>
      ),
    },
    {
      key: 'assignedByName',
      header: 'Assigned By',
      render: task => <span className="text-xs font-semibold text-slate-700">{task.assignedByName}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: task => getPriorityBadge(task.priority),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: task => <span className="text-xs font-bold text-slate-900">{task.dueDate}</span>,
    },
    {
      key: 'status',
      header: 'Status & Progress',
      render: task => (
        <div className="space-y-1 min-w-[120px]">
          <div className="flex items-center justify-between">
            {getStatusBadge(task.status)}
            <span className="text-[11px] font-extrabold text-slate-800">{task.progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                task.progress === 100
                  ? 'bg-emerald-500'
                  : task.progress > 50
                  ? 'bg-brand-600'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: task => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectTask(task)}
            className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Are you sure you want to delete task ${task.taskCode}?`)) {
                onDeleteTask(task.id);
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete Task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search team tasks by title, code, assignee or assigner..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending">Pending Review</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
            </select>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}

            <Button
              type="button"
              variant="primary"
              onClick={onOpenCreateModal}
              className="shadow-sm font-bold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Task
            </Button>
          </div>
        </div>
      </div>

      {/* Table view */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <Table
          data={filteredTasks}
          columns={columns}
          keyExtractor={task => task.id}
          emptyMessage="No assigned team tasks found matching the criteria."
        />
      </div>
    </div>
  );
};
