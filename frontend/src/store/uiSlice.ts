import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type DateRangeOption = '1h' | '24h' | '7d' | '30d';

interface UIState {
  dateRange: DateRangeOption;
  selectedProjectId: string | null;
  searchQuery: string;
  statusFilter: 'all' | 'ok' | 'error';
  modelFilter: string;
  activeTraceId: string | null;
}

const initialProjectId =
  typeof window !== 'undefined' ? localStorage.getItem('tokentrail_project_id') : null;

const initialState: UIState = {
  dateRange: '24h',
  selectedProjectId: initialProjectId,
  searchQuery: '',
  statusFilter: 'all',
  modelFilter: 'all',
  activeTraceId: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDateRange: (state, action: PayloadAction<DateRangeOption>) => {
      state.dateRange = action.payload;
    },
    setSelectedProjectId: (state, action: PayloadAction<string | null>) => {
      state.selectedProjectId = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload) {
          localStorage.setItem('tokentrail_project_id', action.payload);
        } else {
          localStorage.removeItem('tokentrail_project_id');
        }
      }
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setStatusFilter: (state, action: PayloadAction<'all' | 'ok' | 'error'>) => {
      state.statusFilter = action.payload;
    },
    setModelFilter: (state, action: PayloadAction<string>) => {
      state.modelFilter = action.payload;
    },
    setActiveTraceId: (state, action: PayloadAction<string | null>) => {
      state.activeTraceId = action.payload;
    },
  },
});

export const {
  setDateRange,
  setSelectedProjectId,
  setSearchQuery,
  setStatusFilter,
  setModelFilter,
  setActiveTraceId,
} = uiSlice.actions;

export default uiSlice.reducer;
