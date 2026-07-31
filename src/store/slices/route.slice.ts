import {APIs, URLs} from '@apis';
import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {ensureLocationWatermark} from '../../utils/imageWatermark';

const ROUTE = 'route';

/* =========================
   Types
========================= */
export interface UpdateRoutePathArgs {
  routeId: number;
  routePath: string;
}

export interface ApiError {
  status?: number;
  success?: false;
  message?: string;
  data?: any;
}

export interface CreateInitialRouteArgs {
  id?: number;
  routeName: string;
  startLatLng: string;
  startAddress: string;
  startLandmark: string;
  startArea: string;
  startCity: string;
  startState: string;
  startPincode: number;
  startCountry: string;
  masterType: string;
  masterId: number;
  orderNo: number;
  routePath: string;
}

// ✅ NEW: Type for InsertUpdateRouteChamberMapping API
export interface InsertUpdateRouteChamberMappingArgs {
  id?: number;
  routeId: number;
  masterType?: string;
  masterId?: number;
  distance?: number;
  endLatLng?: string;
  endSelectedAddress?: string;
  endAddress?: string;
  endLandmark?: string;
  endArea?: string;
  endCity?: string;
  endState?: string;
  endPincode?: number;
  endCountry?: string;
  routeLength?: number;
  orderNo?: number;
  totalLength?: number;
  drumLength?: number;
  drumRemainingLength?: number;
  loopUsed?: number;
  fiberId?: string | number;
  fiberType?: string;
  fiberUsedBy?: string;
  drumId?: string | number;
  drumNo?: string;
  changeScope?: 'Full' | 'Partial';
  fiberChangeScope?: 'FullRoute' | 'PartialRoute' | 'WithoutSLD';
  isPartialChange?: boolean;
  isStartingPoint?: boolean;
  fromOrderNo?: number;
  toOrderNo?: number;
  fromMasterName?: string;
  toMasterName?: string;
  fromMasterType?: string;
  toMasterType?: string;
  fromAddress?: string;
  toAddress?: string;
  fromLatLng?: string;
  toLatLng?: string;
  segmentLength?: number;
  imageFile?: {
    uri: string;
    type: string;
    fileName: string;
  };
}
export interface GetMasterByNameArgs {
  name?: string;
}
export interface GetNearestPoleTreeDDArgs {
  latLng: string;
  labelType: string;
  range: number;
  type: string;
  status: boolean;
}
export interface GetDrumNumbersByFiberTypeArgs {
  fiberTypeId: string | number;
}
export interface GetRouteDetailsPaggiArgs {
  page: number;
  size: number;
  search: string;
}
export interface GetRouteFiberAllDataBySLDIdISPArgs {
  routeId: number;
}
export interface InstallFiberBySLDTempItem {
  sldId: string | number;
  fiberId: string | number;
  drumLength: number;
  drumRemainingLength: number;
  masterType: string;
  orderNo: number;
  loopUsed: number;
  imageFile: {
    uri: string;
    type: string;
    fileName: string;
  };
}
export interface InstallFiberBySLDTempArgs {
  routeId: number;
  installations: InstallFiberBySLDTempItem[];
}
export interface UpdateMasterArgs {
  Id?: number;
  Name: string;
  MasterType: string;
  Address: string;
  SelectedAddress: string;
  City: string;
  State: string;
  Country: string;
  Area: string;
  PinCode: string;
  Landmark: string;
  LatLng: string;
  Image1?: string;
  Image2?: string;
  ImageFile1?: any;
  ImageFile2?: any;
  Extra1?: string;
  Extra2?: string;
}
export interface AddRouteArgs {
  Id?: number;
  RouteName: string;
  RouteLength: number;
  StartAddress: string;
  StartCity: string;
  StartState: string;
  StartCountry: string;
  StartArea: string;
  StartPincode: number;
  StartLandmark: string;
  StartLatLng: string;
  EndAddress: string;
  EndCity: string;
  EndState: string;
  EndCountry: string;
  EndArea: string;
  EndPincode: number;
  EndLandmark: string;
  EndLatLng: string;
  RoutePath: any;
  RouteChamberMappingVM: any;
}
const extractErrorMessage = (res: any): string => {
  return (
    res?.message ||
    res?.title ||
    (typeof res?.errors === 'string'
      ? res?.errors
      : JSON.stringify(res?.errors)) ||
    `Server error: ${res?.status || 'Unknown'}`
  );
};

