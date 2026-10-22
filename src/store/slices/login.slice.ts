import { APIs, URLs } from '@apis';
import { navigate, reset } from '@navigation/services';
import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { CONSTANT, STRINGS } from '@res';
import { Common, Preferences, Security } from '@utils';
import {setOlaMapApiKey} from '../../utils/olaMapKey';
const LOGIN = 'login';
const otpAdapter = createEntityAdapter();
const SELECT_COMPANY_PAYLOAD = {selectedCompanyId: 0};

const getApiMessage = (res: any, fallback: string) =>
  res?.message ?? res?.messege ?? res?.error ?? fallback;

const getTokenFromSelectCompany = (selectRes: any) => {
  if (typeof selectRes?.data === 'string') return selectRes.data;
  return (
    selectRes?.data?.token ??
    selectRes?.data?.data ??
    selectRes?.token ??
    ''
  );
};

let hasLoggedSelectCompanyUrl = false;

const logSelectCompanyDev = (data?: any) => {
  if (!__DEV__ || hasLoggedSelectCompanyUrl) return;
  hasLoggedSelectCompanyUrl = true;
  console.log('[Account/SelectCompany] updated URL:', URLs.selectCompany, data ?? {});
};

export const getOtpApi = createAsyncThunk(
  `${LOGIN}/getPublicKey`,
  async (params: any, thunkAPI) => {
    try {
      const { mobileNumber, hashKey, organizationCode } = params;
      console.log('getOtpApi params:', params);
      const keyResponse = await APIs.postRequestWithJson({
        path: URLs.getPwdEncription,
        params: {
          userId: mobileNumber,
          organizationCode, 
        },
        isAuth: false,  
      });
        if (!keyResponse) {
        Common.showToast(STRINGS.server_not_responding);
        return thunkAPI.rejectWithValue(STRINGS.server_not_responding);
       }     
      if (keyResponse?.status === 200 && keyResponse?.success === true) {
        if (keyResponse?.key) {
          Preferences.setData('PUBLIC_KEY', keyResponse.key);
          const pemKey = await Security.convertKeyToPem(keyResponse.key);
          Preferences.setData('PEM_KEY', pemKey);
          const encPass = await Security.encrypt(
            pemKey,
            CONSTANT.AUTH_PASSWORD_DEFAULT,
          );
      if (!encPass?.success) return;
          // 🔹 2. GET OTP
          const otpParams = {
            userId: mobileNumber + '',
            password: encPass.data ?? '',
            appType: 'app',
            hashKey: hashKey + '',
            organizationCode: organizationCode, 
          };
          console.log('otpParams:', otpParams);
          const otpRes = await APIs.postRequestWithJson({
            path: URLs.getOtp,
            params: otpParams,
            isAuth: false,
          });
          if (otpRes?.status === 200 && otpRes?.message === 'success') {
            navigate('OtpVerification', {
              userId: mobileNumber + '',
              password: encPass.data ?? '',
              appType: 'app',
              organizationCode: organizationCode,
            });
          }
        } else {
          return thunkAPI.rejectWithValue(keyResponse);
        }
      } else {
        Common.showToast(keyResponse?.message);
        return thunkAPI.rejectWithValue(keyResponse);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);
//! Verify OTP API
export const verifyOtpApi = createAsyncThunk(
  `${LOGIN}/verifyOtpApi`,
  async (params: any, thunkAPI) => {
    try {
      const encOtp = await Security.encrypt(
        Preferences.getData('PEM_KEY'),
        params.otp,
      );
      const loginRes = await APIs.postRequestWithJson({
        path: URLs.verifyOtp,
        params: {
          ...params,
          otp: encOtp.data,
        },
        isAuth: false,
      });
      if (loginRes?.status === 200 && loginRes?.success) {
        const loginUserInfo = loginRes?.loginUserInfo;
        const loginToken = loginRes?.token ?? '';

        setOlaMapApiKey(loginUserInfo?.olaKey);
        Preferences.setData('API_AUTH_TOKEN', loginToken);
        Preferences.setData('LOGIN_RESPONSE', loginUserInfo);
        Preferences.setData('EMPLOYEE_ID', loginUserInfo?.employeeId);
        Preferences.setData('COMPANY_ID', SELECT_COMPANY_PAYLOAD.selectedCompanyId);
        Preferences.setData('ORGANIZATION_CODE', params?.organizationCode ?? '');
        // ✅ DIRECT USE KE LIYE
        // Preferences.setData('LOGIN_POLICIES', loginRes.loginUserInfo.policies);

        const selectAction: any = await thunkAPI.dispatch(
          selectCompanyApi(undefined),
        );

        if (selectCompanyApi.fulfilled.match(selectAction)) {
          return loginRes;
        }

        const selectError = selectAction?.payload ?? selectAction?.error;
        if (selectError?.status === 401) {
          Common.showToast(getApiMessage(selectError, 'Unauthorized'));
          return thunkAPI.rejectWithValue(selectError);
        }

        // Login already returned a valid token. Do not leave the user stuck on OTP
        // if SelectCompany is temporarily unavailable.
        Preferences.setData('API_AUTH_TOKEN', loginToken);
        Common.showToast(getApiMessage(selectError, 'Login successful'));
        reset('BottomTab');
        return loginRes;
      } else
        if (loginRes?.status === 401) {
          Common.showToast(loginRes.message);
          return thunkAPI.rejectWithValue(loginRes);
        } else {
          Common.showToast(getApiMessage(loginRes, 'OTP verification failed'));
          return thunkAPI.rejectWithValue(loginRes);
        }
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  }
);
//! Select Comapny API
export const selectCompanyApi = createAsyncThunk(
  `${LOGIN}/selectCompanyApi`,
  async (_params: any = undefined, thunkAPI) => {
    try {
      const requestBody = SELECT_COMPANY_PAYLOAD;
      let selectRes: any = null;
      let firstError: any = null;
      const appLoginToken = Preferences.getData('API_AUTH_TOKEN');

      logSelectCompanyDev({
        selectedCompanyId: requestBody.selectedCompanyId,
        hasAppLoginToken: Boolean(appLoginToken),
      });

      try {
        selectRes = await APIs.postRequestWithJson({
          path: URLs.selectCompany,
          params: requestBody,
          isAuth: true,
        });
      } catch (error) {
        firstError = error;
      }

      if (selectRes?.status === 200 && selectRes?.success) {
        const selectedToken = getTokenFromSelectCompany(selectRes);
        if (selectedToken) {
          Preferences.setData('API_AUTH_TOKEN', selectedToken);
        }
        Preferences.setData('COMPANY_ID', requestBody.selectedCompanyId);
        Common.showToast('Login Successfully');
        reset('BottomTab');
        return selectRes;
      }

      const errorRes = selectRes ?? firstError;
      Common.showToast(
        getApiMessage(errorRes, 'Company selection failed'),
      );
      return thunkAPI.rejectWithValue(errorRes);
    } catch (error) {
      Common.showToast(getApiMessage(error, 'Company selection failed'));
      return thunkAPI.rejectWithValue(error);
    }
  }
);
//! Login
const intialState = otpAdapter.getInitialState({
  loading: 'idel',
  error: null,
  data: null,
  loginData: null,
});
const loginSlice = createSlice({
  name: LOGIN,
  initialState: intialState,
  reducers: {},
  extraReducers: builder => {
    //! Get OTP
    builder.addCase(getOtpApi.pending, (state,) => {
      state.loading = 'pending';
    });
    builder.addCase(getOtpApi.fulfilled, (state, action) => {
      state.loading = 'fulfilled';
      state.data = action.payload ?? null;
    });
    builder.addCase(getOtpApi.rejected, (state,) => {
      state.loading = 'rejected';
    });
    //! Verify OTP | Login
    builder.addCase(verifyOtpApi.pending, (state,) => {
      state.loading = 'pending';
    });
    builder.addCase(verifyOtpApi.fulfilled, (state, action) => {
      state.loading = 'fulfilled';
      state.loginData = action.payload ?? null;
    });
    builder.addCase(verifyOtpApi.rejected, (state,) => {
      state.loading = 'rejected';
    });
  },
});
export const loginReducer = loginSlice.reducer;
