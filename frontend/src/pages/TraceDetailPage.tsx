import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTraceDetail } from '../api/queries';
import { useAppSelector } from '../store';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Database,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

export const TraceDetailPage: React.FC = () => {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);

  const { data: trace, isLoading, error } = useTraceDetail(traceId || null, selectedProjectId);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-500 max-w-7xl mx-auto">
        Loading trace waterfall...
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="py-24 text-center text-slate-500 max-w-7xl mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-semibold text-white">Trace Not Found</h2>
        <p className="text-sm text-slate-400">
          The requested trace does not exist or you do not have permission to view it.
        </p>
        <button
          onClick={() => navigate('/traces')}
          className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 hover:bg-slate-800"
        >
          Back to Traces
        </button>
      </div>
    );
  }

  const totalDuration = Math.max(
    1,
    trace.duration_ms ??
      Math.max(
        ...trace.spans.map((s) => s.offset_ms + (s.duration_ms ?? 0)),
        100
      )
  );

  const selectedSpan = trace.spans.find((s) => s.span_id === selectedSpanId) || trace.spans[0];

  const getSpanTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'llm':
        return <Zap className="w-3.5 h-3.5 text-cyan-400" />;
      case 'tool':
        return <Wrench className="w-3.5 h-3.5 text-indigo-400" />;
      case 'retrieval':
        return <Database className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/traces')}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">{trace.name}</h1>
            {trace.status === 'ok' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                <CheckCircle2 className="w-3 h-3" /> OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs">
                <AlertCircle className="w-3 h-3" /> ERROR
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
            <span>{trace.trace_id}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(trace.trace_id);
                toast.success('Trace ID copied');
              }}
              className="hover:text-slate-300"
            >
              <Copy className="w-3 h-3" />
            </button>
          </p>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
        <div>
          <span className="text-slate-400">Total Latency</span>
          <div className="text-base font-bold text-white font-mono mt-0.5">
            {trace.duration_ms !== null ? `${Math.round(trace.duration_ms)}ms` : '—'}
          </div>
        </div>
        <div>
          <span className="text-slate-400">Tokens</span>
          <div className="text-base font-bold text-white font-mono mt-0.5">
            {trace.total_tokens.toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-slate-400">Total Cost</span>
          <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
            ${trace.total_cost.toFixed(5)}
          </div>
        </div>
        <div>
          <span className="text-slate-400">Spans Count</span>
          <div className="text-base font-bold text-white font-mono mt-0.5">
            {trace.spans.length}
          </div>
        </div>
      </div>

      {/* Waterfall & Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Waterfall Timeline (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white">Execution Waterfall</h2>
            <span className="text-xs font-mono text-slate-500">{Math.round(totalDuration)}ms total</span>
          </div>

          {/* Timeline ruler */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 border-b border-slate-800/40 pb-1">
            <span>0ms</span>
            <span>{Math.round(totalDuration * 0.25)}ms</span>
            <span>{Math.round(totalDuration * 0.5)}ms</span>
            <span>{Math.round(totalDuration * 0.75)}ms</span>
            <span>{Math.round(totalDuration)}ms</span>
          </div>

          {/* Span Bars */}
          <div className="space-y-2">
            {trace.spans.map((span) => {
              const isSelected = selectedSpan?.span_id === span.span_id;
              const leftPercent = Math.min(95, (span.offset_ms / totalDuration) * 100);
              const dur = span.duration_ms ?? 10;
              const widthPercent = Math.max(3, Math.min(100 - leftPercent, (dur / totalDuration) * 100));

              return (
                <div
                  key={span.span_id}
                  onClick={() => setSelectedSpanId(span.span_id)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/80 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-slate-200">
                      {getSpanTypeIcon(span.type)}
                      <span>{span.name}</span>
                      {span.model && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">
                          {span.model}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      {span.ttft_ms !== null && (
                        <span className="text-emerald-400" title="Time to first token">
                          TTFT: {Math.round(span.ttft_ms)}ms
                        </span>
                      )}
                      <span>{span.duration_ms !== null ? `${Math.round(span.duration_ms)}ms` : '—'}</span>
                    </div>
                  </div>

                  {/* Relative Timeline Bar */}
                  <div className="relative h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`absolute top-0 bottom-0 rounded-full transition-all ${
                        span.status === 'error'
                          ? 'bg-rose-500'
                          : span.type === 'llm'
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Span Inspector (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white">Span Inspector</h2>
            {selectedSpan && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {selectedSpan.type.toUpperCase()}
              </span>
            )}
          </div>

          {selectedSpan ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-500 font-mono text-[10px]">SPAN NAME</span>
                <p className="text-white font-medium mt-0.5">{selectedSpan.name}</p>
              </div>

              {selectedSpan.model && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px]">MODEL</span>
                    <p className="text-cyan-400 font-mono mt-0.5">{selectedSpan.model}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px]">PROVIDER</span>
                    <p className="text-slate-300 font-mono mt-0.5">{selectedSpan.provider || 'unknown'}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-center">
                <div>
                  <span className="text-slate-500 text-[10px]">PROMPT</span>
                  <p className="text-white font-semibold mt-0.5">{selectedSpan.prompt_tokens}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">COMPLETION</span>
                  <p className="text-white font-semibold mt-0.5">{selectedSpan.completion_tokens}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">COST</span>
                  <p className="text-emerald-400 font-semibold mt-0.5">${selectedSpan.cost.toFixed(6)}</p>
                </div>
              </div>

              {selectedSpan.ttft_ms !== null && (
                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30 flex items-center justify-between">
                  <span className="text-emerald-400 font-medium">Time To First Token (TTFT)</span>
                  <span className="font-mono text-white font-bold">{Math.round(selectedSpan.ttft_ms)}ms</span>
                </div>
              )}

              {/* Error Message if Error */}
              {selectedSpan.error_message && (
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 space-y-1">
                  <div className="font-semibold text-rose-400">{selectedSpan.error_type || 'Error'}</div>
                  <pre className="text-[11px] whitespace-pre-wrap font-mono">{selectedSpan.error_message}</pre>
                </div>
              )}

              {/* Prompt Input */}
              {selectedSpan.input && (
                <div>
                  <span className="text-slate-500 font-mono text-[10px]">INPUT PROMPT / PAYLOAD</span>
                  <div className="mt-1 p-3 rounded-lg bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto text-slate-300 whitespace-pre-wrap font-mono text-[11px]">
                    {selectedSpan.input}
                  </div>
                </div>
              )}

              {/* Response Output */}
              {selectedSpan.output && (
                <div>
                  <span className="text-slate-500 font-mono text-[10px]">OUTPUT RESPONSE</span>
                  <div className="mt-1 p-3 rounded-lg bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto text-slate-300 whitespace-pre-wrap font-mono text-[11px]">
                    {selectedSpan.output}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Select a span from the waterfall to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