type LoadingState = 'idle' | 'pending' | 'fulfilled' | 'rejected';

interface RouteState {
  masterListLoading: LoadingState;
  masterList: any[] | null;
  error: string | null;
  routeLoading: LoadingState;
  routeResponse: any | null;
  // ✅ NEW: separate loading state for chamber mapping
  chamberMappingLoading: LoadingState;
  chamberMappingResponse: any | null;
}

const initialState: RouteState = {
  masterListLoading: 'idle',
  masterList: null,
  error: null,
  routeLoading: 'idle',
  routeResponse: null,
  // ✅ NEW
  chamberMappingLoading: 'idle',
  chamberMappingResponse: null,
};

/* =========================
   Get Master By Name
========================= */
export const GetMasterByNameAPI = createAsyncThunk<
  any,
  GetMasterByNameArgs | undefined,
  {rejectValue: ApiError}
>(`${ROUTE}/GetMasterByName`, async (args, thunkApi) => {
  try {
    const {name = ''} = args ?? {};
    const queryParams = name ? `?name=${encodeURIComponent(name)}` : '';
    const res = await APIs.getRequestWithQuery({
      path: URLs.getISPMasterListByname,
      params: queryParams,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) return res?.data;
    return thunkApi.rejectWithValue(res);
  } catch (error: any) {
    return thunkApi.rejectWithValue(error);
  }
});

export const GetNearestPoleTreeDDAPI = createAsyncThunk<
  any,
  GetNearestPoleTreeDDArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/GetNearestPoleTreeDD`, async (payload, thunkApi) => {
  try {
    const res = await APIs.postRequestWithJson({
      path: URLs.getNearestPoleTreeDD,
      params: payload,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) return res?.data;
    return thunkApi.rejectWithValue(res);
  } catch (error: any) {
    return thunkApi.rejectWithValue(error);
  }
});

export const GetDataCenterListAPI = createAsyncThunk<
  any,
  void,
  {rejectValue: ApiError}
>(`${ROUTE}/GetDataCenterList`, async (_, thunkApi) => {
  try {
    const res = await APIs.getRequestWithQuery({
      path: URLs.getDataCenterList,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) return res?.data;
    return thunkApi.rejectWithValue(res);
  } catch (error: any) {
    return thunkApi.rejectWithValue(error);
  }
});

export const GetFiberMasterListAPI = createAsyncThunk<
  any,
  void,
  {rejectValue: ApiError}
>(`${ROUTE}/GetFiberMasterList`, async (_, thunkApi) => {
  try {
    const res = await APIs.getRequestWithQuery({
      path: URLs.getFiberMasterList,
      isAuth: true,
    });

    if (Array.isArray(res)) {
      return res;
    }
    if (res?.status === 200 && res?.success) {
      return res?.data ?? [];
    }
    if (Array.isArray(res?.data)) {
      return res.data;
    }

    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      status: error?.status,
      message: error?.message || 'Unable to load fiber types',
      data: error,
    });
  }
});

export const GetDrumNumbersByFiberTypeAPI = createAsyncThunk<
  any,
  GetDrumNumbersByFiberTypeArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/GetDrumNumbersByFiberType`, async (payload, thunkApi) => {
  try {
    const res = await APIs.getRequestWithQuery({
      path: URLs.getDrumNumbersByFiberType,
      params: `?fiberTypeId=${encodeURIComponent(String(payload.fiberTypeId))}`,
      isAuth: true,
    });

    if (Array.isArray(res)) {
      return res;
    }
    if (res?.status === 200 && res?.success) {
      return res?.data ?? [];
    }
    if (Array.isArray(res?.data)) {
      return res.data;
    }

    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      status: error?.status,
      message: error?.message || 'Unable to load drum numbers',
      data: error,
    });
  }
});

