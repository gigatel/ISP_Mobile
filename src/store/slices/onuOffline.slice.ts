import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {
  OnuCustomer,
  OnuOfflineUpdate,
} from '../../features/onuOffline/model';
export type OnuConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'paused'
  | 'unavailable';
export interface OnuOfflineState {
  records: Record<string, OnuCustomer>;
  status: OnuConnectionStatus;
  error: string | null;
  receivedAt: string | null;
}
const initialState: OnuOfflineState = {
  records: {},
  status: 'idle',
  error: null,
  receivedAt: null,
};
const slice = createSlice({
  name: 'onuOffline',
  initialState,
  reducers: {
    resetOnu: () => initialState,
    onuConnection(
      state,
      action: PayloadAction<{status: OnuConnectionStatus; error?: string}>,
    ) {
      state.status = action.payload.status;
      state.error = action.payload.error ?? null;
    },
    onuInvalidUpdate(state) {
      state.error =
        'An invalid live update was ignored. Existing records are retained.';
    },
    onuUpdate(
      state,
      action: PayloadAction<{update: OnuOfflineUpdate; receivedAt: string}>,
    ) {
      // Event semantics are undocumented: merge only; omission is never a removal.
      for (const customer of action.payload.update.Customers) {
        state.records[customer.key] = {
          ...state.records[customer.key],
          ...customer,
        };
      }
      state.receivedAt = action.payload.receivedAt;
      state.error = null;
    },
  },
});
export const {resetOnu, onuConnection, onuUpdate, onuInvalidUpdate} =
  slice.actions;
export const onuOfflineReducer = slice.reducer;
