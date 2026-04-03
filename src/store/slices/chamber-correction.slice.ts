/*
 @ Author: Pankaj Kumar Prajapati
*/

import {APIs, URLs} from '@apis';
import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {Common} from '@utils';
import { Platform } from 'react-native';
const CHAMBER_CORRECTION = 'chamberCorrection';


export const getChamberCorrectionListApi = createAsyncThunk(
  `${CHAMBER_CORRECTION}/chamberCorrectionList`,
  async (params: any, thunkAPI) => {
    try {
      const res = await APIs.postRequestWithJson({
        path: URLs.ChamberInfoMobList,
        params,
        isAuth: true,
      });
      if (res?.status === 200 && res?.success) {
        console.log('getChamberCorrectionListApi:', res);
        return res;
      } else {
        Common.alert({title: 'Alert', msg: res?.message});
        return thunkAPI.rejectWithValue(res);
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);

export const submitChamberCorrectionApi = createAsyncThunk(
  `${CHAMBER_CORRECTION}/submitCorrection`,
  async (params: any, thunkAPI) => {
    try {
      const formData = new FormData();
      // 📌 Text Fields
      formData.append('Id', String(params?.Id || 0));
      formData.append('ChamberId', String(params?.ChamberId || ''));
      formData.append('RouteId', String('0'));
      formData.append('ChamberAddress', params?.ChamberAddress || '');
      formData.append('ChamberLatLong', params?.ChamberLatLong || '');
      formData.append('Landmark', params?.Landmark || '');
      formData.append(
        'IsEnclosureAvailable',
        String(params?.IsEnclosureAvailable),
      );
      formData.append(
        'IsDuctStandAvailable',
        String(params?.IsDuctStandAvailable),
      );
      formData.append('Remark', params?.Remark || '');
      // 📸 Image 1
      if (params?.ImageFile1) {
        formData.append('ImageFile1', {
          uri:
            Platform.OS === 'android'
              ? params.ImageFile1
              : params.ImageFile1.replace('file://', ''),
          type: 'image/jpeg',
          name: 'image1.jpg',
        } as any);
      }
      // 📸 Image 2
      if (params?.ImageFile2) {
        formData.append('ImageFile2', {
          uri:
            Platform.OS === 'android'
              ? params.ImageFile2
              : params.ImageFile2.replace('file://', ''),
          type: 'image/jpeg',
          name: 'image2.jpg',
        } as any);
      }
      console.log('📤 SUBMIT FORM DATA:', formData);
      const res = await (APIs as any).postRequestWithFormData({
        path: URLs.ChamberMobRequest,
        body: formData,
        isAuth: true,
      });
      console.log('📥 API RESPONSE:', res);
      if (res?.status === 200 && res?.success) {
        Common.alert({ title: 'Success', msg: res?.message });
        return res;
      } else {
        Common.alert({
          title: 'Alert',
          msg: res?.message || 'Something went wrong',
        });
        return thunkAPI.rejectWithValue(res);
      }
    } catch (error: any) {
      console.log('❌ SUBMIT ERROR:', error);
      Common.alert({ title: 'Error', msg: 'Upload failed. Try again.' });
      return thunkAPI.rejectWithValue(error);
    }
  },
);





/* =========================
   STATE TYPE
========================= */

interface ChamberCorrectionStateType {
  correctionListLoading: 'idle' | 'pending' | 'fulfilled' | 'rejected';
  correctionListData: any[];
  correctionTotalPage: number;

  correctionDetailsLoading: 'idle' | 'pending' | 'fulfilled' | 'rejected';
  correctionDetailsData: any | null;

  submitCorrectionLoading: 'idle' | 'pending' | 'fulfilled' | 'rejected';
}

/* =========================
   INITIAL STATE
========================= */

const initialState: ChamberCorrectionStateType = {
  correctionListLoading: 'idle',
  correctionListData: [],
  correctionTotalPage: 1,

  correctionDetailsLoading: 'idle',
  correctionDetailsData: null,

  submitCorrectionLoading: 'idle',
};

/* =========================
   SLICE
========================= */

const chamberCorrectionSlice = createSlice({
  name: CHAMBER_CORRECTION,
  initialState,
  reducers: {
    resetCorrectionDetails: state => {
      state.correctionDetailsData = null;
    },
  },
  extraReducers: builder => {
    /* ===== List ===== */
    builder.addCase(getChamberCorrectionListApi.pending, state => {
      state.correctionListLoading = 'pending';
    });

    builder.addCase(getChamberCorrectionListApi.fulfilled, (state, action) => {
      state.correctionListLoading = 'fulfilled';

      const newData = action.payload?.data ?? [];
      const page = action.meta.arg?.page ?? 1;

      if (page === 1) {
        state.correctionListData = newData;
      } else {
        state.correctionListData = [
          ...state.correctionListData,
          ...newData,
        ];
      }

      const totalRecords = action.payload?.recordsTotal ?? 0;
      state.correctionTotalPage = Math.ceil(totalRecords / 100) || 1;
    });

    builder.addCase(getChamberCorrectionListApi.rejected, state => {
      state.correctionListLoading = 'rejected';
    });
   /* ===== Submit ===== */
    builder.addCase(submitChamberCorrectionApi.pending, state => {
      state.submitCorrectionLoading = 'pending';
    });

    builder.addCase(submitChamberCorrectionApi.fulfilled, state => {
      state.submitCorrectionLoading = 'fulfilled';
    });

    builder.addCase(submitChamberCorrectionApi.rejected, state => {
      state.submitCorrectionLoading = 'rejected';
    });
  },
});


export const chamberCorrectionReducer = chamberCorrectionSlice.reducer;
export const {resetCorrectionDetails} = chamberCorrectionSlice.actions;
