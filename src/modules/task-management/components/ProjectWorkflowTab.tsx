import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  Lock,
  RotateCcw,
  ArrowRight,
  Send,
  Calendar,
  User,
  Shield,
  MessageSquare,
  Activity,
  AlertTriangle,
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { TaskService } from '../../../services/taskService';
import { TeamProject, ProjectStage, ProjectStatus } from '../../../database/schema';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';

interface ProjectWorkflowTabProps {
  projects: TeamProject[];
  selectedProject: TeamProject | null;
  onSelectProject: (project: TeamProject) => void;
  onProjectUpdated: (project: TeamProject) => void;
}

export const ProjectWorkflowTab: React.FC<ProjectWorkflowTabProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  onProjectUpdated,
}) => {
  const { currentUser, currentEmployee } = useAuth();
  const currentProj = selectedProject || projects[0] || null;

  const [commentText, setCommentText] = useState('');
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [actionError, setActionError] = useState('');

  if (!currentProj) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
        <Layers className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">No project workflows available</h3>
        <p className="text-xs text-slate-500">Please create a project first from the Team Projects tab.</p>
      </div>
    );
  }

  const currIdx = currentProj.currentStageIndex;
  const currentStage = currentProj.stages[currIdx];
  const canReturn = currIdx > 0 && currentProj.status === 'In Progress';
  const canAdvance = currentProj.status === 'In Progress' && currentStage?.status === 'Active';

  const handleAdvanceStage = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    try {
      const updated = TaskService.advanceProjectStage(
        currentProj.id,
        advanceNotes.trim(),
        [],
        currentUser,
        currentEmployee
      );
      if (updated) {
        onProjectUpdated(updated);
        setIsAdvanceModalOpen(false);
        setAdvanceNotes('');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit stage.');
    }
  };

  const handleReturnStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnReason.trim()) {
      setActionError('Please specify the reason for returning the stage.');
      return;
    }
    setActionError('');
    try {
      const updated = TaskService.returnProjectStage(
        currentProj.id,
        returnReason.trim(),
        currentUser,
        currentEmployee
      );
      if (updated) {
        onProjectUpdated(updated);
        setIsReturnModalOpen(false);
        setReturnReason('');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to return stage.');
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const updated = TaskService.addProjectComment(
      currentProj.id,
      commentText.trim(),
      currentStage?.id,
      currentUser,
      currentEmployee
    );
    if (updated) {
      onProjectUpdated(updated);
      setCommentText('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Selector & Overview Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide shrink-0">
            Selected Project Workflow:
          </label>
          <select
            value={currentProj.id}
            onChange={e => {
              const p = projects.find(x => x.id === e.target.value);
              if (p) onSelectProject(p);
            }}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 max-w-md"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.projectCode} — {p.name} ({p.client}) [{p.status}]
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={currentProj.status === 'Completed' ? 'success' : 'purple'}>
            Status: {currentProj.status}
          </Badge>
          <span className="text-xs text-slate-500 font-semibold">
            Target Delivery: <span className="font-bold text-slate-900">{currentProj.targetDate}</span>
          </span>
        </div>
      </div>

      {/* Hero Pipeline Card */}
      <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-md relative overflow-hidden space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-brand-300 font-bold px-2 py-0.5 bg-brand-950/80 rounded border border-brand-800">
                {currentProj.projectCode}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-900/80 text-brand-200 border border-brand-700">
                Client: {currentProj.client}
              </span>
              <Badge variant={currentProj.priority === 'Urgent' ? 'danger' : 'warning'}>
                {currentProj.priority} Priority
              </Badge>
            </div>
            <h2 className="text-xl font-extrabold text-white">{currentProj.name}</h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {currentProj.description || 'Cross-department sequential workflow pipeline.'}
            </p>
          </div>

          <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-2xl text-center shrink-0 min-w-[200px]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Department Stage</span>
            <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-2 justify-center mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Stage {currIdx + 1}: {currentProj.currentDepartmentName}
            </span>
          </div>
        </div>

        {/* Sequential Visual Workflow Stepper */}
        <div className="pt-2 overflow-x-auto pb-2">
          <div className="flex items-center min-w-max gap-3">
            {currentProj.stages.map((stage, idx) => {
              const isCompleted = stage.status === 'Completed';
              const isActive = stage.status === 'Active';
              const isReturned = stage.status === 'Returned';
              const isLocked = stage.status === 'Locked';

              return (
                <React.Fragment key={stage.id}>
                  <div
                    className={`p-4 rounded-2xl border flex items-center gap-3.5 min-w-[220px] transition-all ${
                      isActive
                        ? 'bg-brand-950/80 border-brand-400 ring-2 ring-brand-400/30 shadow-lg'
                        : isCompleted
                        ? 'bg-emerald-950/60 border-emerald-500/80'
                        : isReturned
                        ? 'bg-amber-950/60 border-amber-500/80'
                        : 'bg-slate-800/60 border-slate-700 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isActive
                          ? 'bg-brand-500 text-white shadow-md'
                          : isReturned
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check className="w-5 h-5" /> : isLocked ? <Lock className="w-4 h-4" /> : idx + 1}
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">
                        {stage.departmentName}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-300 block">
                        {isCompleted ? '✓ Completed' : isActive ? '● Active In Progress' : isReturned ? '↺ Revision Required' : 'Locked'}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        Lead: {stage.assignedEmployeeName || 'Department Head'}
                      </span>
                    </div>
                  </div>

                  {idx < currentProj.stages.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-slate-500 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Stage Controls */}
      {currentProj.status === 'In Progress' && (
        <div className="p-5 bg-gradient-to-r from-brand-50 via-indigo-50 to-purple-50 border border-brand-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-0.5">
            <span className="text-sm font-extrabold text-brand-950 block">
              Active Stage {currIdx + 1} Execution Controls ({currentProj.currentDepartmentName}):
            </span>
            <p className="text-xs text-slate-600">
              Complete deliverables for {currentProj.currentDepartmentName} and hand off to next department, or return to previous department with revision instructions.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {canReturn && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActionError('');
                  setIsReturnModalOpen(true);
                }}
                className="border-amber-400 text-amber-900 bg-white hover:bg-amber-100 font-bold"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Return to Previous Dept
              </Button>
            )}
            {canAdvance && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setActionError('');
                  setIsAdvanceModalOpen(true);
                }}
                className="shadow-sm font-bold"
              >
                <ArrowRight className="w-4 h-4 mr-1.5" />
                Submit to Next Department
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Grid: Detailed Stage Breakdown & Discussion Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stage Timeline Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" />
            Detailed Stage Execution Log
          </h3>

          <div className="space-y-3">
            {currentProj.stages.map((stage, idx) => (
              <div
                key={stage.id}
                className={`p-4 rounded-2xl border transition-all ${
                  stage.status === 'Active'
                    ? 'bg-white border-brand-400 shadow-sm ring-1 ring-brand-400/30'
                    : stage.status === 'Completed'
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : stage.status === 'Returned'
                    ? 'bg-amber-50/40 border-amber-200'
                    : 'bg-slate-50 border-slate-200 opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        stage.status === 'Completed'
                          ? 'bg-emerald-600'
                          : stage.status === 'Active'
                          ? 'bg-brand-600'
                          : stage.status === 'Returned'
                          ? 'bg-amber-600'
                          : 'bg-slate-400'
                      }`}
                    >
                      {stage.status === 'Completed' ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">
                        Stage {idx + 1}: {stage.departmentName}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Assigned Lead: <span className="font-bold text-slate-700">{stage.assignedEmployeeName || 'Department Head'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {stage.status === 'Completed' && <Badge variant="success">Completed</Badge>}
                    {stage.status === 'Active' && <Badge variant="purple">Active Stage</Badge>}
                    {stage.status === 'Returned' && <Badge variant="warning">Returned</Badge>}
                    {stage.status === 'Locked' && <Badge variant="outline">Locked</Badge>}
                  </div>
                </div>

                {stage.submissionNotes && (
                  <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700">
                    <span className="font-bold text-slate-900 block mb-0.5">Submission & Delivery Notes:</span>
                    {stage.submissionNotes}
                  </div>
                )}

                {stage.returnReason && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                    <span className="font-bold text-amber-950 block mb-0.5">Return Reason & Revisions:</span>
                    {stage.returnReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Discussion & Audit Log */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              Cross-Department Notes
            </h3>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {!currentProj.comments || currentProj.comments.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No notes or discussion logged yet.
                </div>
              ) : (
                currentProj.comments.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{c.authorName}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleAddComment} className="flex gap-2 pt-3 border-t border-slate-200">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Post update or note for stage leads..."
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500"
            />
            <Button type="submit" variant="primary" size="sm">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Advance Stage Modal */}
      {isAdvanceModalOpen && (
        <Modal
          isOpen={isAdvanceModalOpen}
          onClose={() => setIsAdvanceModalOpen(false)}
          title={`Submit Stage ${currIdx + 1} (${currentProj.currentDepartmentName})`}
          size="md"
        >
          <form onSubmit={handleAdvanceStage} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {actionError}
              </div>
            )}

            <p className="text-xs text-slate-700 leading-relaxed">
              You are completing deliverables for <span className="font-bold text-slate-900">{currentProj.currentDepartmentName}</span> and advancing the pipeline to{' '}
              <span className="font-bold text-brand-700">
                {currIdx + 1 < currentProj.stages.length
                  ? `Stage ${currIdx + 2} (${currentProj.stages[currIdx + 1].departmentName})`
                  : 'Final Delivery & Completion'}
              </span>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
                Submission Notes & Handoff Summary
              </label>
              <textarea
                value={advanceNotes}
                onChange={e => setAdvanceNotes(e.target.value)}
                rows={3}
                placeholder="Detail deliverables completed, file links, and notes for next team..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdvanceModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Confirm Handoff & Submit
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Return Stage Modal */}
      {isReturnModalOpen && (
        <Modal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          title={`Return Project to Stage ${currIdx} (${currentProj.stages[currIdx - 1]?.departmentName})`}
          size="md"
        >
          <form onSubmit={handleReturnStage} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {actionError}
              </div>
            )}

            <p className="text-xs text-slate-700 leading-relaxed">
              This will return the active project back to{' '}
              <span className="font-bold text-amber-800">
                {currentProj.stages[currIdx - 1]?.departmentName}
              </span>{' '}
              for rework and clarification.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
                Reason for Return / Action Items Required <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                rows={3}
                placeholder="Specify missing requirements or corrections needed..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsReturnModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                Confirm Return
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