export const GetRouteDetailsPaggiAPI = createAsyncThunk<
  any,
  GetRouteDetailsPaggiArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/GetRouteDetailsPaggi`, async (payload, thunkApi) => {
  try {
    const res = await APIs.postRequestWithJsonWithBody({
      path: URLs.getRouteDetailsPaggi,
      body: {
        page: Math.max(1, Number(payload.page) || 1),
        size: Math.max(1, Number(payload.size) || 10),
        search: String(payload.search ?? '').trim(),
      },
      isAuth: true,
    });

    if (res?.status === 200 && res?.success) {
      return {
        recordsTotal: Number(res?.recordsTotal) || 0,
        recordsFiltered: Number(res?.recordsFiltered) || 0,
        data: Array.isArray(res?.data) ? res.data : [],
      };
    }

    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      status: error?.status,
      message: error?.message || 'Unable to load active routes',
      data: error,
    });
  }
});

export const GetRouteFiberAllDataBySLDIdISPAPI = createAsyncThunk<
  any[],
  GetRouteFiberAllDataBySLDIdISPArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/GetRouteFiberAllDataBySLDIdISP`, async (payload, thunkApi) => {
  try {
    const res = await APIs.getRequestWithQuery({
      path: URLs.getRouteFiberAllDataBySLDIdISP,
      params: `?RouteId=${encodeURIComponent(String(payload.routeId))}`,
      isAuth: true,
    });

    if (res?.status === 200 && res?.success) {
      return Array.isArray(res?.data) ? res.data : [];
    }
    if (Array.isArray(res)) {
      return res;
    }

    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      status: error?.status,
      message: error?.message || 'Unable to load route fiber details',
      data: error,
    });
  }
});

