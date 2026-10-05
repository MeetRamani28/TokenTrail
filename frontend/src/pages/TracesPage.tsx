import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTraces } from '../api/queries';
import { useAppSelector } from '../store';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

export const TracesPage: React.FC = () => {
  const navigate = useNavigate();
  const dateRange = useAppSelector((state) => state.ui.dateRange);
  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);

  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'error'>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const pageSize = 15;

  const { data, isLoading } = useTraces(
    {
      limit: pageSize,
      offset: page * pageSize,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      model: modelFilter !== 'all' ? modelFilter : undefined,
      tag: tagFilter.trim() ? tagFilter.trim() : undefined,
      range: dateRange,
    },
    selectedProjectId
  );

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success('Trace ID copied to clipboard');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Execution Traces</h1>
          <p className="text-sm text-slate-400 mt-1">
            Search, filter, and inspect LLM requests and agent workflows.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => { setStatusFilter('all'); setPage(0); }}
            className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Status
          </button>
          <button
            onClick={() => { setStatusFilter('ok'); setPage(0); }}
            className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
              statusFilter === 'ok'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Success
          </button>
          <button
            onClick={() => { setStatusFilter('error'); setPage(0); }}
            className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
              statusFilter === 'error'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Errors
          </button>
        </div>

        {/* Tag Filter Input */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by tag (e.g. prod, rag)..."
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPage(0); }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Model Filter Input */}
        <div className="min-w-[160px]">
          <input
            type="text"
            placeholder="Filter by model..."
            value={modelFilter === 'all' ? '' : modelFilter}
            onChange={(e) => { setModelFilter(e.target.value.trim() ? e.target.value : 'all'); setPage(0); }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {data?.traces.length ?? 0} of {data?.total_count ?? 0} traces
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Trace Name / ID</th>
                <th className="py-3 px-4">Models</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Tokens</th>
                <th className="py-3 px-4">Est. Cost</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                [1, 2, 3, 4, 5, 6].map((i) => (
                  <tr key={i} className="animate-pulse border-b border-slate-800/40">
                    <td className="py-3.5 px-4"><div className="h-5 w-14 bg-slate-800/80 rounded-full" /></td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-44 bg-slate-800/80 rounded mb-1.5" />
                      <div className="h-3 w-28 bg-slate-800/50 rounded" />
                    </td>
                    <td className="py-3.5 px-4"><div className="h-4 w-28 bg-slate-800/70 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-14 bg-slate-800/70 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-12 bg-slate-800/70 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-800/70 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-24 bg-slate-800/70 rounded" /></td>
                  </tr>
                ))
              ) : data && data.traces.length > 0 ? (
                data.traces.map((trace) => (
                  <tr
                    key={trace.trace_id}
                    onClick={() => navigate(`/traces/${trace.trace_id}`)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Status */}
                    <td className="py-3 px-4">
                      {trace.status === 'ok' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium text-[11px]">
                          <AlertCircle className="w-3 h-3" />
                          ERROR
                        </span>
                      )}
                    </td>

                    {/* Name & ID */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {trace.name}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                        <span>{trace.trace_id}</span>
                        <button
                          onClick={(e) => copyToClipboard(trace.trace_id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-slate-300 transition-opacity"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Models */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {trace.models.length > 0 ? (
                          trace.models.map((m) => (
                            <span
                              key={m}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]"
                            >
                              {m}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 font-mono">
                      {trace.duration_ms !== null ? `${Math.round(trace.duration_ms)}ms` : '—'}
                    </td>

                    {/* Tokens */}
                    <td className="py-3 px-4 font-mono">
                      {trace.total_tokens.toLocaleString()}
                    </td>

                    {/* Cost */}
                    <td className="py-3 px-4 font-mono text-emerald-400 font-medium">
                      ${trace.total_cost.toFixed(5)}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(trace.started_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-40 stroke-1" />
                    <span>No traces found matching criteria</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <div>
            Page {page + 1}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.has_more}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
