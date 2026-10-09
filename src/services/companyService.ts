import {APIs, URLs} from '@apis';
import {Common} from '@utils';

export interface UserCompany {
  createdByName: string;
  organizationName: string;
  id: number;
  name: string;
  companyCode: string;
  companyColor: string;
  organizationId: number;
  isActive: boolean;
  createdBy: number;
  createdOn: string;
}

interface UserCompaniesResult {
  success: boolean;
  status: number;
  message: string;
  data: UserCompany[];
}

const getUserCompanies = async (): Promise<UserCompaniesResult> => {
  try {
    const response = await APIs.getRequestWithQuery({
      path: URLs.getUserCompanies,
      isAuth: true,
    });

    return {
      success: response?.success === true || Number(response?.status) === 200,
      status: Number(response?.status) || 500,
      message: response?.message || 'Company list fetched successfully',
      data: Array.isArray(response?.data) ? response.data : [],
    };
  } catch (error: any) {
    Common.error('❌ Get User Companies Error:', error);
    return {
      success: false,
      status: Number(error?.status) || 500,
      message: error?.message || 'Failed to fetch company list',
      data: [],
    };
  }
};

export const companyService = {getUserCompanies};
