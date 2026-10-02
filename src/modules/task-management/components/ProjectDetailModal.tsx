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
  Paperclip,
  Check,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { TaskService } from '../../../services/taskService';
import { TeamProject, ProjectStage, ProjectStatus, TaskPriority } from '../../../database/schema';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';

interface ProjectDetailModalProps {
  project: TeamProject | null;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: (project: TeamProject) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  isOpen,
  onClose,
  onProjectUpdated,
}) => {
  const { currentUser, currentEmployee } = useAuth();
  const [activeTab, setActiveTab] = useState<'workflow' | 'comments' | 'activity'>('workflow');
  const [commentText, setCommentText] = useState('');

  // Advance & Return Modals
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [actionError, setActionError] = useState('');

  if (!project) return null;

  const currIdx = project.currentStageIndex;
  const currentStage = project.stages[currIdx];
  const canReturn = currIdx > 0 && project.status === 'In Progress';
  const canAdvance = project.status === 'In Progress' && currentStage?.status === 'Active';

  const handleAdvanceStage = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    try {
      const updated = TaskService.advanceProjectStage(
        project.id,
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
        project.id,
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
      project.id,
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
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${project.projectCode} — ${project.name}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Header Summary Banner */}
          <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-brand-300 font-bold px-2 py-0.5 bg-brand-950/60 rounded-md border border-brand-800/60">
                  {project.projectCode}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-brand-900/80 text-brand-200 border border-brand-700">
                  Client: {project.client}
                </span>
                <Badge variant={project.status === 'Completed' ? 'success' : 'purple'}>
                  {project.status}
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-white pt-1">{project.name}</h3>
              <p className="text-xs text-slate-300">
                Project Owner: <span className="text-white font-semibold">{project.ownerName}</span> • Target: <span className="text-brand-300 font-semibold">{project.targetDate}</span>
              </p>
            </div>

            {/* Active Department Indicator */}
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-center shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Active Stage</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-center mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Stage {currIdx + 1}: {project.currentDepartmentName}
              </span>
            </div>
          </div>

          {/* Action Bar for Active Stage */}
          {project.status === 'In Progress' && (
            <div className="p-4 bg-gradient-to-r from-brand-50 via-indigo-50 to-purple-50 border border-brand-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-brand-950">
                <span className="font-bold block">Stage {currIdx + 1} Action Controls ({project.currentDepartmentName}):</span>
                <span className="text-slate-600">
                  Submit to advance to Stage {currIdx + 2 < project.stages.length ? currIdx + 2 : 'Final Delivery'} or return to previous department for corrections.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canReturn && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActionError('');
                      setIsReturnModalOpen(true);
                    }}
                    className="border-amber-400 text-amber-900 hover:bg-amber-100 font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Return Stage
                  </Button>
                )}
                {canAdvance && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setActionError('');
                      setIsAdvanceModalOpen(true);
                    }}
                    className="shadow-sm font-bold"
                  >
                    <ArrowRight className="w-3.5 h-3.5 mr-1" />
                    Submit to Next Stage
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('workflow')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'workflow'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              Sequential Stages Pipeline ({project.stages?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'comments'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Project Discussion ({project.comments?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'activity'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              Stage Transition Audit ({project.activities?.length || 0})
            </button>
          </div>

          {/* TAB 1: Sequential Workflow Stage Cards */}
          {activeTab === 'workflow' && (
            <div className="space-y-4">
              {/* Stepper Pipeline Diagram */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 overflow-x-auto">
                <div className="flex items-center min-w-max gap-3">
                  {project.stages.map((stage, idx) => {
                    const isCompleted = stage.status === 'Completed';
                    const isActive = stage.status === 'Active';
                    const isReturned = stage.status === 'Returned';
                    const isLocked = stage.status === 'Locked';

                    return (
                      <React.Fragment key={stage.id}>
                        <div
                          className={`p-3.5 rounded-xl border flex items-center gap-3 min-w-[200px] transition-all ${
                            isActive
                              ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                              : isCompleted
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : isReturned
                              ? 'bg-amber-50 border-amber-300'
                              : 'bg-white border-slate-200 opacity-60'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-600 text-white'
                                : isActive
                                ? 'bg-brand-600 text-white'
                                : isReturned
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isCompleted ? <Check className="w-4 h-4" /> : isLocked ? <Lock className="w-3.5 h-3.5" /> : idx + 1}
                          </div>

                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block truncate">
                              {stage.departmentName}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 block">
                              {isCompleted ? '✓ Completed' : isActive ? '● In Progress' : isReturned ? '↺ Needs Revision' : 'Locked'}
                            </span>
                          </div>
                        </div>

                        {idx < project.stages.length - 1 && (
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Stage Cards */}
              <div className="space-y-3">
                {project.stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className={`p-4 rounded-xl border transition-all ${
                      stage.status === 'Active'
                        ? 'bg-white border-brand-400 shadow-sm ring-1 ring-brand-400/20'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">
                            Stage {idx + 1}: {stage.departmentName}
                          </h4>
                          {stage.status === 'Completed' && (
                            <Badge variant="success">Completed</Badge>
                          )}
                          {stage.status === 'Active' && (
                            <Badge variant="purple">Active Stage</Badge>
                          )}
                          {stage.status === 'Returned' && (
                            <Badge variant="warning">Returned for Revision</Badge>
                          )}
                          {stage.status === 'Locked' && (
                            <Badge variant="outline">Locked</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          Assigned Lead: <span className="font-semibold text-slate-800">{stage.assignedEmployeeName || 'Department Lead'}</span>
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-slate-500">
                        {stage.startDate && <div>Started: <span className="font-bold text-slate-800">{stage.startDate}</span></div>}
                        {stage.completedDate && <div>Completed: <span className="font-bold text-emerald-700">{stage.completedDate}</span></div>}
                      </div>
                    </div>

                    {stage.submissionNotes && (
                      <div className="mt-3 p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
                        <span className="font-bold text-slate-900 block mb-0.5">Submission Notes:</span>
                        {stage.submissionNotes}
                      </div>
                    )}

                    {stage.returnReason && (
                      <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                        <span className="font-bold text-amber-950 block mb-0.5">Return Reason / Feedback:</span>
                        {stage.returnReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Comments */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                {!project.comments || project.comments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No project comments yet.
                  </div>
                ) : (
                  project.comments.map(c => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          {c.authorName}{' '}
                          <span className="font-normal text-slate-500">({c.departmentName || 'Cross-Dept'})</span>
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
                  placeholder="Add note or update for all department leads..."
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500"
                />
                <Button type="submit" variant="primary" size="md">
                  <Send className="w-4 h-4 mr-1.5" />
                  Post
                </Button>
              </form>
            </div>
          )}

          {/* TAB 3: Transition Activities */}
          {activeTab === 'activity' && (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {!project.activities || project.activities.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">No project transitions logged.</div>
              ) : (
                project.activities.map(act => (
                  <div key={act.id} className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
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

      {/* Advance Stage Modal */}
      {isAdvanceModalOpen && (
        <Modal
          isOpen={isAdvanceModalOpen}
          onClose={() => setIsAdvanceModalOpen(false)}
          title={`Submit Stage ${currIdx + 1} (${project.currentDepartmentName})`}
          size="md"
        >
          <form onSubmit={handleAdvanceStage} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {actionError}
              </div>
            )}

            <p className="text-xs text-slate-700">
              You are completing work for <span className="font-bold text-slate-900">{project.currentDepartmentName}</span> and handing off the project to{' '}
              <span className="font-bold text-brand-700">
                {currIdx + 1 < project.stages.length
                  ? `Stage ${currIdx + 2} (${project.stages[currIdx + 1].departmentName})`
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
          title={`Return Project to Stage ${currIdx} (${project.stages[currIdx - 1]?.departmentName})`}
          size="md"
        >
          <form onSubmit={handleReturnStage} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {actionError}
              </div>
            )}

            <p className="text-xs text-slate-700">
              This will return the active project back to{' '}
              <span className="font-bold text-amber-800">
                {project.stages[currIdx - 1]?.departmentName}
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
    </>
  );
};
