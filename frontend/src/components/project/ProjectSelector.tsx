import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Check, Plus, FolderKanban, X, Copy, CheckCheck, Loader2 } from 'lucide-react';
import { useProjects, useCreateProject } from '../../api/queries';
import type { ProjectItem, ProjectCreated } from '../../types';
import { toast } from 'sonner';

export const ProjectSelector: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading } = useProjects();
  const createProjectMutation = useCreateProject();

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdProject, setCreatedProject] = useState<ProjectCreated | null>(null);

  const [projectName, setProjectName] = useState('');
  const [retentionDays, setRetentionDays] = useState(30);
  const [copiedKey, setCopiedKey] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Active project ID stored in localStorage
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem('tokentrail_project_id') || '';
  });

  // Resolve active project
  const activeProject: ProjectItem | undefined =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  // Sync active project id if not explicitly set
  useEffect(() => {
    if (activeProject && !activeProjectId) {
      setActiveProjectId(activeProject.id);
      localStorage.setItem('tokentrail_project_id', activeProject.id);
    }
  }, [activeProject, activeProjectId]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProject = (project: ProjectItem) => {
    setActiveProjectId(project.id);
    localStorage.setItem('tokentrail_project_id', project.id);
    setIsOpen(false);
    toast.success(`Switched to "${project.name}"`);
    // Invalidate telemetry queries to reload with newly selected project
    queryClient.invalidateQueries({ queryKey: ['overview'] });
    queryClient.invalidateQueries({ queryKey: ['traces'] });
    queryClient.invalidateQueries({ queryKey: ['timeseries'] });
    queryClient.invalidateQueries({ queryKey: ['models-usage'] });
    queryClient.invalidateQueries({ queryKey: ['project-key'] });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const created = await createProjectMutation.mutateAsync({
        name: projectName.trim(),
        retention_days: Number(retentionDays) || 30,
      });

      setCreatedProject(created);
      setActiveProjectId(created.id);
      localStorage.setItem('tokentrail_project_id', created.id);
      setProjectName('');
      setRetentionDays(30);

      // Invalidate queries so dashboard reflects new project
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['timeseries'] });
      queryClient.invalidateQueries({ queryKey: ['models-usage'] });
      queryClient.invalidateQueries({ queryKey: ['project-key'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast.success('API Key copied to clipboard!');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-100 max-w-[140px] truncate">
          {isLoading ? 'Loading...' : activeProject?.name || 'Default Project'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Switch Project
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/40">
            {projects.map((proj) => {
              const isSelected = proj.id === (activeProject?.id || activeProjectId);
              return (
                <button
                  key={proj.id}
                  onClick={() => handleSelectProject(proj)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{proj.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {proj.key_prefix ? `${proj.key_prefix}...` : 'No API key'}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-800/80 my-1" />

          {/* Create Project Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              setIsModalOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-500/10 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Project</span>
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Create New Project</h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setCreatedProject(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdProject ? (
              /* Success State: Show New API Key */
              <div className="space-y-4 py-2">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                  🎉 Project <strong>{createdProject.name}</strong> created successfully!
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">
                    Telemetry Ingestion Key (Copy now; won't be shown again in full):
                  </label>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between font-mono text-xs text-emerald-400">
                    <span className="truncate pr-2">{createdProject.api_key}</span>
                    <button
                      onClick={() => handleCopyKey(createdProject.api_key)}
                      className="p-1 text-slate-400 hover:text-white transition-colors shrink-0"
                    >
                      {copiedKey ? (
                        <CheckCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono">
                  <p className="text-slate-300"># In your live application (e.g. Nexus RAG):</p>
                  <p className="text-emerald-400 font-semibold">export TOKENTRAIL_API_KEY="{createdProject.api_key}"</p>
                  <p className="text-emerald-400 font-semibold">export TOKENTRAIL_ENDPOINT="{window.location.origin}"</p>
                </div>

                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setCreatedProject(null);
                  }}
                  className="w-full py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-colors"
                >
                  Done & Switch to Project
                </button>
              </div>
            ) : (
              /* Form State */
              <form onSubmit={handleCreateProject} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Traces, tokens, cost calculations, and alert rules will be completely isolated
                  within this project.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Project Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. nexus-rag, support-agent, chatbot-v2"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Trace Retention (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createProjectMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    {createProjectMutation.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Create Project</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
