//Base URL Dev
// export const BASE_URL = 'http://mob.gigatel.me:40651/api/';//hrms_ios
// export const BASE_URL_2 = 'http://mob.gigatel.me:60107/api/';//isp
// export const BASE_URL_3 = 'http://mob.gigatel.me:40653/api/';//locationISP
export const BASE_URL = 'http://prod.gigatel.me:7003/api/';
export const BASE_URL_2 = 'http://prod.gigatel.me:7004/api/';
export const BASE_URL_3 = 'http://prod.gigatel.me:7005/api/';
//! Account
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
//! Attendance
export const viewAttendance = BASE_URL + 'Attendance/ViewAttendance';
export const viewAttendanceInOutReport = BASE_URL + 'Attendance/ViewInOutReport';
export const todayAttendance = BASE_URL + 'Attendance/TodayAttendance';
export const getTodayWorkingOnBehalf = BASE_URL + 'Attendance/GetTodayWorkingOnBehalf';
export const getEmpZoneChambers = BASE_URL + 'Zone/GetEmpZoneChambers';
export const getEmpOfficeBranches = BASE_URL + 'Branch/GetEmpBranches';
export const markAttendance = BASE_URL + 'Attendance/MarkAttendance';
export const syncOfflineAttendance = BASE_URL + 'Attendance/SyncOfflineAttendance';
//! Payroll₹
export const monthlyEmpSalary = BASE_URL + 'EmpSalary/MonthalyEmpSalary';
export const apiURLS = BASE_URL + '';
//! Holidays | Contacts
export const getHolidayList = BASE_URL + 'Holiday/GetEmpOptionalHoliday';
export const insertUpdateEmpHolidayRequest = BASE_URL + 'Holiday/InsertUpdateEmpHolidayRequest';
export const getEmployeeListContact = BASE_URL + 'Employee/GetEmployeeListForContact';
//! Leave
export const leaveStatus = BASE_URL + 'LeaveMaster/LeaveStatus';
export const getEmpBalanceLeaves = BASE_URL + 'LeaveType/GetEmpBalanceLeaves';
export const getEmployeeLeaveRequestPaggi = BASE_URL + 'LeaveType/GetEmployeeLeaveRequestPaggi';
export const insertUpdateEmpLeaveRequest = BASE_URL + 'LeaveType/InsertUpdateEmpLeaveRequest';
export const getEmployeeLeaveTyepDd = BASE_URL + 'LeaveType/GetEmployeeLeaveTyepDd';
//! Employee
export const getEmployeeListForContact = BASE_URL + 'Employee/GetEmployeeListForContact';
export const updateMobileAddress = BASE_URL + 'Employee/UpdateMobileAddress';
//! Patroller Task        
export const getISPMasterListByname = BASE_URL_2 + 'ISPMaster/GetMasterByNameDDISP';
export const getDataCenterList = BASE_URL_2 + 'DataCenterMaster/GetDataCenterMasterDDISP';
export const getRackMasterList = BASE_URL_2 + 'RackMaster/GetRackMasterDDISP';
export const getFmsMasterList = BASE_URL_2 + 'FMSMaster/GetFmsMasterDDISP';
export const getLcoMasterList = BASE_URL_2 + 'LcoMaster/GetLcoMasterDDISP';
//update master
export const updateMasterAPI = BASE_URL_2 + 'ISPMaster/InsertUpdateISPMasterISP';
export const updateRouteAPI = BASE_URL_2 + 'RouteMasterMob/InsertUpdateRouteMasterMob';
export const InsertUPdateInitialInfoAPI = BASE_URL_2 + 'RouteMasterMob/InsertUpdateRouteInitialInfo';
export const InsertUpdateRouteChamberMapping = BASE_URL_2 + 'RouteMasterMob/InsertUpdateRouteChamberMapping';
export const UpadteChamberPathDetails = BASE_URL_2 + 'RouteMasterMob/UpdateRoutePathDetails';
//
export const postLocationAPI = BASE_URL_3 + 'Location/PostLocation';
export const UpdateMobileLocation = BASE_URL_3 + 'Location/UpdateMobileLocation';