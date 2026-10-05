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
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '../../api/queries';
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
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingProject, setDeletingProject] = useState<ProjectItem | null>(null);
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

  const handleRenameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        projectId: editingProject.id,
        name: editName.trim(),
      });
      toast.success(`Project renamed to "${editName.trim()}"`);
      setEditingProject(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename project');
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;

    try {
      await deleteProjectMutation.mutateAsync(deletingProject.id);
      toast.success(`Project "${deletingProject.name}" deleted successfully`);

      // Switch active project if we deleted the currently selected one
      const remaining = projects.filter((p) => p.id !== deletingProject.id);
      if (remaining.length > 0 && selectedProjectId === deletingProject.id) {
        dispatch(setSelectedProjectId(remaining[0].id));
      }
      setDeletingProject(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast.success('API Key copied to clipboard!');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Render Rename Project Modal via Portal
  const renderRenameModal = () => {
    if (!editingProject) return null;

    return createPortal(
      <AnimatePresence>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !updateProjectMutation.isPending && setEditingProject(null)}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-[#0d131f] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5 z-10"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Rename Project</h3>
                  <p className="text-xs text-slate-400">Update project display label</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                disabled={updateProjectMutation.isPending}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200">New Project Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. SQLGuard Production"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  disabled={updateProjectMutation.isPending}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProjectMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  {updateProjectMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </AnimatePresence>,
      document.body
    );
  };

  // Render Delete Project Modal via Portal
  const renderDeleteModal = () => {
    if (!deletingProject) return null;

    return createPortal(
      <AnimatePresence>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deleteProjectMutation.isPending && setDeletingProject(null)}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-[#0d131f] border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-5 z-10"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Delete Project</h3>
                  <p className="text-xs text-rose-400 font-medium">Irreversible Action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                disabled={deleteProjectMutation.isPending}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete the project{' '}
                <strong className="text-white font-semibold">"{deletingProject.name}"</strong>?
              </p>
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300/90 space-y-1">
                <p>• All traces, spans, and telemetry associated with this project will be deleted.</p>
                <p>• Any SDK client using this project's API key will be immediately deactivated.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                disabled={deleteProjectMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deleteProjectMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors disabled:opacity-50 shadow-md shadow-rose-600/30 cursor-pointer"
              >
                {deleteProjectMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Yes, Delete Project</span>
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>,
      document.body
    );
  };

  // Render Create Modal in document.body via Portal to prevent any clipping from parent overflow or backdrop-blur
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

      {/* Dropdown Menu - 100% Solid Opaque Background (#0B0F17) with z-[999] */}
      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-80 rounded-xl border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.95)] py-2 z-[999] animate-in fade-in zoom-in-95 duration-100"
          style={{ backgroundColor: '#0B0F17', opacity: 1 }}
        >
          <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Switch Project
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 py-1">
            {projects.map((proj) => {
              const isSelected = proj.id === (activeProject?.id || selectedProjectId);
              return (
                <div
                  key={proj.id}
                  className={`group flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-slate-200 hover:bg-slate-800/70'
                  }`}
                >
                  {/* Project Select Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectProject(proj)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer mr-2"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0 flex items-center justify-center">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-slate-400 transition-colors" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`truncate text-xs ${isSelected ? 'font-bold text-white' : 'font-medium text-slate-200'}`}>
                        {proj.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate">
                        {proj.key_prefix ? `${proj.key_prefix}...` : 'No API key'}
                      </span>
                    </div>
                  </button>

                  {/* Action Buttons: Rename & Delete */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditName(proj.name);
                        setEditingProject(proj);
                        setIsOpen(false);
                      }}
                      className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-700/60 transition-colors cursor-pointer"
                      title={`Rename "${proj.name}"`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProject(proj);
                          setIsOpen(false);
                        }}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title={`Delete "${proj.name}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-800 my-1" />

          {/* Create Project Button */}
          <div className="px-2 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/15 rounded-lg font-bold transition-colors cursor-pointer border border-dashed border-emerald-500/30"
            >
              <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>+ Create New Project</span>
            </button>
          </div>
        </div>
      )}

      {/* Centered Modals in Portals */}
      {renderModal()}
      {renderRenameModal()}
      {renderDeleteModal()}
    </div>
  );
};
