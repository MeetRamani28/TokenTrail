export interface OverviewData {
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  error_rate: number;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  avg_latency_ms: number | null;
}

export interface TimeseriesPoint {
  timestamp: string;
  value: number;
  group?: string | null;
}

export interface TimeseriesData {
  metric: 'requests' | 'tokens' | 'cost' | 'latency';
  interval: '1h' | '1d';
  points: TimeseriesPoint[];
}

export interface TraceSummary {
  trace_id: string;
  name: string;
  started_at: string;
  duration_ms: number | null;
  status: 'ok' | 'error';
  total_tokens: number;
  total_cost: number;
  span_count: number;
  models: string[];
  tags: string[];
}

export interface TraceListResponse {
  traces: TraceSummary[];
  total_count: number;
  has_more: boolean;
}

export interface SpanWaterfallItem {
  span_id: string;
  trace_id: string;
  parent_span_id: string | null;
  name: string;
  type: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  ttft_ms: number | null;
  status: 'ok' | 'error';
  error_type: string | null;
  error_message: string | null;
  model: string | null;
  provider: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  cost_is_estimated: boolean;
  input: string | null;
  output: string | null;
  metadata: Record<string, unknown>;
  offset_ms: number;
}

export interface TraceDetail {
  trace_id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  status: 'ok' | 'error';
  total_tokens: number;
  total_cost: number;
  user_id: string | null;
  session_id: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  spans: SpanWaterfallItem[];
}

export interface ModelUsage {
  model: string;
  provider: string | null;
  total_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
}

export interface ModelPrice {
  id: string;
  provider: string;
  model: string;
  input_price_per_1m: number;
  output_price_per_1m: number;
  effective_from: string;
  currency: string;
}