export const installFiberBySLDTempAPI = createAsyncThunk<
  any,
  InstallFiberBySLDTempArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/InstallFiberBySLDTemp`, async (payload, thunkApi) => {
  try {
    console.log(
      '📤 InstallFiberBySLDTemp PAYLOAD:',
      JSON.stringify(payload, null, 2),
    );

    const formData = new FormData();
    formData.append('RouteId', String(payload.routeId));

    const watermarkedInstallations = await Promise.all(
      payload.installations.map(async item => ({
        ...item,
        imageFile: {
          ...item.imageFile,
          uri: await ensureLocationWatermark(item.imageFile.uri),
        },
      })),
    );

    watermarkedInstallations.forEach((item, index) => {
      const key = `Installations[${index}]`;
      formData.append(`${key}.SLDId`, String(item.sldId));
      formData.append(`${key}.FiberId`, String(item.fiberId));
      formData.append(`${key}.DrumLength`, String(item.drumLength));
      formData.append(
        `${key}.DrumRemainingLength`,
        String(item.drumRemainingLength),
      );
      formData.append(`${key}.MasterType`, item.masterType);
      formData.append(`${key}.OrderNo`, String(item.orderNo));
      formData.append(`${key}.LoopUsed`, String(item.loopUsed));
      formData.append(`${key}.ImageFile`, {
        uri: item.imageFile.uri,
        type: item.imageFile.type,
        name: item.imageFile.fileName,
      } as any);
    });

    const res = await (APIs as any).postRequestWithFormData({
      path: URLs.installFiberBySLDTemp,
      body: formData,
      isAuth: true,
    });

    console.log(
      '📥 InstallFiberBySLDTemp RESPONSE:',
      JSON.stringify(res, null, 2),
    );

    const successfulStatus =
      Number(res?.status) >= 200 && Number(res?.status) < 300;
    if (res?.success === true || (successfulStatus && res?.success !== false)) {
      return res?.data ?? res;
    }

    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    console.error('❌ InstallFiberBySLDTemp ERROR:', error);
    return thunkApi.rejectWithValue({
      status: error?.status,
      message: error?.message || 'Unable to install the SLD fiber.',
      data: error,
    });
  }
});

export const GetRouteFiberMappingPaggiISPAPI = createAsyncThunk<
  any,
  GetRouteDetailsPaggiArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/GetRouteFiberMappingPaggiISP`, async (payload, thunkApi) => {
  try {
    const res = await APIs.postRequestWithJsonWithBody({
      path: URLs.getRouteFiberMappingPaggiISP,
      body: {
        page: Math.max(1, Number(payload.page) || 1),
        size: Math.max(1, Number(payload.size) || 10),
        search: String(payload.search ?? '').trim(),
      },
      isAuth: true,
    });

    if (res?.status === 200 && res?.success) {
      return {
        recordsTotal: Number(res?.recordsTotal) || 0,
        recordsFiltered: Number(res?.recordsFiltered) || 0,
        data: Array.isArray(res?.data) ? res.data : [],
      };
    }

    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      status: error?.status,
      message: error?.message || 'Unable to load route fiber mappings',
      data: error,
    });
  }
});
export const createInitialRouteAPI = createAsyncThunk<
  any,
  CreateInitialRouteArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/createInitialRouteAPI`, async (payload, thunkApi) => {
  try {
    const body = {
      id: payload.id ?? 0,
      routeName: payload.routeName,
      startLatLng: payload.startLatLng,
      startAddress: payload.startAddress,
      startLandmark: payload.startLandmark,
      startArea: payload.startArea,
      startCity: payload.startCity,
      startState: payload.startState,
      startPincode: payload.startPincode,
      startCountry: payload.startCountry,
      routeCreatedFrom: 'App',
      masterType: payload.masterType,
      masterId: payload.masterId,
      orderNo: payload.orderNo,
      routePath: payload.routePath,
    };
    console.log('startinitialrouteapi', {body});

    const res = await APIs.postRequestWithJsonWithBody({
      path: URLs.InsertUPdateInitialInfoAPI,
      body,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) {
      return res?.data ?? res;
    }
    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      message: error?.message || 'Network error',
    });
  }
});
/* =====================================================
   ✅ NEW: InsertUpdateRouteChamberMapping API
   Called on Stop — saves each master + distance to route
===================================================== */
export const insertUpdateRouteChamberMappingAPI = createAsyncThunk<
  any,
  InsertUpdateRouteChamberMappingArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/insertUpdateRouteChamberMappingAPI`, async (payload, thunkApi) => {
  try {
    const requestPath = payload.fiberChangeScope
      ? URLs.InsertUpdateRouteFiberMappingByRoute
      : URLs.InsertUpdateRouteChamberMapping;

    if (payload.fiberChangeScope) {
      const numericFiberId = Number(payload.fiberId);
      if (!Number.isInteger(numericFiberId) || numericFiberId <= 0) {
        return thunkApi.rejectWithValue({
          message: 'FiberId must be a single positive integer.',
        });
      }

      const formData = new FormData();
      const fiberMappingFields: Array<[string, string | number | boolean]> = [
        ['FiberUsedBy', payload.fiberUsedBy ?? ''],
        ['LoopUsed', payload.loopUsed ?? 0],
        ['EndLatLng', payload.endLatLng ?? ''],
        ['RouteId', payload.routeId],
        ['FromOrderNo', payload.fromOrderNo ?? 0],
        ['EndCity', payload.endCity ?? ''],
        ['FiberType', payload.fiberType ?? ''],
        ['DrumNo', payload.drumNo ?? ''],
        ['FiberId', numericFiberId],
        ['IsPartialChange', payload.isPartialChange ?? false],
        ['EndPincode', payload.endPincode || ''],
        ['EndArea', payload.endArea ?? ''],
        ['TotalLength', payload.totalLength ?? 0],
        ['DrumLength', payload.drumLength ?? 0],
        ['OrderNo', payload.orderNo ?? 1],
        ['RouteLength', payload.routeLength ?? 0],
        ['EndLandmark', payload.endLandmark ?? ''],
        ['ToOrderNo', payload.toOrderNo ?? 0],
        ['Distance', payload.distance ?? 0],
        ['EndState', payload.endState ?? ''],
        ['DrumRemainingLength', payload.drumRemainingLength ?? 0],
        ['FiberChangeScope', payload.fiberChangeScope],
        ['EndAddress', payload.endAddress ?? ''],
        ['SegmentLength', payload.segmentLength ?? 0],
        ['Id', payload.id ?? 0],
        ['EndCountry', payload.endCountry ?? ''],
        ['MasterType', payload.masterType ?? ''],
        ['MasterId', payload.masterId ?? 0],
      ];
      if (payload.fiberChangeScope === 'PartialRoute') {
        fiberMappingFields.push([
          'IsStartingPoint',
          payload.isStartingPoint ?? false,
        ]);
      }
      fiberMappingFields.forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      if (payload.imageFile) {
        const watermarkedImageUri = await ensureLocationWatermark(
          payload.imageFile.uri,
        );
        formData.append('ImageFile', {
          uri: watermarkedImageUri,
          type: payload.imageFile.type,
          name: payload.imageFile.fileName,
        } as any);
      } else {
        formData.append('ImageFile', '');
      }

      const fiberMappingResponse = await (APIs as any).postRequestWithFormData({
        path: requestPath,
        body: formData,
        isAuth: true,
      });
      const successfulStatus =
        Number(fiberMappingResponse?.status) >= 200 &&
        Number(fiberMappingResponse?.status) < 300;
      if (
        fiberMappingResponse?.success === true ||
        (successfulStatus && fiberMappingResponse?.success !== false)
      ) {
        return fiberMappingResponse?.data ?? fiberMappingResponse;
      }
      return thunkApi.rejectWithValue({
        status: fiberMappingResponse?.status,
        message: extractErrorMessage(fiberMappingResponse),
        data: fiberMappingResponse,
      });
    }

    if (payload.imageFile) {
      const watermarkedImageUri = await ensureLocationWatermark(
        payload.imageFile.uri,
      );
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'imageFile' || value === undefined || value === null) {
          return;
        }
        const apiFieldName = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        formData.append(apiFieldName, String(value));
      });
      formData.append('ImageFile', {
        uri: watermarkedImageUri,
        type: payload.imageFile.type,
        name: payload.imageFile.fileName,
      } as any);

      const multipartResponse = await (APIs as any).postRequestWithFormData({
        path: requestPath,
        body: formData,
        isAuth: true,
      });
      const successfulStatus =
        Number(multipartResponse?.status) >= 200 &&
        Number(multipartResponse?.status) < 300;
      if (
        multipartResponse?.success === true ||
        (successfulStatus && multipartResponse?.success !== false)
      ) {
        return multipartResponse?.data ?? multipartResponse;
      }
      return thunkApi.rejectWithValue({
        status: multipartResponse?.status,
        message: extractErrorMessage(multipartResponse),
        data: multipartResponse,
      });
    }

    const body = {...payload};

    const res = await APIs.postRequestWithJsonWithBody({
      path: requestPath,
      body,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) {
      return res?.data ?? res;
    }
    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      message: error?.message || 'Network error',
    });
  }
});
export const UpdateMasterAPI = createAsyncThunk<
  any,
  UpdateMasterArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/UpdateMaster`, async (payload, thunkApi) => {
  try {
    const formData = new FormData();
    formData.append('Id', String(payload.Id ?? 0));
    formData.append('Name', payload.Name);
    formData.append('MasterType', payload.MasterType);
    formData.append('Address', payload.Address);
    formData.append('SelectedAddress', payload.SelectedAddress);
    formData.append('City', payload.City);
    formData.append('State', payload.State);
    formData.append('Country', payload.Country || 'India');
    formData.append('Area', payload.Area);
    formData.append('PinCode', payload.PinCode);
    formData.append('Landmark', payload.Landmark);
    formData.append('LatLng', payload.LatLng);
    formData.append('FiberDetailsReqVM[0].Id', 0);
    formData.append('FiberDetailsReqVM[0].RouteFiberId', 0);

    if (payload.Extra1) formData.append('Extra1', payload.Extra1);
    if (payload.Extra2) formData.append('Extra2', payload.Extra2);
    if (payload.Image1) formData.append('Image1', payload.Image1);
    if (payload.Image2) formData.append('Image2', payload.Image2);

    if (payload.ImageFile1) {
      const watermarkedImageUri = await ensureLocationWatermark(
        payload.ImageFile1.uri,
      );
      formData.append('ImageFile1', {
        uri: watermarkedImageUri,
        type: payload.ImageFile1.type,
        name: payload.ImageFile1.fileName || 'image1.jpg',
      });
    }

    if (payload.ImageFile2) {
      const watermarkedImageUri = await ensureLocationWatermark(
        payload.ImageFile2.uri,
      );
      formData.append('ImageFile2', {
        uri: watermarkedImageUri,
        type: payload.ImageFile2.type,
        name: payload.ImageFile2.fileName || 'image2.jpg',
      });
    }

    console.log('🚀 UpdateMaster REQUEST');

    const res = await APIs.postRequestWithFormData({
      path: URLs.updateMasterAPI,
      body: formData,
      isAuth: true,
      isFormData: true,
    });

    console.log('📥 UpdateMaster RESPONSE:', JSON.stringify(res, null, 2));

    if (res?.status === 200 && res?.success) return res?.data;

    return thunkApi.rejectWithValue(res);
  } catch (error: any) {
    console.error('❌ UpdateMaster ERROR:', error);
    return thunkApi.rejectWithValue(error);
  }
});
export const updateRoutePathDetailsAPI = createAsyncThunk<
  any,
  UpdateRoutePathArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/updateRoutePathDetailsAPI`, async (payload, thunkApi) => {
  try {
    const res = await APIs.postRequestWithJsonWithBody({
      path: URLs.UpadteChamberPathDetails,
      body: payload,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) {
      return res?.data ?? res;
    }
    return thunkApi.rejectWithValue({
      status: res?.status,
      message: extractErrorMessage(res),
      data: res,
    });
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      message: error?.message || 'Network error',
    });
  }
});

