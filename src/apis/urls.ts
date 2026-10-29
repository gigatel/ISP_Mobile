// Base URL Dev
export const BASE_URL = 'http://mob.gigatel.me:7003/api/'; //hrms_ios
export const BASE_URL_2 = 'http://mob.gigatel.me:7004/api/'; //isp
//  export const BASE_URL_2 = 'http://10.100.2.38:6102/api/'; //isp-local
export const BASE_URL_3 = 'http://mob.gigatel.me:7005/api/'; //locationISP
export const BASE_URL_4 = 'http://mob.gigatel.me:7006/hrms_dev/';

const apiBase = (url: string) => url.replace(/api\/?.*$/i, 'api/');

//Base URL PROD
// export const BASE_URL = 'https://isp.gigatel.me:7003/api/';
// export const BASE_URL_2 = 'https://isp.gigatel.me:7004/api/';
// export const BASE_URL_3 = 'https://isp.gigatel.me:7005/api/';
// export const BASE_URL_4 = 'https://isp.gigatel.me:7006/hrms/';

export const API_ENVIRONMENT: 'DEV' | 'PROD' = /^https?:\/\/isp\./i.test(
  BASE_URL_2,
)
  ? 'PROD'
  : 'DEV';

//
export const DashboardList = BASE_URL + 'AppDashboard/DashboardList2';
//
export const getPwdEncription = BASE_URL + 'Account/GetPwdEncriptionKeyForUser';
export const getOtp = BASE_URL + 'Account/GetOtp2';
export const verifyOtp = BASE_URL + 'Account/AppLogin';
export const insertUpadteRoute = BASE_URL_2 + 'Route/InsertUpdateRoute';
export const selectCompany = BASE_URL + 'Account/SelectCompany';
export const getEmpDeviceList = BASE_URL + 'Account/GetEmpDeviceList';
export const dashboardList = BASE_URL + 'AppDashboard/DashboardList2';
export const getAppModules = BASE_URL + 'Policy/GetUserModuleAppModules?';
export const getUserCompanies = BASE_URL_4 + 'Policy/GetUserCompanyies';
export const getCircuitsWithDetails =
  BASE_URL_2 + 'Circuit/GetCircuitPaggiWithDetails';
export const getMasterDetailsByRouteFiberId =
  BASE_URL_2 + 'Circuit/GetMasterDetailsByRouteFiberId';
export const getSplitterCustomerDetailsBySplitterId =
  BASE_URL_2 + 'Splitter/GetSplitterCustomerDetailsBySplitterId';
export const getNearbyCustomerSplitters =
  BASE_URL_2 + 'Splitter/GetNearbyCustomerSplitters';
export const insertUpdateSplitterCustomerConnectivityAsync =
  BASE_URL_2 + 'Splitter/InsertUpdateSplitterCustomerConnectivityAsync';
export const getFiberTubeCoreColorForSplitter =
  BASE_URL_2 + 'Splitter/GetFiberTubeCoreColorForSplitter';
export const getNearbyConnectedRoutesByLatLng =
  BASE_URL_2 + 'Circuit/GetNearbyConnectedRoutesByLatLng';
export const getCustomerMasterDetailByMobNo =
  BASE_URL_2 + 'CustomerMaster/GetCustomerMasterDetailByMobNo';
export const getCustomerMasterDetailByMacAddress =
  BASE_URL_2 + 'CustomerMaster/GetCustomerMasterDetailByMacAddress';
//! Attendance
export const viewAttendance = BASE_URL + 'Attendance/ViewAttendance';
export const viewAttendanceInOutReport =
  BASE_URL + 'Attendance/ViewInOutReport';
export const todayAttendance = BASE_URL + 'Attendance/TodayAttendance';
export const getTodayWorkingOnBehalf =
  BASE_URL + 'Attendance/GetTodayWorkingOnBehalf';
export const getEmpZoneChambers = BASE_URL + 'Zone/GetEmpZoneChambers';
export const getEmpOfficeBranches = BASE_URL + 'Branch/GetEmpBranches';
export const markAttendance = BASE_URL + 'Attendance/MarkAttendance';
export const syncOfflineAttendance =
  BASE_URL + 'Attendance/SyncOfflineAttendance';
//! Payroll₹
export const monthlyEmpSalary = BASE_URL + 'EmpSalary/MonthalyEmpSalary';
export const apiURLS = BASE_URL + '';
//! Holidays | Contacts
export const getHolidayList = BASE_URL + 'Holiday/GetEmpOptionalHoliday';
export const insertUpdateEmpHolidayRequest =
  BASE_URL + 'Holiday/InsertUpdateEmpHolidayRequest';
