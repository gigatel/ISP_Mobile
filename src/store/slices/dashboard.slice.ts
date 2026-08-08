import {APIs, URLs} from '@apis';
import {
  createAsyncThunk,
  createEntityAdapter,
  createSlice,
} from '@reduxjs/toolkit';
import {DataType} from '@types';
import {Preferences} from '@utils';
import {Platform} from 'react-native';
const DASHBOARD = 'dashboard';
const dashboardAdapter = createEntityAdapter();
export const dashboardListApi = createAsyncThunk(
  `${DASHBOARD}/dashboardListApi`,
  async ({isRefresh}: any, thunkAPI) => {
    try {
      const offRes = Preferences.getData('OFFLINE_DASHBOARD_LIST');
      const now = Date.now();
      const isValidCache =
        offRes &&
        typeof offRes === 'object' &&
        offRes?.lastCalled &&
        now - offRes?.lastCalled < offRes?.interval;
      if (isValidCache && !isRefresh) {
        return offRes?.res;
      }
      const res = await APIs.postRequestWithJson({
        path: `${URLs.DashboardList}?platformType=${Platform.OS}`,
        params: {},
        isAuth: true,
      });
      console.log('dashboardListApi', res);
      if (res?.status === 200 && res?.success) {
        if (res.isLogoutRequired) {
          APIs.logout();
          return undefined;
        }
        Preferences.setData('OFFLINE_DASHBOARD_LIST', {
          res,
          interval: 8 * 60 * 60 * 1000,
          lastCalled: now,
        });
        return res;
      } else {
        return thunkAPI.rejectWithValue(res);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);
export const getLoginTokenApi = createAsyncThunk(
  `${DASHBOARD}/getLoginTokenApi`,
  async (_, thunkAPI) => {
    try {
      const isBgAllow =
        Preferences.getData('ALLOWED_ACCESS_FOR_LOCATION_BACKGROUND') === 'yes';
      const token = Preferences.getData('API_AUTH_TOKEN') ?? null;
      return {
        isBgAllow,
        token,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);
interface DashboardStateTypes extends DataType.Loading {
  dashboardList: DataType.DasboardResponse | null;
  loginToken: null;
  isBgAllow: boolean;
  error: null | string;
}
const intialState: DashboardStateTypes = dashboardAdapter.getInitialState({
  loading: 'idel',
  loginToken: null,
  isBgAllow: false,
  dashboardList: null,
  error: null,
});
export const dashboardSlice = createSlice({
  name: DASHBOARD,
  initialState: intialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(dashboardListApi.pending, state => {
      state.loading = 'pending';
    });
    builder.addCase(dashboardListApi.fulfilled, (state, action) => {
      state.loading = 'fulfilled';
      state.dashboardList = action.payload ?? null;
    });
    builder.addCase(dashboardListApi.rejected, state => {
      state.loading = 'rejected';
    });
    builder.addCase(getLoginTokenApi.fulfilled, (state, action) => {
      state.loginToken = action.payload.token ?? null;
      state.isBgAllow = action.payload?.isBgAllow ?? false;
    });
  },
});

export const dashboardReducer = dashboardSlice.reducer;
