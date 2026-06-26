import { combineReducers, UnknownAction } from 'redux';
import { store } from './store';
import { loginReducer } from './slices/login.slice';
import { permissionReducer } from './slices/permission.slice';
import { dashboardReducer } from './slices/dashboard.slice';
import { accountReducer } from './slices/account.slice';
import { attendanceReducer } from './slices/attendance.slice';
import { payrolReducer } from './slices/payroll.slice';
import { deviceReducer } from './slices/device.slice';
import { leaveReducer } from './slices/leave.slice';
export const RESET_STORE = 'RESET_STORE';
export const resetStore = () => ({
  type: RESET_STORE,
});

const disabledTaskInitialState = {
  taskListLoading: 'idle',
  taskListData: null,
  isAllTaskSubmitted: false,
  submitTaskLoading: 'idle',
  chamberIssueLoading: 'idle',
  chamberIssueData: [],
};

const disabledChamberComplaintInitialState = {
  complaintListLoading: 'idle',
  complaintTotalPage: 0,
  complaintListData: [],
  nearestChambersLoading: 'idle',
  nearestChambersData: [],
  chamberAlertLoading: 'idle',
  chamberAlertData: [],
  chamberPriorityLoading: 'idle',
  chamberPriorityData: [],
  nextChamberLoading: 'idle',
  nextChamberData: null,
  submitComplaintLoading: 'idle',
};

const disabledTaskReducer = (state = disabledTaskInitialState) => state;
const disabledChamberComplaintReducer = (
  state = disabledChamberComplaintInitialState,
) => state;

const appReducer = combineReducers({
  login: loginReducer,
  permission: permissionReducer,
  dashboard: dashboardReducer,
  account: accountReducer,
  attendance: attendanceReducer,
  payroll: payrolReducer,
  task: disabledTaskReducer,
  device: deviceReducer,
  chamberComplaint: disabledChamberComplaintReducer,
  leave: leaveReducer,
});
export const rootReducer = (
  state: RootState | undefined,
  action: UnknownAction,
): RootState => {
  if (action.type === RESET_STORE) {
    state = undefined;
  }
  return appReducer(state, action);
};

export type RootState = ReturnType<typeof appReducer>
export type StoreDispatch = typeof store.dispatch