export const getEmployeeListContact =
  BASE_URL + 'Employee/GetEmployeeListForContact';
//! Leave
export const leaveStatus = BASE_URL + 'LeaveMaster/LeaveStatus';
export const getEmpBalanceLeaves = BASE_URL + 'LeaveType/GetEmpBalanceLeaves';
export const getEmployeeLeaveRequestPaggi =
  BASE_URL + 'LeaveType/GetEmployeeLeaveRequestPaggi';
export const insertUpdateEmpLeaveRequest =
  BASE_URL + 'LeaveType/InsertUpdateEmpLeaveRequest';
export const getEmployeeLeaveTyepDd =
  BASE_URL + 'LeaveType/GetEmployeeLeaveTyepDd';
//! Employee
export const getEmployeeListForContact =
  BASE_URL + 'Employee/GetEmployeeListForContact';
export const updateMobileAddress = BASE_URL + 'Employee/UpdateMobileAddress';
//! Patroller Task
export const getISPMasterListByname =
  BASE_URL_2 + 'ISPMaster/GetMasterByNameDDISP';
export const getNearestPoleTreeDD =
  apiBase(BASE_URL_2) + 'ISPMaster/GetNearestPoleTreeDD';
export const getDataCenterList =
  BASE_URL_2 + 'DataCenterMaster/GetDataCenterMasterDDISP';
export const getRackMasterList = BASE_URL_2 + 'RackMaster/GetRackMasterDDISP';
export const getFmsMasterList = BASE_URL_2 + 'FMSMaster/GetFmsMasterDDISP';
export const getLcoMasterList = BASE_URL_2 + 'LcoMaster/GetLcoMasterDDISP';
export const getFiberMasterList =
  BASE_URL_2 + 'FiberMaster/GetFiberMasterDDISP';
export const getDrumNumbersByFiberType =
  BASE_URL_2 + 'SLD/GetDrumNoByFiberTypeIdDD';
export const getStateMaster = BASE_URL_2 + 'MapLayer/GetStateMaster';
export const getZonesByStateId = BASE_URL_2 + 'MapLayer/GetZonesByStateId';
export const getISPMasterByRouteIdISP =
  BASE_URL_2 + 'RouteMasterWeb/GetISPMasterByRouteIdISP';
//update master
export const updateMasterAPI =
  BASE_URL_2 + 'ISPMaster/InsertUpdateISPMasterISP';
export const insertUpdateSplitterMaster =
  BASE_URL_2 + 'Splitter/InsertUpdateSplitterMaster';
export const updateRouteAPI =
  BASE_URL_2 + 'RouteMasterMob/InsertUpdateRouteMasterMob';
export const InsertUPdateInitialInfoAPI =
  BASE_URL_2 + 'RouteMasterMob/InsertUpdateRouteInitialInfo';
export const InsertUpdateRouteChamberMapping =
  BASE_URL_2 + 'RouteMasterMob/InsertUpdateRouteChamberMapping';
export const InsertUpdateRouteFiberMappingByRoute =
  BASE_URL_2 + 'RouteMasterMob/InsertUpdateRouteFiberMappingByRoute';
export const UpadteChamberPathDetails =
  BASE_URL_2 + 'RouteMasterMob/UpdateRoutePathDetails';
export const getRouteDetailsPaggi =
  BASE_URL_2 + 'RouteMasterMob/GetRouteDetailsPaggi';
export const getSLDDetailsPaggiISP = BASE_URL_2 + 'SLD/GetSLDDetailsPaggiISP';
export const getPendingSLDJobsISP = BASE_URL_2 + 'SLD/GetPendingSLDJobsISP';
export const getRouteFiberMappingPaggiISP =
  BASE_URL_2 + 'RouteFiberMapping/GetRouteFiberMappingPaggiISP';
export const getRouteFiberAllDataBySLDIdISP =
  BASE_URL_2 + 'RouteFiberMapping/GetRouteFiberAllDataBySLDIdISP';
export const getFiberDetailsByISPMaster =
  BASE_URL_2 + 'RouteFiberMapping/GetFiberDetailsByISPMaster';
// Temporary contract until the final SLD fiber-install endpoint is published.
export const installFiberBySLDTemp =
  BASE_URL_2 + 'RouteMasterMob/UpdateRouteChamberMappingImages';
//
export const postLocationAPI = BASE_URL_3 + 'Location/PostLocation';
export const UpdateMobileLocation =
  BASE_URL_3 + 'Location/UpdateMobileLocation';
