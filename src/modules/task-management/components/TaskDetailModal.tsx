import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  Calendar,
  User,
  Shield,
  MessageSquare,
  Paperclip,
  Activity,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Plus,
  ArrowRight,
  TrendingUp,
  ListChecks,
  Trash2,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { TaskService } from '../../../services/taskService';
import { TaskItem, TaskPriority, TaskStatus } from '../../../database/schema';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';

interface TaskDetailModalProps {
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (task: TaskItem) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
}) => {
  const { currentUser, currentEmployee } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'comments' | 'attachments' | 'activity'>('details');
  const [commentText, setCommentText] = useState('');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'Not Started');
  const [progress, setProgress] = useState<number>(task?.progress || 0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  if (!task) return null;

  const isOverdue = TaskService.isTaskOverdue(task);

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'Urgent':
        return <Badge variant="danger">Urgent</Badge>;
      case 'High':
        return <Badge variant="warning">High Priority</Badge>;
      case 'Medium':
        return <Badge variant="info">Medium</Badge>;
      case 'Low':
        return <Badge variant="default">Low</Badge>;
    }
  };

  const getStatusBadge = (st: TaskStatus) => {
    if (isOverdue) {
      return <Badge variant="danger">Overdue</Badge>;
    }
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

  const handleUpdateStatusAndProgress = (newStatus: TaskStatus, newProgress: number) => {
    setIsUpdating(true);
    try {
      const updated = TaskService.updateTask(
        task.id,
        {
          status: newStatus,
          progress: newProgress,
        },
        currentUser,
        currentEmployee
      );
      if (updated) {
        setStatus(updated.status);
        setProgress(updated.progress);
        onTaskUpdated(updated);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const updated = TaskService.toggleSubtask(task.id, subtaskId, currentUser, currentEmployee);
    if (updated) {
      setStatus(updated.status);
      setProgress(updated.progress);
      onTaskUpdated(updated);
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const updated = TaskService.addSubtask(task.id, newSubtaskTitle.trim(), currentUser, currentEmployee);
    if (updated) {
      setStatus(updated.status);
      setProgress(updated.progress);
      onTaskUpdated(updated);
      setNewSubtaskTitle('');
    }
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    const updated = TaskService.deleteSubtask(task.id, subtaskId, currentUser, currentEmployee);
    if (updated) {
      setStatus(updated.status);
      setProgress(updated.progress);
      onTaskUpdated(updated);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const updated = TaskService.addTaskComment(
      task.id,
      commentText.trim(),
      currentUser,
      currentEmployee
    );
    if (updated) {
      onTaskUpdated(updated);
      setCommentText('');
    }
  };

  const handleAddAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttachmentName.trim()) return;

    const updated = TaskService.addTaskAttachment(
      task.id,
      {
        name: newAttachmentName.trim(),
        url: `#preview-${Date.now()}`,
        size: '2.4 MB',
      },
      currentUser,
      currentEmployee
    );
    if (updated) {
      onTaskUpdated(updated);
      setNewAttachmentName('');
    }
  };

  const completedSubtasksCount = (task.subtasks || []).filter(s => s.isCompleted).length;
  const totalSubtasksCount = (task.subtasks || []).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${task.taskCode} — ${task.title}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Header Summary Banner */}
        <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-brand-300 font-bold px-2 py-0.5 bg-brand-950/60 rounded-md border border-brand-800/60">
                {task.taskCode}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-slate-800 text-slate-200">
                {task.category}
              </span>
              {getPriorityBadge(task.priority)}
              {getStatusBadge(task.status)}
            </div>
            <h3 className="text-lg font-bold text-white pt-1">{task.title}</h3>
            <p className="text-xs text-slate-300">
              Assigned by <span className="text-white font-semibold">{task.assignedByName}</span> to{' '}
              <span className="text-brand-300 font-semibold">{task.assignedToName}</span> ({task.departmentName || 'General'})
            </p>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-700/60 pt-3 md:pt-0 md:pl-5">
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Due Date</span>
              <span className={`text-sm font-bold flex items-center gap-1 justify-center ${isOverdue ? 'text-rose-400' : 'text-white'}`}>
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                {task.dueDate}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Progress</span>
              <span className="text-sm font-extrabold text-brand-300">{task.progress}%</span>
            </div>
          </div>
        </div>

        {/* Quick Status & Progress Control Bar */}
        <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              Update Task Progress & Status
            </span>
            <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
              Current: {task.status} ({task.progress}%)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Status State</label>
              <select
                value={task.status}
                onChange={e => {
                  const st = e.target.value as TaskStatus;
                  const newProg = st === 'Completed' ? 100 : task.progress;
                  handleUpdateStatusAndProgress(st, newProg);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending Review</option>
                <option value="Completed">Completed (100%)</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700">Completion %</label>
                <span className="text-xs font-extrabold text-slate-900">{task.progress}%</span>
              </div>
              <div className="flex items-center gap-2">
                {[0, 25, 50, 75, 100].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      const newSt = val === 100 ? 'Completed' : val > 0 ? 'In Progress' : 'Not Started';
                      handleUpdateStatusAndProgress(newSt, val);
                    }}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg border transition-all ${
                      task.progress === val
                        ? 'bg-brand-600 text-white border-brand-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'details'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Description & Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'checklist'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            Checklist ({completedSubtasksCount}/{totalSubtasksCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'comments'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Comments ({task.comments?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'attachments'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            Attachments ({task.attachments?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'activity'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            Activity Log ({task.activities?.length || 0})
          </button>
        </div>

        {/* Tab 1: Details */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                Description & Deliverables
              </h4>
              <p className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 whitespace-pre-wrap leading-relaxed">
                {task.description || 'No detailed description provided.'}
              </p>
            </div>

            {task.additionalInstructions && (
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                  Additional Guidelines / Criteria
                </h4>
                <p className="text-sm text-slate-700 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60 whitespace-pre-wrap leading-relaxed">
                  {task.additionalInstructions}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Start Date</span>
                <span className="text-xs font-bold text-slate-900">{task.startDate}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Due Date</span>
                <span className="text-xs font-bold text-slate-900">{task.dueDate}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Department</span>
                <span className="text-xs font-bold text-slate-900">{task.departmentName || 'General'}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Created At</span>
                <span className="text-xs font-bold text-slate-900">{task.createdAt ? formatDate(task.createdAt) : 'Recent'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Checklist / Subtasks */}
        {activeTab === 'checklist' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Checklist Items:</span>
                <span className="text-xs font-extrabold text-brand-700">
                  {completedSubtasksCount} of {totalSubtasksCount} completed ({task.progress}%)
                </span>
              </div>
              <div className="w-32 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full transition-all"
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {!task.subtasks || task.subtasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No subtasks defined. Add checklist items below to track step-by-step progress.
                </div>
              ) : (
                task.subtasks.map(st => (
                  <div
                    key={st.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      st.isCompleted
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={st.isCompleted}
                        onChange={() => handleToggleSubtask(st.id)}
                        className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                      />
                      <span className={`text-xs font-medium ${st.isCompleted ? 'line-through text-slate-500 font-normal' : 'text-slate-800 font-semibold'}`}>
                        {st.title}
                      </span>
                    </label>

                    <div className="flex items-center gap-2 shrink-0">
                      {st.completedAt && (
                        <span className="text-[10px] text-emerald-700 font-medium">
                          ✓ {formatDate(st.completedAt)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(st.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded"
                        title="Delete subtask"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2 pt-2 border-t border-slate-200">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                placeholder="Add new checklist deliverable..."
                className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="submit" variant="primary" size="md">
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </form>
          </div>
        )}

        {/* Tab 2: Comments */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
              {!task.comments || task.comments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No comments yet. Start the conversation below.
                </div>
              ) : (
                task.comments.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">
                        {c.authorName}{' '}
                        <span className="font-normal text-slate-500">({c.authorRole})</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDateTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Type your comment, update or question..."
                className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="submit" variant="primary" size="md">
                <Send className="w-4 h-4 mr-1.5" />
                Post
              </Button>
            </form>
          </div>
        )}

        {/* Tab 3: Attachments */}
        {activeTab === 'attachments' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {!task.attachments || task.attachments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No file attachments uploaded for this task.
                </div>
              ) : (
                task.attachments.map(att => (
                  <div
                    key={att.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-50 text-brand-700 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{att.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {att.size || '1.5 MB'} • Uploaded {att.uploadDate}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => alert(`Downloading ${att.name}...`)}>
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download
                    </Button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddAttachment} className="flex gap-2 pt-2 border-t border-slate-200">
              <input
                type="text"
                value={newAttachmentName}
                onChange={e => setNewAttachmentName(e.target.value)}
                placeholder="Attachment title (e.g. Design_Specs_v2.pdf)..."
                className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="submit" variant="outline" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add File
              </Button>
            </form>
          </div>
        )}

        {/* Tab 4: Activity Timeline */}
        {activeTab === 'activity' && (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {!task.activities || task.activities.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No activity recorded yet.</div>
            ) : (
              task.activities.map(act => (
                <div key={act.id} className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <div className="p-1.5 bg-brand-100 text-brand-800 rounded-lg shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{act.action}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(act.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{act.details || `Action by ${act.userName}`}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
