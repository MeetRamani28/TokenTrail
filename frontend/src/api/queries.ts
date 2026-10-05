import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  ModelPrice,
  ModelUsage,
  OverviewData,
  TimeseriesData,
  TraceDetail,
  TraceListResponse,
  ProjectItem,
  ProjectCreated,
} from '../types';
import type { DateRangeOption } from '../store/uiSlice';

function getDateBounds(range: DateRangeOption): { from_time?: string; to_time?: string } {
  const now = new Date();
  let from: Date;
  if (range === '1h') {
    from = new Date(now.getTime() - 60 * 60 * 1000);
  } else if (range === '24h') {
    from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (range === '7d') {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return {
    from_time: from.toISOString(),
    to_time: now.toISOString(),
  };
}

export function useOverview(range: DateRangeOption, projectId?: string | null) {
  const { from_time, to_time } = getDateBounds(range);
  return useQuery({
    queryKey: ['overview', range, projectId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from_time) params.append('from_time', from_time);
      if (to_time) params.append('to_time', to_time);
      return apiFetch<OverviewData>(`/api/overview?${params.toString()}`, {}, projectId);
    },
    refetchInterval: 30000,
  });
}

export function useTimeseries(
  metric: 'requests' | 'tokens' | 'cost' | 'latency',
  range: DateRangeOption,
  interval: '1h' | '1d' = '1h',
  groupBy: 'none' | 'model' | 'status' = 'none',
  projectId?: string | null
) {
  const { from_time, to_time } = getDateBounds(range);
  return useQuery({
    queryKey: ['timeseries', metric, range, interval, groupBy, projectId],
    queryFn: () => {
      const params = new URLSearchParams({
        metric,
        interval,
        group_by: groupBy,
      });
      if (from_time) params.append('from_time', from_time);
      if (to_time) params.append('to_time', to_time);
      return apiFetch<TimeseriesData>(`/api/timeseries?${params.toString()}`, {}, projectId);
    },
    refetchInterval: 30000,
  });
}

export interface TraceQueryParams {
  limit?: number;
  offset?: number;
  status?: string;
  model?: string;
  tag?: string;
  min_latency_ms?: number;
  max_latency_ms?: number;
  range?: DateRangeOption;
}

export function useTraces(params: TraceQueryParams = {}, projectId?: string | null) {
  const { limit = 20, offset = 0, status, model, tag, min_latency_ms, max_latency_ms, range } = params;
  const bounds = range ? getDateBounds(range) : {};

  return useQuery({
    queryKey: ['traces', params, projectId],
    queryFn: () => {
      const sp = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      if (status && status !== 'all') sp.append('status', status);
      if (model && model !== 'all') sp.append('model', model);
      if (tag) sp.append('tag', tag);
      if (min_latency_ms !== undefined) sp.append('min_latency_ms', min_latency_ms.toString());
      if (max_latency_ms !== undefined) sp.append('max_latency_ms', max_latency_ms.toString());
      if (bounds.from_time) sp.append('from_time', bounds.from_time);
      if (bounds.to_time) sp.append('to_time', bounds.to_time);

      return apiFetch<TraceListResponse>(`/api/traces?${sp.toString()}`, {}, projectId);
    },
  });
}

export function useTraceDetail(traceId: string | null, projectId?: string | null) {
  return useQuery({
    queryKey: ['trace', traceId, projectId],
    queryFn: () => {
      if (!traceId) return null;
      return apiFetch<TraceDetail>(`/api/traces/${traceId}`, {}, projectId);
    },
    enabled: !!traceId,
  });
}

export function useModels(range: DateRangeOption, projectId?: string | null) {
  const { from_time, to_time } = getDateBounds(range);
  return useQuery({
    queryKey: ['models', range, projectId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from_time) params.append('from_time', from_time);
      if (to_time) params.append('to_time', to_time);
      return apiFetch<ModelUsage[]>(`/api/models?${params.toString()}`, {}, projectId);
    },
    refetchInterval: 30000,
  });
}

export function usePrices() {
  return useQuery({
    queryKey: ['prices'],
    queryFn: () => apiFetch<ModelPrice[]>('/api/prices'),
  });
}

export function useCreatePrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newPrice: Omit<ModelPrice, 'id' | 'effective_from' | 'currency'>) =>
      apiFetch<ModelPrice>('/api/prices', {
        method: 'POST',
        body: JSON.stringify(newPrice),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });
}

export function useDeletePrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (priceId: string) =>
      apiFetch(`/api/prices/${priceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<ProjectItem[]>('/api/projects'),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; retention_days?: number }) =>
      apiFetch<ProjectCreated>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useProjectKey(projectId?: string | null) {
  return useQuery({
    queryKey: ['project-key', projectId],
    queryFn: () => apiFetch<{ project_id: string; project_name: string; key_prefix: string; api_key?: string }>(`/api/projects/${projectId}/key`),
    enabled: !!projectId,
  });
}

export function useRollProjectKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<{ project_id: string; project_name: string; key_prefix: string; api_key: string }>(
        `/api/projects/${projectId}/roll-key`,
        { method: 'POST' }
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['project-key', data.project_id], data);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}