/* =================================================
   ✅ addRouteAPI with proper logging
================================================= */
export const addRouteAPI = createAsyncThunk<
  any,
  AddRouteArgs,
  {rejectValue: ApiError}
>(`${ROUTE}/addRouteAPI`, async (payload, thunkApi) => {
  try {
    console.log('🚀 addRouteAPI STARTED');
    console.log('📦 Input payload:', JSON.stringify(payload, null, 2));

    const formData = new FormData();
    formData.append('Id', String(payload.Id ?? 0));
    formData.append('RouteName', String(payload.RouteName ?? ''));
    formData.append('RouteLength', String(payload.RouteLength ?? 0));
    formData.append('RouteCreatedFrom', 'App');

    // Start Location
    formData.append('StartLatLng', String(payload.StartLatLng ?? ''));
    formData.append('StartAddress', String(payload.StartAddress ?? ''));
    formData.append('StartLandmark', String(payload.StartLandmark ?? ''));
    formData.append('StartArea', String(payload.StartArea ?? ''));
    formData.append('StartCity', String(payload.StartCity ?? ''));
    formData.append('StartState', String(payload.StartState ?? ''));
    formData.append('StartCountry', String(payload.StartCountry ?? ''));
    formData.append('StartPincode', String(payload.StartPincode ?? 0));

    // End Location
    formData.append('EndLatLng', String(payload.EndLatLng ?? ''));
    formData.append('EndAddress', String(payload.EndAddress ?? ''));
    formData.append('EndCity', String(payload.EndCity ?? ''));
    formData.append('EndState', String(payload.EndState ?? ''));
    formData.append('EndCountry', String(payload.EndCountry ?? ''));
    formData.append('EndArea', String(payload.EndArea ?? ''));
    formData.append('EndPincode', String(payload.EndPincode ?? 0));
    formData.append('EndLandmark', String(payload.EndLandmark ?? ''));

    // Route Path
    formData.append('RoutePath', String(payload.RoutePath ?? ''));

    // Route Chamber Mapping
    if (
      Array.isArray(payload.RouteChamberMappingVM) &&
      payload.RouteChamberMappingVM.length > 0
    ) {
      console.log(
        `📍 Adding ${payload.RouteChamberMappingVM.length} masters to route`,
      );

      payload.RouteChamberMappingVM.forEach((item: any, index: number) => {
        const k = `RouteChamberMappingVM[${index}]`;

        formData.append(`${k}.MasterType`, String(item.masterType ?? ''));
        formData.append(`${k}.MasterId`, String(item.masterId ?? 0));
        formData.append(`${k}.Distance`, String(item.distance ?? 0));
        formData.append(`${k}.LatLng`, String(item.latLng ?? ''));
        formData.append(
          `${k}.SelectedAddress`,
          String(item.selectedAddress ?? ''),
        );
        formData.append(`${k}.Pincode`, String(item.pincode ?? 0));
        formData.append(`${k}.Area`, String(item.area ?? ''));
        formData.append(`${k}.City`, String(item.city ?? ''));
        formData.append(`${k}.State`, String(item.state ?? ''));
        formData.append(`${k}.Country`, String(item.country ?? ''));
        formData.append(`${k}.Extra1`, String(item.extra1 ?? ''));
        formData.append(`${k}.Extra2`, String(item.extra2 ?? ''));
        formData.append(`${k}.Address`, String(item.address ?? ''));
        formData.append(`${k}.Landmark`, String(item.landmark ?? ''));
        formData.append(`${k}.orderNo`, String(index + 1));

        console.log(
          `  ✅ Master ${index + 1}: ${item.masterType} - ${item.distance}m`,
        );
      });
    }
    console.log('📤 Sending request to server...');
    const res = await APIs.postRequestWithFormData({
      path: URLs.updateRouteAPI,
      body: formData,
      isAuth: true,
      isFormData: true,
    });

    console.log('📥 addRouteAPI RESPONSE:', JSON.stringify(res, null, 2));

    const hasSuccessfulStatus =
      Number(res?.status) >= 200 && Number(res?.status) < 300;
    if (
      res?.success === true ||
      (hasSuccessfulStatus && res?.success !== false)
    ) {
      console.log('✅ Route added successfully!');
      return res?.data ?? res;
    }

    console.log('⚠️ Request succeeded but server returned error');
    return thunkApi.rejectWithValue({
      status: res?.status,
      message:
        res?.message ||
        res?.title ||
        JSON.stringify(res?.errors) ||
        `Server error: ${res?.status}`,
      data: res,
    });
  } catch (error: any) {
    console.error('❌ addRouteAPI ERROR:', error);
    return thunkApi.rejectWithValue({
      message: error?.message || 'Network error. Is the server reachable?',
    });
  }
});

