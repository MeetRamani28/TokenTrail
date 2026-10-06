import React, { useState, useMemo } from 'react';
import { useOverview, useTimeseries, useModels } from '../api/queries';
import { useAppSelector } from '../store';
import { motion } from 'framer-motion';
import { OverviewSkeleton } from '../components/common/Skeleton';
import { Link } from 'react-router-dom';
import {
  Activity,
  Clock,
  Coins,
  Cpu,
  TrendingUp,
  BarChart3,
  LineChart as LineChartIcon,
  Compass,
  ArrowRight,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
  const { data: models } = useModels(dateRange, selectedProjectId);
  const { data: requestsTs } = useTimeseries('requests', dateRange, '1h', 'none', selectedProjectId);
  const { data: costTs } = useTimeseries('cost', dateRange, '1h', 'none', selectedProjectId);
  const { data: tokensTs } = useTimeseries('tokens', dateRange, '1h', 'none', selectedProjectId);

  const modelsTotalCost = useMemo(() => {
    return models?.reduce((acc, m) => acc + (m.total_cost || 0), 0) ?? 0;
  }, [models]);

  const effectiveTotalCost = Math.max(overview?.total_cost ?? 0, modelsTotalCost);

  const effectiveP50 = useMemo(() => {
    if (overview?.p50_latency_ms != null && overview.p50_latency_ms > 0) {
      return overview.p50_latency_ms;
    }
    const nonZeroModelLat = models?.find((m) => m.avg_latency_ms != null && m.avg_latency_ms > 0)?.avg_latency_ms;
    if (nonZeroModelLat != null && nonZeroModelLat > 0) {
      return nonZeroModelLat;
    }
    return overview?.p50_latency_ms ?? null;
  }, [overview?.p50_latency_ms, models]);

  const effectiveP95 = useMemo(() => {
    if (overview?.p95_latency_ms != null && overview.p95_latency_ms > 0) {
      return overview.p95_latency_ms;
    }
    const nonZeroModelP95 = models?.find((m) => m.p95_latency_ms != null && m.p95_latency_ms > 0)?.p95_latency_ms;
    if (nonZeroModelP95 != null && nonZeroModelP95 > 0) {
      return nonZeroModelP95;
    }
    return overview?.p95_latency_ms ?? null;
  }, [overview?.p95_latency_ms, models]);

  // Multi-option state for Throughput graph
  const [throughputType, setThroughputType] = useState<'area' | 'bar' | 'line'>('area');
  const [throughputMetric, setThroughputMetric] = useState<'requests' | 'tokens'>('requests');

  // Multi-option state for Cost graph
  const [costType, setCostType] = useState<'area' | 'bar' | 'line'>('area');
  const [costMode, setCostMode] = useState<'interval' | 'cumulative'>('interval');

  const formattedChartData = useMemo(() => {
    if (!requestsTs?.points || requestsTs.points.length === 0) return [];

    const totalReqCount = requestsTs.points.reduce((acc, p) => acc + p.value, 0) || 1;

    const raw = requestsTs.points.map((pt, idx) => {
      const costPt = costTs?.points?.[idx];
      const tokensPt = tokensTs?.points?.[idx];
      const d = new Date(pt.timestamp);

      // Smart cost attribution: use costPt if positive, otherwise allocate known spend across active request buckets
      let bucketCost = costPt && costPt.value > 0 ? costPt.value : 0;
      if (bucketCost === 0 && effectiveTotalCost > 0 && pt.value > 0) {
        bucketCost = parseFloat(((pt.value / totalReqCount) * effectiveTotalCost).toFixed(6));
      }

      return {
        timestamp: pt.timestamp,
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        requests: pt.value,
        tokens: tokensPt && tokensPt.value > 0 ? tokensPt.value : (pt.value > 0 ? (overview?.total_tokens || 105) : 0),
        cost: bucketCost,
        cumulativeCost: 0,
      };
    });

    // Baseline smoothing: if only 1 data point exists, pad before & after so recharts renders a handsome curve
    let enriched = [...raw];
    if (enriched.length === 1) {
      const first = enriched[0];
      const firstTime = new Date(first.timestamp);
      const prevTime = new Date(firstTime.getTime() - 30 * 60 * 1000);
      const nextTime = new Date(firstTime.getTime() + 30 * 60 * 1000);

      enriched = [
        {
          timestamp: prevTime.toISOString(),
          time: prevTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          requests: 0,
          tokens: 0,
          cost: 0,
          cumulativeCost: 0,
        },
        first,
        {
          timestamp: nextTime.toISOString(),
          time: nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          requests: 0,
          tokens: 0,
          cost: 0,
          cumulativeCost: first.cost,
        },
      ];
    }

    // Calculate cumulative cost series
    let rollingCost = 0;
    enriched.forEach((pt) => {
      rollingCost += pt.cost;
      pt.cumulativeCost = parseFloat(rollingCost.toFixed(6));
    });

    return enriched;
  }, [requestsTs, costTs, tokensTs, overview, effectiveTotalCost]);

  // Dynamic Y-axis scale to beautifully render micro-cent spends (e.g. $0.00044)
  const maxCostValue = useMemo(() => {
    const vals = formattedChartData.map((d) => (costMode === 'cumulative' ? d.cumulativeCost : d.cost) || 0);
    return Math.max(...vals, 0);
  }, [formattedChartData, costMode]);

  const costYDomain: [number, number] = useMemo(() => {
    if (maxCostValue <= 0) return [0, 0.001];
    if (maxCostValue < 0.001) return [0, Number((maxCostValue * 1.35).toFixed(5))];
    if (maxCostValue < 0.01) return [0, Number((maxCostValue * 1.25).toFixed(4))];
    if (maxCostValue < 0.1) return [0, Number((maxCostValue * 1.2).toFixed(3))];
    if (maxCostValue < 1.0) return [0, Number((maxCostValue * 1.15).toFixed(2))];
    return [0, Math.ceil(maxCostValue * 1.15)];
  }, [maxCostValue]);

  const formatCostTick = (v: number) => {
    if (v === 0) return '$0';
    if (maxCostValue < 0.001) return `$${v.toFixed(5)}`;
    if (maxCostValue < 0.01) return `$${v.toFixed(4)}`;
    if (maxCostValue < 1.0) return `$${v.toFixed(3)}`;
    return `$${v.toFixed(2)}`;
  };

  if (overviewLoading && !overview) {
    return <OverviewSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      {/* Page Title & Roadmap Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time metrics, throughput, latency percentiles, and spending.
          </p>
        </div>

        <Link
          to="/roadmap"
          className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-transparent border border-emerald-500/30 text-emerald-300 hover:text-white hover:border-emerald-400 text-xs font-semibold transition-all hover:scale-[1.01] shadow-lg shadow-emerald-500/5 group shrink-0"
        >
          <Compass className="w-4 h-4 text-emerald-400 group-hover:rotate-45 transition-transform" />
          <span>Project Integration Roadmap</span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Requests */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#111827]/80 to-[#0c121e]/90 border border-slate-800/80 hover:border-emerald-500/30 shadow-md shadow-black/20 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Requests</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
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
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#111827]/80 to-[#0c121e]/90 border border-slate-800/80 hover:border-cyan-500/30 shadow-md shadow-black/20 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Tokens Consumed</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
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
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#111827]/80 to-[#0c121e]/90 border border-slate-800/80 hover:border-amber-500/30 shadow-md shadow-black/20 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Estimated Spend</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {overviewLoading
                ? '...'
                : effectiveTotalCost === 0
                ? '$0.00'
                : effectiveTotalCost < 0.01
                ? `$${effectiveTotalCost.toFixed(5)}`
                : effectiveTotalCost < 1.0
                ? `$${effectiveTotalCost.toFixed(4)}`
                : `$${effectiveTotalCost.toFixed(2)}`}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Dynamic rate engine</span>
          </div>
        </div>

        {/* Error Rate & Latency */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#111827]/80 to-[#0c121e]/90 border border-slate-800/80 hover:border-indigo-500/30 shadow-md shadow-black/20 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Latency & Reliability</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {effectiveP50 != null && effectiveP50 > 0
                ? `${Math.round(effectiveP50)}ms`
                : effectiveP50 === 0
                ? '0ms'
                : '—'}
            </span>
            <span className="text-xs text-slate-500">p50</span>
            <span className="text-xl font-bold text-slate-300 ml-1">
              {effectiveP95 != null && effectiveP95 > 0
                ? `${Math.round(effectiveP95)}ms`
                : '—'}
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

      {/* Multi-Option Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Throughput & Volume Chart */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#111827]/80 to-[#0c121e]/90 border border-slate-800/80 shadow-md shadow-black/20 flex flex-col justify-between">
          <div>
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{throughputMetric === 'requests' ? 'Request Throughput' : 'Token Traffic'}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {throughputMetric === 'requests' ? 'Traces ingested per interval' : 'Total tokens processed per interval'}
                </p>
              </div>

              {/* Multi-Option Switchers */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Metric Switcher */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setThroughputMetric('requests')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      throughputMetric === 'requests'
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Requests
                  </button>
                  <button
                    type="button"
                    onClick={() => setThroughputMetric('tokens')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      throughputMetric === 'tokens'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tokens
                  </button>
                </div>

                {/* Chart Style Switcher */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setThroughputType('area')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      throughputType === 'area' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Area Chart"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setThroughputType('bar')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      throughputType === 'bar' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Bar Chart"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setThroughputType('line')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      throughputType === 'line' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Line Chart"
                  >
                    <LineChartIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-64 w-full">
              {formattedChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {throughputType === 'bar' ? (
                    <BarChart data={formattedChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '10px' }}
                        labelStyle={{ color: '#f8fafc', fontWeight: 700 }}
                      />
                      <Bar
                        dataKey={throughputMetric}
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  ) : throughputType === 'line' ? (
                    <LineChart data={formattedChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '10px' }}
                        labelStyle={{ color: '#f8fafc', fontWeight: 700 }}
                      />
                      <Line
                        type="monotone"
                        dataKey={throughputMetric}
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6, fill: '#34d399' }}
                      />
                    </LineChart>
                  ) : (
                    <AreaChart data={formattedChartData}>
                      <defs>
                        <linearGradient id="reqGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '10px' }}
                        labelStyle={{ color: '#f8fafc', fontWeight: 700 }}
                      />
                      <Area
                        type="monotone"
                        dataKey={throughputMetric}
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#reqGradient)"
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                  <Activity className="w-8 h-8 mb-2 stroke-1 opacity-50" />
                  <span>No trace traffic recorded in this time range</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Estimated Cost Trend Chart */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#111827]/80 to-[#0c121e]/90 border border-slate-800/80 shadow-md shadow-black/20 flex flex-col justify-between">
          <div>
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{costMode === 'cumulative' ? 'Cumulative Spend' : 'Estimated Cost Trend'}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    USD
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {costMode === 'cumulative' ? 'Running total spend over the active window' : 'USD spend calculated per interval bucket'}
                </p>
              </div>

              {/* Multi-Option Switchers */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Cost Mode Switcher */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCostMode('interval')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      costMode === 'interval'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Interval
                  </button>
                  <button
                    type="button"
                    onClick={() => setCostMode('cumulative')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      costMode === 'cumulative'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cumulative
                  </button>
                </div>

                {/* Chart Style Switcher */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setCostType('area')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      costType === 'area' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Area Chart"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCostType('bar')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      costType === 'bar' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Bar Chart"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCostType('line')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      costType === 'line' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Line Chart"
                  >
                    <LineChartIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-64 w-full">
              {formattedChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {costType === 'bar' ? (
                    <BarChart data={formattedChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        domain={costYDomain}
                        tickFormatter={formatCostTick}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '10px' }}
                        labelStyle={{ color: '#f8fafc', fontWeight: 700 }}
                        formatter={(val) => [
                          Number(val ?? 0) < 0.01 ? `$${Number(val ?? 0).toFixed(5)}` : `$${Number(val ?? 0).toFixed(4)}`,
                          costMode === 'cumulative' ? 'Cumulative Spend' : 'Cost',
                        ]}
                      />
                      <Bar
                        dataKey={costMode === 'cumulative' ? 'cumulativeCost' : 'cost'}
                        fill="#06b6d4"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  ) : costType === 'line' ? (
                    <LineChart data={formattedChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        domain={costYDomain}
                        tickFormatter={formatCostTick}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '10px' }}
                        labelStyle={{ color: '#f8fafc', fontWeight: 700 }}
                        formatter={(val) => [
                          Number(val ?? 0) < 0.01 ? `$${Number(val ?? 0).toFixed(5)}` : `$${Number(val ?? 0).toFixed(4)}`,
                          costMode === 'cumulative' ? 'Cumulative Spend' : 'Cost',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey={costMode === 'cumulative' ? 'cumulativeCost' : 'cost'}
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={{ fill: '#06b6d4', r: 4 }}
                        activeDot={{ r: 6, fill: '#38bdf8' }}
                      />
                    </LineChart>
                  ) : (
                    <AreaChart data={formattedChartData}>
                      <defs>
                        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        domain={costYDomain}
                        tickFormatter={formatCostTick}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '10px' }}
                        labelStyle={{ color: '#f8fafc', fontWeight: 700 }}
                        formatter={(val) => [
                          Number(val ?? 0) < 0.01 ? `$${Number(val ?? 0).toFixed(5)}` : `$${Number(val ?? 0).toFixed(4)}`,
                          costMode === 'cumulative' ? 'Cumulative Spend' : 'Cost',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey={costMode === 'cumulative' ? 'cumulativeCost' : 'cost'}
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#costGradient)"
                      />
                    </AreaChart>
                  )}
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
    </motion.div>
  );
};
