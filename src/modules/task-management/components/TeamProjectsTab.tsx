import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Calendar,
  Building2,
  ArrowRight,
  CheckCircle2,
  Lock,
  RotateCcw,
  Sliders,
  Check,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { TeamProject, ProjectStatus } from '../../../database/schema';

interface TeamProjectsTabProps {
  projects: TeamProject[];
  onSelectProject: (project: TeamProject) => void;
  onOpenCreateModal: () => void;
  onNavigateToWorkflow: (project: TeamProject) => void;
}

export const TeamProjectsTab: React.FC<TeamProjectsTabProps> = ({
  projects,
  onSelectProject,
  onOpenCreateModal,
  onNavigateToWorkflow,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      {/* Search & Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects by name, code or client (e.g. Silaris)..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
            <option value="Draft">Draft</option>
          </select>

          <Button
            type="button"
            variant="primary"
            onClick={onOpenCreateModal}
            className="shadow-sm font-bold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Project
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredProjects.length === 0 ? (
          <div className="lg:col-span-2 p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">No team projects found</h3>
            <p className="text-xs text-slate-500">
              Create a multi-department project with sequential stages.
            </p>
          </div>
        ) : (
          filteredProjects.map(project => {
            const currIdx = project.currentStageIndex;
            const stagesCount = project.stages.length;

            return (
              <div
                key={project.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-brand-300 hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                        {project.projectCode}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-brand-50 text-brand-800 border border-brand-200">
                        {project.client}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge variant={project.priority === 'Urgent' ? 'danger' : 'warning'}>
                        {project.priority}
                      </Badge>
                      <Badge variant={project.status === 'Completed' ? 'success' : 'purple'}>
                        {project.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Title & Scope */}
                  <div>
                    <h3
                      onClick={() => onSelectProject(project)}
                      className="text-base font-extrabold text-slate-900 hover:text-brand-600 transition-colors cursor-pointer"
                    >
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {project.description || 'Cross-department sequential deliverables.'}
                    </p>
                  </div>

                  {/* Sequential Pipeline Mini-Stepper */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Workflow Stages ({stagesCount}):</span>
                      <span className="font-bold text-brand-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse"></span>
                        Active: {project.currentDepartmentName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                      {project.stages.map((stage, idx) => {
                        const isCompleted = stage.status === 'Completed';
                        const isActive = stage.status === 'Active';
                        const isReturned = stage.status === 'Returned';
                        const isLocked = stage.status === 'Locked';

                        return (
                          <React.Fragment key={stage.id}>
                            <div
                              title={`${stage.departmentName} (${stage.status})`}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold shrink-0 flex items-center gap-1 border transition-all ${
                                isActive
                                  ? 'bg-brand-600 text-white border-brand-700 shadow-sm ring-2 ring-brand-500/20'
                                  : isCompleted
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : isReturned
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-white text-slate-400 border-slate-200'
                              }`}
                            >
                              {isCompleted ? <Check className="w-3 h-3" /> : isLocked ? <Lock className="w-2.5 h-2.5" /> : idx + 1}
                              <span>{stage.departmentName}</span>
                            </div>

                            {idx < project.stages.length - 1 && (
                              <span className="text-slate-300 text-xs">→</span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer Info & Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500">
                    Target: <span className="font-bold text-slate-900">{project.targetDate}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectProject(project)}
                      className="font-bold text-xs"
                    >
                      Details
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigateToWorkflow(project)}
                      className="font-bold text-xs"
                    >
                      Stage Workflow
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