export const GetRackMasterListAPI = createAsyncThunk<
  any,
  void,
  {rejectValue: ApiError}
>(`${ROUTE}/GetRackMasterList`, async (_, thunkApi) => {
  try {
    const res = await APIs.getRequestWithQuery({
      path: URLs.getRackMasterList,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) return res?.data;
    return thunkApi.rejectWithValue(res);
  } catch (error: any) {
    return thunkApi.rejectWithValue(error);
  }
});

export const GetFmsMasterListAPI = createAsyncThunk<
  any,
  void,
  {rejectValue: ApiError}
>(`${ROUTE}/GetFmsMasterList`, async (_, thunkApi) => {
  try {
    const res = await APIs.getRequestWithQuery({
      path: URLs.getFmsMasterList,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) return res?.data;
    return thunkApi.rejectWithValue(res);
  } catch (error: any) {
    return thunkApi.rejectWithValue(error);
  }
});

export const GetLcoMasterListAPI = createAsyncThunk<
  any,
  void,
  {rejectValue: ApiError}
>(`${ROUTE}/GetLcoMasterList`, async (_, thunkApi) => {
  try {
    const res = await APIs.getRequestWithQuery({
      path: URLs.getLcoMasterList,
      isAuth: true,
    });
    if (res?.status === 200 && res?.success) return res?.data;
    return thunkApi.rejectWithValue(res);
  } catch (error: any) {
    return thunkApi.rejectWithValue(error);
  }
});

const routeSlice = createSlice({
  name: ROUTE,
  initialState,
  reducers: {
    clearMasterList: state => {
      state.masterList = null;
    },
    clearRouteError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    const handlePending = (state: RouteState) => {
      state.masterListLoading = 'pending';
      state.error = null;
    };

    const handleFulfilled = (state: RouteState, action: any) => {
      state.masterListLoading = 'fulfilled';
      state.masterList = action.payload;
    };

    const handleRejected = (state: RouteState, action: any) => {
      state.masterListLoading = 'rejected';
      state.error = action.payload?.message || 'Something went wrong';
    };

    builder
      .addCase(GetMasterByNameAPI.pending, handlePending)
      .addCase(GetMasterByNameAPI.fulfilled, handleFulfilled)
      .addCase(GetMasterByNameAPI.rejected, handleRejected)

      .addCase(GetNearestPoleTreeDDAPI.pending, handlePending)
      .addCase(GetNearestPoleTreeDDAPI.fulfilled, handleFulfilled)
      .addCase(GetNearestPoleTreeDDAPI.rejected, handleRejected)

      .addCase(GetDataCenterListAPI.pending, handlePending)
      .addCase(GetDataCenterListAPI.fulfilled, handleFulfilled)
      .addCase(GetDataCenterListAPI.rejected, handleRejected)

      .addCase(GetRackMasterListAPI.pending, handlePending)
      .addCase(GetRackMasterListAPI.fulfilled, handleFulfilled)
      .addCase(GetRackMasterListAPI.rejected, handleRejected)

      .addCase(GetFmsMasterListAPI.pending, handlePending)
      .addCase(GetFmsMasterListAPI.fulfilled, handleFulfilled)
      .addCase(GetFmsMasterListAPI.rejected, handleRejected)

      .addCase(GetLcoMasterListAPI.pending, handlePending)
      .addCase(GetLcoMasterListAPI.fulfilled, handleFulfilled)
      .addCase(GetLcoMasterListAPI.rejected, handleRejected)

      // addRouteAPI handlers
      .addCase(addRouteAPI.pending, state => {
        console.log('🔄 addRouteAPI: pending');
        state.routeLoading = 'pending';
        state.error = null;
      })
      .addCase(addRouteAPI.fulfilled, (state, action) => {
        console.log('✅ addRouteAPI: fulfilled');
        state.routeLoading = 'fulfilled';
        state.routeResponse = action.payload;
      })
      .addCase(addRouteAPI.rejected, (state, action: any) => {
        console.log('❌ addRouteAPI: rejected');
        state.routeLoading = 'rejected';
        state.error = action.payload?.message || 'Something went wrong';
      })

      // updateRoutePathDetailsAPI handlers
      .addCase(updateRoutePathDetailsAPI.pending, state => {
        console.log('🔄 updateRoutePathDetails: pending');
        state.routeLoading = 'pending';
        state.error = null;
      })
      .addCase(updateRoutePathDetailsAPI.fulfilled, (state, action) => {
        console.log('✅ updateRoutePathDetails: fulfilled');
        state.routeLoading = 'fulfilled';
        state.routeResponse = action.payload;
      })
      .addCase(updateRoutePathDetailsAPI.rejected, (state, action: any) => {
        console.log('❌ updateRoutePathDetails: rejected');
        state.routeLoading = 'rejected';
        state.error = action.payload?.message || 'Something went wrong';
      })

      // ✅ NEW: insertUpdateRouteChamberMappingAPI handlers
      .addCase(insertUpdateRouteChamberMappingAPI.pending, state => {
        console.log('🔄 insertUpdateRouteChamberMapping: pending');
        state.chamberMappingLoading = 'pending';
        state.error = null;
      })
      .addCase(
        insertUpdateRouteChamberMappingAPI.fulfilled,
        (state, action) => {
          console.log('✅ insertUpdateRouteChamberMapping: fulfilled');
          state.chamberMappingLoading = 'fulfilled';
          state.chamberMappingResponse = action.payload;
        },
      )
      .addCase(
        insertUpdateRouteChamberMappingAPI.rejected,
        (state, action: any) => {
          console.log('❌ insertUpdateRouteChamberMapping: rejected');
          state.chamberMappingLoading = 'rejected';
          state.error = action.payload?.message || 'Something went wrong';
        },
      );
  },
});

export const {clearMasterList, clearRouteError} = routeSlice.actions;
export const routeReducer = routeSlice.reducer;
