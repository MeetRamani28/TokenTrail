import React from 'react';
import { useOverview, useTimeseries } from '../api/queries';
import { useAppSelector } from '../store';
import {
  Activity,
  Clock,
  Coins,
  Cpu,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const OverviewPage: React.FC = () => {
  const dateRange = useAppSelector((state) => state.ui.dateRange);
  const selectedProjectId = useAppSelector((state) => state.ui.selectedProjectId);

  const { data: overview, isLoading: overviewLoading } = useOverview(dateRange, selectedProjectId);
  const { data: requestsTs } = useTimeseries('requests', dateRange, '1h', 'none', selectedProjectId);
  const { data: costTs } = useTimeseries('cost', dateRange, '1h', 'none', selectedProjectId);

  const formattedChartData = React.useMemo(() => {
    if (!requestsTs?.points) return [];
    return requestsTs.points.map((pt, idx) => {
      const costPt = costTs?.points[idx];
      const d = new Date(pt.timestamp);
      return {
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        requests: pt.value,
        cost: costPt ? costPt.value : 0,
      };
    });
  }, [requestsTs, costTs]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
        <p className="text-sm text-slate-400 mt-1">
          Real-time metrics, throughput, latency percentiles, and spending.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Requests</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {overviewLoading ? '...' : (overview?.total_requests ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-emerald-400 font-medium">100%</span>
            <span>telemetry capture</span>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Tokens Consumed</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {overviewLoading ? '...' : (overview?.total_tokens ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Prompt & completion total</span>
          </div>
        </div>

        {/* Total Cost */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Estimated Spend</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              ${overviewLoading ? '...' : (overview?.total_cost ?? 0).toFixed(4)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Dynamic rate engine</span>
          </div>
        </div>

        {/* Error Rate & Latency */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Latency & Reliability</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {overview?.p50_latency_ms ? `${Math.round(overview.p50_latency_ms)}ms` : '—'}
            </span>
            <span className="text-xs text-slate-500">p50</span>
            <span className="text-xl font-bold text-slate-300 ml-1">
              {overview?.p95_latency_ms ? `${Math.round(overview.p95_latency_ms)}ms` : '—'}
            </span>
            <span className="text-xs text-slate-500">p95</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className={overview?.error_rate && overview.error_rate > 0 ? 'text-rose-400 font-medium' : 'text-emerald-400 font-medium'}>
              {overview?.error_rate ?? 0}%
            </span>
            <span className="text-slate-400">error rate</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Throughput */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Request Throughput</h2>
              <p className="text-xs text-slate-400 mt-0.5">Traces ingested per interval bucket</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="h-64 w-full">
            {formattedChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedChartData}>
                  <defs>
                    <linearGradient id="reqGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#reqGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <Activity className="w-8 h-8 mb-2 stroke-1 opacity-50" />
                <span>No trace traffic recorded in this time range</span>
              </div>
            )}
          </div>
        </div>

        {/* Spend Over Time */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Estimated Cost Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">USD spend calculated from token consumption</p>
            </div>
            <Coins className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="h-64 w-full">
            {formattedChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                    formatter={(val) => [`$${Number(val ?? 0).toFixed(5)}`, 'Cost']}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <Coins className="w-8 h-8 mb-2 stroke-1 opacity-50" />
                <span>No cost data available for this range</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
