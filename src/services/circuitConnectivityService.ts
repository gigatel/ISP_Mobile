import {APIs, URLs} from '@apis';
import {Common} from '@utils';

interface CircuitSearchPayload {
  page: number;
  size: number;
  search: string;
  companyId: number;
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
      recordsFiltered: Number(response?.recordsFiltered) || 0,
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

export const circuitConnectivityService = {getCircuitsWithDetails};
