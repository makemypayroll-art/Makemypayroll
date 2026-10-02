import React, { useState, useEffect } from 'react';
import { CheckSquare, AlertCircle, Shield, Calendar, UserCheck, Tag, Info } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { useAuth } from '../../../context/AuthContext';
import { useOrganization } from '../../../context/OrganizationContext';
import { TaskService } from '../../../services/taskService';
import { TaskPriority, TaskItem, Employee } from '../../../database/schema';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (task: TaskItem) => void;
  defaultAssigneeId?: string;
}

const CATEGORIES = [
  'Development',
  'HR & Admin',
  'Finance & Accounts',
  'Sales & Marketing',
  'Operations',
  'Compliance & Legal',
  'Client Support',
  'IT & Infrastructure',
  'General',
];

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'Urgent', label: 'Urgent (Critical SLA)', color: 'text-rose-700 font-bold' },
  { value: 'High', label: 'High Priority', color: 'text-orange-700 font-bold' },
  { value: 'Medium', label: 'Medium Priority', color: 'text-amber-700 font-semibold' },
  { value: 'Low', label: 'Low Priority', color: 'text-slate-700' },
];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
  defaultAssigneeId,
}) => {
  const { currentUser, currentEmployee, isSuperAdmin, isHR } = useAuth();
  const { departments, designations } = useOrganization();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Development');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [assignedToId, setAssignedToId] = useState(defaultAssigneeId || '');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [assignableEmployees, setAssignableEmployees] = useState<Employee[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const allowed = TaskService.getAssignableEmployees(currentUser, currentEmployee);
      setAssignableEmployees(allowed);

      if (defaultAssigneeId && allowed.some(e => e.id === defaultAssigneeId)) {
        setAssignedToId(defaultAssigneeId);
      } else if (allowed.length > 0 && !assignedToId) {
        setAssignedToId(allowed[0].id);
      }
      setErrorMessage('');
    }
  }, [isOpen, currentUser, currentEmployee, defaultAssigneeId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Task title is required.');
      return;
    }
    if (!assignedToId) {
      setErrorMessage('Please select a permitted assignee.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newTask = TaskService.createTask(
        {
          title,
          description,
          assignedToId,
          priority,
          category,
          startDate,
          dueDate,
          additionalInstructions,
        },
        currentUser,
        currentEmployee
      );

      onTaskCreated(newTask);
      onClose();
      // Reset
      setTitle('');
      setDescription('');
      setAdditionalInstructions('');
      setCategory('Development');
      setPriority('Medium');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDeptName = (deptId?: string) => {
    const d = departments.find(x => x.id === deptId);
    return d ? d.name : '';
  };

  const getDesigTitle = (desigId?: string) => {
    const d = designations.find(x => x.id === desigId);
    return d ? d.title : '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Task"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Hierarchy Security Notice */}
        <div className="p-3 bg-gradient-to-r from-brand-50 to-indigo-50 border border-brand-200/70 rounded-xl flex items-center justify-between text-xs text-brand-900">
          <div className="flex items-center gap-2 font-medium">
            <Shield className="w-4 h-4 text-brand-600" />
            <span>
              {isSuperAdmin || isHR
                ? 'Super Admin / HR Access: You can assign tasks to all active employees.'
                : `Reporting Tree Guard: You can assign to ${assignableEmployees.length} permitted employee(s) in your reporting hierarchy.`}
            </span>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
            Task Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Implement Bank API Integration for Payroll"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
            required
          />
        </div>

        {/* Assignee & Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Assign To <span className="text-rose-500">*</span>
            </label>
            <select
              value={assignedToId}
              onChange={e => setAssignedToId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              required
            >
              {assignableEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode}) — {getDesigTitle(emp.designationId) || 'Employee'} [{getDeptName(emp.departmentId)}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority & Dates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Priority
            </label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Due Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              required
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
            Description & Objectives
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Detailed description of the deliverables and expected outcome..."
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {/* Additional Instructions */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
            Additional Instructions / Guidelines
          </label>
          <textarea
            value={additionalInstructions}
            onChange={e => setAdditionalInstructions(e.target.value)}
            rows={2}
            placeholder="Specific reference links, environments, test criteria..."
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create & Assign Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
