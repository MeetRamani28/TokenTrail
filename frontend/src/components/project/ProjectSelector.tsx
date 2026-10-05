import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Check,
  Plus,
  FolderKanban,
  X,
  Copy,
  CheckCheck,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useProjects, useCreateProject } from '../../api/queries';
import { useAppDispatch, useAppSelector } from '../../store';
import { setSelectedProjectId } from '../../store/uiSlice';
import type { ProjectItem, ProjectCreated } from '../../types';
import { toast } from 'sonner';

export const ProjectSelector: React.FC = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);

  const { data: projects = [], isLoading } = useProjects();
  const createProjectMutation = useCreateProject();

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdProject, setCreatedProject] = useState<ProjectCreated | null>(null);

  const [projectName, setProjectName] = useState('');
  const [retentionDays, setRetentionDays] = useState(30);
  const [copiedKey, setCopiedKey] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolve active project
  const activeProject: ProjectItem | undefined =
    projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Auto-sync Redux if not initialized or invalid
  useEffect(() => {
    if (projects.length > 0) {
      if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
        const defaultProj = projects[0];
        dispatch(setSelectedProjectId(defaultProj.id));
      }
    }
  }, [projects, selectedProjectId, dispatch]);

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
    dispatch(setSelectedProjectId(project.id));
    setIsOpen(false);
    toast.success(`Active project: "${project.name}"`);

    // Invalidate and refetch all project-scoped queries
    queryClient.invalidateQueries({ queryKey: ['overview'] });
    queryClient.invalidateQueries({ queryKey: ['traces'] });
    queryClient.invalidateQueries({ queryKey: ['timeseries'] });
    queryClient.invalidateQueries({ queryKey: ['models'] });
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
      dispatch(setSelectedProjectId(created.id));
      setProjectName('');
      setRetentionDays(30);

      // Invalidate queries so dashboard reflects newly selected project immediately
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['timeseries'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
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

  // Render modal in document.body via Portal to prevent any clipping from parent overflow or backdrop-blur
  const renderModal = () => {
    if (!isModalOpen) return null;

    return createPortal(
      <AnimatePresence>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsModalOpen(false);
              setCreatedProject(null);
            }}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Dialog Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg bg-[#0d131f] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5 z-10"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Create New Project</h3>
                  <p className="text-xs text-slate-400">Separate traces, costs, and API keys</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setCreatedProject(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdProject ? (
              /* Success State: Show New API Key */
              <div className="space-y-4 py-1">
                <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Project <strong>{createdProject.name}</strong> created and activated!
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Telemetry Ingestion Key (Copy now; won't be shown again in full):
                  </label>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between font-mono text-xs text-emerald-400">
                    <span className="truncate pr-2 select-all font-semibold">{createdProject.api_key}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(createdProject.api_key)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-200 hover:text-white transition-colors shrink-0 cursor-pointer"
                      title="Copy Key"
                    >
                      {copiedKey ? (
                        <CheckCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5 bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 font-mono">
                  <p className="text-slate-400 text-[11px]"># Use in your live project (e.g. Nexus RAG):</p>
                  <p className="text-emerald-400">export TOKENTRAIL_API_KEY="{createdProject.api_key}"</p>
                  <p className="text-emerald-400">export TOKENTRAIL_ENDPOINT="{import.meta.env.VITE_API_URL || window.location.origin}"</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCreatedProject(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Go to Project Dashboard
                </button>
              </div>
            ) : (
              /* Project Creation Form */
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200">Project Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. nexus-rag, customer-support-agent, chatbot-v2"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Data Retention (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  />
                  <p className="text-[11px] text-slate-400">
                    Traces older than this retention period will be automatically pruned.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createProjectMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    {createProjectMutation.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Create Project</span>
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </AnimatePresence>,
      document.body
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs text-slate-200 transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <FolderKanban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="font-semibold text-white max-w-[180px] truncate">
          {isLoading ? 'Loading...' : activeProject?.name || 'Default Project'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu - 100% Solid Opaque Background (#0B0F17) with z-[100] */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 rounded-xl bg-[#0B0F17] border border-slate-700 shadow-2xl py-2 z-[100] animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Switch Project
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/80">
            {projects.map((proj) => {
              const isSelected = proj.id === (activeProject?.id || selectedProjectId);
              return (
                <button
                  type="button"
                  key={proj.id}
                  onClick={() => handleSelectProject(proj)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                      : 'text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate text-white font-medium">{proj.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {proj.key_prefix ? `${proj.key_prefix}...` : 'No API key'}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-800 my-1.5" />

          {/* Create Project Button */}
          <div className="px-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-500/15 rounded-lg font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>+ Create New Project</span>
            </button>
          </div>
        </div>
      )}

      {/* Centered Modal in Portal */}
      {renderModal()}
    </div>
  );
};
