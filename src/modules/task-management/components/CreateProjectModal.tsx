import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  AlertCircle,
  Shield,
  Calendar,
  Building2,
  UserCheck,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';
import { useOrganization } from '../../../context/OrganizationContext';
import { TaskService } from '../../../services/taskService';
import { EmployeeService } from '../../../services/employeeService';
import { TeamProject, TaskPriority, Employee, Department } from '../../../database/schema';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: TeamProject) => void;
}

const DEFAULT_DEPARTMENT_PIPELINE = [
  { name: 'Sales & BD', color: '#3b82f6' },
  { name: 'Human Resources', color: '#a855f7' },
  { name: 'Finance & Accounts', color: '#10b981' },
  { name: 'Operations', color: '#f59e0b' },
  { name: 'IT & Infrastructure', color: '#06b6d4' },
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const { currentUser, currentEmployee } = useAuth();
  const { departments } = useOrganization();
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('High');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const [stageList, setStageList] = useState<
    Array<{
      departmentId: string;
      departmentName: string;
      departmentColor: string;
      assignedEmployeeId?: string;
      assignedEmployeeName?: string;
    }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const allEmps = EmployeeService.getAll();
      setEmployees(allEmps);

      // Build default initial pipeline matching actual organization departments
      if (departments.length > 0 && stageList.length === 0) {
        const initial = departments.slice(0, 5).map(d => {
          const deptEmps = allEmps.filter(e => e.departmentId === d.id);
          const headEmp = deptEmps.find(e => d.headEmployeeId === e.id) || deptEmps[0];
          return {
            departmentId: d.id,
            departmentName: d.name,
            departmentColor: d.color || '#6366f1',
            assignedEmployeeId: headEmp?.id,
            assignedEmployeeName: headEmp ? `${headEmp.firstName} ${headEmp.lastName}` : undefined,
          };
        });
        setStageList(initial);
      }
      setErrorMessage('');
    }
  }, [isOpen, departments]);

  const handleAddStage = () => {
    if (departments.length === 0) return;
    const defaultDept = departments[stageList.length % departments.length] || departments[0];
    const deptEmps = employees.filter(e => e.departmentId === defaultDept.id);
    const firstEmp = deptEmps[0];

    setStageList(prev => [
      ...prev,
      {
        departmentId: defaultDept.id,
        departmentName: defaultDept.name,
        departmentColor: defaultDept.color || '#6366f1',
        assignedEmployeeId: firstEmp?.id,
        assignedEmployeeName: firstEmp ? `${firstEmp.firstName} ${firstEmp.lastName}` : undefined,
      },
    ]);
  };

  const handleRemoveStage = (index: number) => {
    if (stageList.length <= 1) {
      setErrorMessage('A project workflow must contain at least one stage.');
      return;
    }
    setStageList(prev => prev.filter((_, i) => i !== index));
  };

  const handleStageDeptChange = (index: number, deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return;
    const deptEmps = employees.filter(e => e.departmentId === dept.id);
    const firstEmp = deptEmps[0];

    setStageList(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        departmentId: dept.id,
        departmentName: dept.name,
        departmentColor: dept.color || '#6366f1',
        assignedEmployeeId: firstEmp?.id,
        assignedEmployeeName: firstEmp ? `${firstEmp.firstName} ${firstEmp.lastName}` : undefined,
      };
      return copy;
    });
  };

  const handleStageEmpChange = (index: number, empId: string) => {
    const emp = employees.find(e => e.id === empId);
    setStageList(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        assignedEmployeeId: empId,
        assignedEmployeeName: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
      };
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Project name is required.');
      return;
    }
    if (!client.trim()) {
      setErrorMessage('Client / Company name is required.');
      return;
    }
    if (stageList.length === 0) {
      setErrorMessage('Please configure at least one department stage.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newProj = TaskService.createProject(
        {
          name,
          client,
          description,
          priority,
          startDate,
          targetDate,
          departmentSequence: stageList,
        },
        currentUser,
        currentEmployee
      );

      onProjectCreated(newProj);
      onClose();
      setName('');
      setClient('');
      setDescription('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Team Project & Workflow"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Enterprise Client Onboarding & Setup"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Client / Account <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="e.g. Silaris Information Technologies"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Priority
            </label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-brand-500"
            >
              <option value="Urgent">Urgent</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
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
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
              Target Delivery Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
            Project Scope & Deliverables
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Comprehensive description of cross-department deliverables..."
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Sequential Stage Configuration */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Sequential Department Workflow Stages
              </span>
              <span className="text-[11px] text-slate-500">
                Work passes sequentially stage-by-stage (Stage 1 is Active; subsequent stages remain Locked until submitted).
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddStage}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Stage
            </Button>
          </div>

          <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            {stageList.map((stg, idx) => {
              const deptEmps = employees.filter(e => e.departmentId === stg.departmentId);
              return (
                <div
                  key={idx}
                  className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center gap-3"
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-700 w-full md:w-auto">
                    <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-extrabold text-[11px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="shrink-0">Stage {idx + 1}:</span>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                    <div>
                      <select
                        value={stg.departmentId}
                        onChange={e => handleStageDeptChange(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                      >
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={stg.assignedEmployeeId || ''}
                        onChange={e => handleStageEmpChange(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">-- Assign Department Lead --</option>
                        {deptEmps.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveStage(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Remove Stage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Project...' : 'Create Team Project & Pipeline'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
