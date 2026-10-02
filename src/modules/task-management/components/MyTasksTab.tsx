import React, { useState } from 'react';
import {
  CheckSquare,
  Search,
  Filter,
  Clock,
  Calendar,
  User,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Tag,
  Sliders,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { TaskItem, TaskPriority, TaskStatus } from '../../../database/schema';

interface MyTasksTabProps {
  tasks: TaskItem[];
  onSelectTask: (task: TaskItem) => void;
  onUpdateTask: (taskId: string, status: TaskStatus, progress: number) => void;
}

export const MyTasksTab: React.FC<MyTasksTabProps> = ({
  tasks,
  onSelectTask,
  onUpdateTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = Array.from(new Set(tasks.map(t => t.category).filter(Boolean)));

  const filteredTasks = tasks.filter(t => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.taskCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
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
        return <Badge variant="warning">Pending Review</Badge>;
      case 'Overdue':
        return <Badge variant="danger">Overdue</Badge>;
      case 'Cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="default">Not Started</Badge>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search my tasks by title, code or description..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
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

            {/* Priority Filter */}
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

            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
            <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">No tasks found</h3>
            <p className="text-xs text-slate-500">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your search query or active filters.'
                : 'You have no pending tasks assigned at this moment.'}
            </p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-brand-300 hover:shadow-md transition-all space-y-3.5"
            >
              {/* Row 1: Header tags and status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                    {task.taskCode}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-brand-50 text-brand-800 border border-brand-200">
                    {task.category}
                  </span>
                  {getPriorityBadge(task.priority)}
                  {getStatusBadge(task.status)}
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Due: <span className="font-bold text-slate-900">{task.dueDate}</span>
                </div>
              </div>

              {/* Row 2: Title & Description */}
              <div
                onClick={() => onSelectTask(task)}
                className="cursor-pointer group space-y-1"
              >
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-brand-600 transition-colors">
                  {task.title}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {task.description || 'Click to view full task instructions and details.'}
                </p>
              </div>

              {/* Row 3: Interactive Progress Bar & Quick Actions */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                    Progress: {task.progress}%
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
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

                <div className="flex items-center gap-2 justify-end">
                  {/* Quick percentage increments */}
                  {task.status !== 'Completed' && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateTask(task.id, 'In Progress', Math.min(100, task.progress + 25))}
                        className="text-[11px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                      >
                        +25%
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateTask(task.id, 'Completed', 100)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Mark Done
                      </button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTask(task)}
                    className="text-xs font-bold"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
