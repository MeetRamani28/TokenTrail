import React from 'react';
import { useModels } from '../api/queries';
import { useAppSelector } from '../store';
import {
  Coins,
  Cpu,
  Zap,
} from 'lucide-react';

export const ModelsPage: React.FC = () => {
  const dateRange = useAppSelector((state) => state.ui.dateRange);
  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);

  const { data: models, isLoading } = useModels(dateRange, selectedProjectId);

  const topCostModel = models && models.length > 0
    ? [...models].sort((a, b) => b.total_cost - a.total_cost)[0]
    : null;

  const topCalledModel = models && models.length > 0
    ? [...models].sort((a, b) => b.total_calls - a.total_calls)[0]
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Models & Usage</h1>
        <p className="text-sm text-slate-400 mt-1">
          Detailed cost attribution, token distribution, and latency benchmarks per LLM model.
        </p>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Highest Spend Model</span>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {topCostModel ? topCostModel.model : 'None yet'}
            </div>
            <p className="text-xs text-emerald-400 font-mono mt-0.5">
              {topCostModel ? `$${topCostModel.total_cost.toFixed(4)} total` : '$0.00'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Most Invoked Model</span>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {topCalledModel ? topCalledModel.model : 'None yet'}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {topCalledModel ? `${topCalledModel.total_calls.toLocaleString()} requests` : '0 requests'}
            </p>
          </div>
        </div>
      </div>

      {/* Models Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
                <th className="py-3 px-4">Model Name</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4 text-right">Invocations</th>
                <th className="py-3 px-4 text-right">Prompt Tokens</th>
                <th className="py-3 px-4 text-right">Completion Tokens</th>
                <th className="py-3 px-4 text-right">Total Tokens</th>
                <th className="py-3 px-4 text-right">Total Spend</th>
                <th className="py-3 px-4 text-right">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading model statistics...
                  </td>
                </tr>
              ) : models && models.length > 0 ? (
                models.map((m) => (
                  <tr key={m.model} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white font-mono">
                      {m.model}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {m.provider || 'unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {m.total_calls.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {m.prompt_tokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {m.completion_tokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                      {m.total_tokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                      ${m.total_cost.toFixed(5)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {m.avg_latency_ms !== null ? `${Math.round(m.avg_latency_ms)}ms` : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Cpu className="w-8 h-8 mx-auto mb-2 opacity-40 stroke-1" />
                    <span>No model calls recorded yet. Wrap an OpenAI or Groq client to see live stats.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
