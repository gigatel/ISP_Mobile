import {APIs, URLs} from '@apis';
import {Common} from '@utils';

export interface CircuitSearchPayload {
  page: number;
  size: number;
  search: string;
  companyId: number;
  CircuitType: 'Infra' | 'Customer';
  CustomerSearch: string;
  InfraSearch: string;
  Range: number | null;
  LatLng: string;
}

interface CircuitSearchResult {
  success: boolean;
  status: number;
  message: string;
  data: any[];
  recordsTotal: number;
  recordsFiltered: number;
}

const getCircuitsWithDetails = async (
  payload: CircuitSearchPayload,
): Promise<CircuitSearchResult> => {
  try {
    const response: any = await APIs.postRequestWithJson({
      path: URLs.getCircuitsWithDetails,
      params: payload,
      isAuth: true,
    });

    return {
      success: response?.success === true || Number(response?.status) === 200,
      status: Number(response?.status) || 500,
      message: response?.message || 'Circuit list fetched successfully',
      data: Array.isArray(response?.data) ? response.data : [],
      recordsTotal: Number(response?.recordsTotal) || 0,
      recordsFiltered:
        Number(response?.recordsFiltered ?? response?.recordsTotal) || 0,
    };
  } catch (error: any) {
    Common.error('❌ Get Circuits With Details Error:', error);
    return {
      success: false,
      status: Number(error?.status) || 500,
      message: error?.message || 'Failed to fetch circuit list',
      data: [],
      recordsTotal: 0,
      recordsFiltered: 0,
    };
  }
};

const getMasterDetailsByRouteFiberId = async (routeFiberMappingId: number) => {
  try {
    const response: any = await APIs.getRequestWithQuery({
      path: URLs.getMasterDetailsByRouteFiberId,
      params: `?routeFiberId=${encodeURIComponent(routeFiberMappingId)}`,
      isAuth: true,
    });
    return {
      success: response?.success === true || Number(response?.status) === 200,
      message: response?.message || 'Route masters loaded',
      data: Array.isArray(response?.data) ? response.data : [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Could not load route masters',
      data: [] as any[],
    };
  }
};

const getPreviousSplitterDetails = async (
  splitterId: number,
  splitterCode: string,
  customerDetails = false,
) => {
  try {
    const response: any = await APIs.getRequestWithQuery({
      path: URLs.getSplitterCustomerDetailsBySplitterId,
      params: `?splitterId=${encodeURIComponent(
        splitterId,
      )}&splitterCode=${encodeURIComponent(
        splitterCode,
      )}&customerdetails=${customerDetails}&appType=app`,
      isAuth: true,
    });
    return {
      success: response?.success === true || Number(response?.status) === 200,
      data: response?.data,
      message: response?.message || 'Could not load previous splitter',
    };
  } catch (error: any) {
    return {
      success: false,
      data: null,
      message: error?.message || 'Could not load previous splitter',
    };
  }
};

export const circuitConnectivityService = {
  getCircuitsWithDetails,
  getMasterDetailsByRouteFiberId,
  getPreviousSplitterDetails,
};
