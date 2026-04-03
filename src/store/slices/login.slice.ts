import { APIs, URLs } from '@apis';
import { navigate, reset } from '@navigation/services';
import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { CONSTANT, STRINGS } from '@res';
import { Common, Preferences, Security } from '@utils';
const LOGIN = 'login';
const otpAdapter = createEntityAdapter();
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
          ...params,setImmediate,
          otp: encOtp.data,
        },
        isAuth: false,
      });
      if (loginRes?.status === 200 && loginRes?.success) {
        Preferences.setData('API_AUTH_TOKEN', loginRes?.token ?? '');
        Preferences.setData('LOGIN_RESPONSE', loginRes?.loginUserInfo);
        Preferences.setData('EMPLOYEE_ID', loginRes?.loginUserInfo?.employeeId);
        Preferences.setData('COMPANY_ID', loginRes?.loginUserInfo?.companyId)
        // ✅ DIRECT USE KE LIYE
        // Preferences.setData('LOGIN_POLICIES', loginRes.loginUserInfo.policies);
        thunkAPI.dispatch(selectCompanyApi({
          selectedCompanyId: loginRes?.loginUserInfo?.companyId,
        }));
      } else
        if (loginRes?.status === 401) {
          Common.showToast(loginRes.message);
          thunkAPI.rejectWithValue(loginRes);
        } else {

        }
    } catch (error) {
      thunkAPI.rejectWithValue(error);
    }
  }
);
//! Select Comapny API
export const selectCompanyApi = createAsyncThunk(
  `${LOGIN}/selectCompanyApi`,
  async (params: any, thunkAPI) => {
    try {
      const selectRes = await APIs.postRequestWithJson({
        path: URLs.selectCompany,
        params,
        isAuth: true,
      });
     if (selectRes?.status === 200 && selectRes?.success) {
        Preferences.setData('API_AUTH_TOKEN', selectRes?.data ?? '');
        Common.showToast('Login Successfully');
        reset('BottomTab');
      } else 
        if (selectRes?.status === 401) {
          Common.showToast(selectRes.message);
          thunkAPI.rejectWithValue(selectRes);
        } else {
        }   
    } catch (error) {
      thunkAPI.rejectWithValue(error);
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