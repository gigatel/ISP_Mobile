//screen-props.tsx

import { TabRootParamList } from '@navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { } from './data-types';
import { RootStackParamList } from '@navigation/navigator';
import { DataType } from '@types';
import ProfileScreen from '@screens/ProfileScreen';


//! Common Screen Props
interface Loading {
  loading?: boolean
}

//!=============== PrivacyPolicy ===============!//
export interface PrivacyPolicyParams extends Loading { }
export type PrivacyPolicy = NativeStackScreenProps<
  RootStackParamList,
  'PrivacyPolicy'
> & PrivacyPolicyParams
export interface DeveloperPKPScreenParams extends Loading {

}
export interface AddRouteParams extends Loading {
  
}
export type AddRouteScreen = NativeStackScreenProps<
 RootStackParamList,
 'AddRouteScreen'
 > & AddRouteParams;
export type AddRouteFiberScreen = NativeStackScreenProps<
 RootStackParamList,
 'AddRouteFiberScreen'
 > & AddRouteParams;
export type DeveloperPKPScreen = NativeStackScreenProps<
  RootStackParamList,
  'DeveloperPKPScreen'
> & DeveloperPKPScreenParams

export interface SearchCustomerParams extends Loading {

}
export interface ChamberReportParams extends Loading {
  
}
export interface addMasterProps extends Loading {
  
}
export type addMaster = NativeStackScreenProps<
RootStackParamList,
"addMaster"> & addMasterProps
export type SearchCustomer = NativeStackScreenProps<
  RootStackParamList,
  'SearchCustomer'> & SearchCustomerParams;
export type ChamberReport = NativeStackScreenProps<
  RootStackParamList,
  'ChamberReport'> & ChamberReportParams;
//!=============== Login ===============!//
export interface LoginParams extends Loading {
}
export type Login = NativeStackScreenProps<
  RootStackParamList,
  'Login'
> & LoginParams
//!=============== OtpVerification ===============!//
export interface OtpVerificationParams extends Loading {
}
export type OtpVerification = NativeStackScreenProps<
  RootStackParamList,
  'OtpVerification'
> & OtpVerificationParams





//! ******** Chamber Complaint **********\\
export interface AddChamberComplaintParams extends Loading {
  data: DataType.ChamberComplaint[]
  totalPage: number
  nextChamberData: DataType.NearestChamber[] | null
  chamberAlerts: DataType.IdName[] | null
  empData: DataType.EmployeeDetails | null
}
export type AddChamberComplaint = NativeStackScreenProps<
  RootStackParamList,
  'AddChamberComplaint'
> & AddChamberComplaintParams

export interface ChamberComplaintsListParams extends Loading {
  data: DataType.ChamberComplaint[]
  totalPage: number
}
export type ChamberComplaintsList = NativeStackScreenProps<
  RootStackParamList,
  'ChamberComplaintsList'
> & ChamberComplaintsListParams



//! ******** Patroller Task **********\\
export interface SubmitPatrollerTaskParams extends Loading {
  taskData: DataType.SubmitPatrollerTask | null
}
export type SubmitPatrollerTask = NativeStackScreenProps<
  RootStackParamList,
  'SubmitPatrollerTask'
> & SubmitPatrollerTaskParams

export interface RoadProjectSurveyParams extends Loading {
  taskData: DataType.PatrollerTask | null
  empData: DataType.EmployeeDetails | null
  tdd: DataType.TodayDoubleDuty | null
  isAllTaskSubmitted: boolean
}
export interface DetailsChamberParams extends Loading {
  
}
export interface DetailsChamberParams extends Loading {
  
}
export interface DistanceCoveredParams extends Loading {
//
}
export interface PatrollerTaskParams extends Loading {
  taskData: DataType.PatrollerTask | null
  empData: DataType.EmployeeDetails | null
  tdd: DataType.TodayDoubleDuty | null
  isAllTaskSubmitted: boolean
}

export type PatrollerTask = NativeStackScreenProps<
  RootStackParamList,
  'PatrollerTask'
> & PatrollerTaskParams

export type RoadProjectTask = NativeStackScreenProps<
  RootStackParamList,
  'RoadProjectTask'
> & RoadProjectSurveyParams
export type ChamberDetails = NativeStackScreenProps<
RootStackParamList,
  'ChamberDetails'
  > & DetailsChamberParams
export type DetailsChamberScreen = NativeStackScreenProps<
  RootStackParamList,
  'DetailsChamberScreen'
> & DetailsChamberParams;
export type DistanceCoveredTask = NativeStackScreenProps<
  RootStackParamList,
  'DistanceCoveredTask'
> & DistanceCoveredParams
//! ******** Payroll **********\\
export interface SalaryPaySlipParams extends Loading {
  compId: number | null,
  data: DataType.MonthlySalary | null,

}
export type SalaryPaySlip = NativeStackScreenProps<
  RootStackParamList,
  'SalaryPaySlip'
> & SalaryPaySlipParams

export interface MonthlySalaryParams extends Loading {
  empId: number | null,
  data: DataType.MonthlySalary | null,

}
export type MonthlySalary = NativeStackScreenProps<
  RootStackParamList,
  'MonthlySalary'
> & MonthlySalaryParams


//! ******** Attendance Module **********\\
export interface AttendanceDashboardParams extends Loading {
  calenderAttData: DataType.AttendanceData[] | null
  empData: DataType.EmployeeDetails | null
  todayAttData: DataType.AttendanceData | null
  todayDuty: DataType.TodayDuty | null
  employeeShift: DataType.EmployeeShift | null
  todayDoubleDuty: DataType.TodayDoubleDuty | null
  todayWorkingOnBehalfData?: DataType.TodayBehalfOf[] | null
  attendancePolicy?: DataType.AttendancePolicy | null
}
export type AttendanceDashboard = NativeStackScreenProps<
  RootStackParamList,
  'AttendanceDashboard'
> & AttendanceDashboardParams

export interface AttendanceInOutParams extends Loading {
  todayAttData: DataType.AttendanceData | null
  empData: DataType.EmployeeDetails | null
  attData?: DataType.Attendance | null
  todayDoubleDuty: DataType.TodayDoubleDuty | null
  todayWorkingOnBehalfData: DataType.TodayBehalfOf[] | null
  todayDuty?: DataType.TodayDuty | null
  allowedShifts: DataType.AllowedShift[] | []
}
export type AttendanceInOut = NativeStackScreenProps<
  RootStackParamList,
  'AttendanceInOut'
> & AttendanceInOutParams

export interface ViewAttendanceReportParams extends Loading {
  data: DataType.AttendanceInOutReport[] | null
}

export type ViewAttendanceReport = NativeStackScreenProps<
  RootStackParamList,
  'ViewAttendanceReport'
> & ViewAttendanceReportParams

export interface DDAttendanceDashboardParams extends Loading {
  calenderAttData: DataType.AttendanceData[] | null
  empData: DataType.EmployeeDetails | null
  todayAttData: DataType.AttendanceData | null
  todayDuty: DataType.TodayDuty | null
  employeeShift: DataType.EmployeeShift | null
  allowedShifts?: DataType.AllowedShift[] | null
  todayDoubleDuty: DataType.TodayDoubleDuty | null
  todayWorkingOnBehalfData?: DataType.TodayBehalfOf[] | null
  attendancePolicy?: DataType.AttendancePolicy | null
}
export type DDAttendanceDashboard = NativeStackScreenProps<
  RootStackParamList,
  'DDAttendanceDashboard'
> & DDAttendanceDashboardParams

export interface DDAttendanceInOutParams extends Loading {
}
export type DDAttendanceInOut = NativeStackScreenProps<
  RootStackParamList,
  'DDAttendanceInOut'
> & DDAttendanceInOutParams

export interface DDViewAttendanceReportParams extends Loading {
  data: DataType.AttendanceInOutReport[] | null
}

export type DDViewAttendanceReport = NativeStackScreenProps<
  RootStackParamList,
  'DDViewAttendanceReport'
> & DDViewAttendanceReportParams

export interface HolidaysListParams extends Loading {
  data: DataType.HolidayList[] | []
}
export type HolidaysList = NativeStackScreenProps<
  RootStackParamList,
  'HolidaysList'
> & HolidaysListParams
export interface ContactsListParams extends Loading {
  data: DataType.EmployeeDetails[] | []
}
export type ContactsList = NativeStackScreenProps<
  RootStackParamList,
  'ContactsList'
> & ContactsListParams

//! ******** Bottom Tabs **********\\

//?=============== Home ===============?//
export interface HomeParams extends Loading {
  dashboardList: DataType.DasboardResponse | null,
  employeeDetails: DataType.EmployeeDetails | undefined
}
export type Home = NativeStackScreenProps<
  TabRootParamList & RootStackParamList,
  'Home'
> & HomeParams

//?=============== Account ===============?//
export interface AccountParams extends Loading {
  employeeDetails: DataType.EmployeeDetails | undefined
  appModules: DataType.AllowedModule | null
}
export interface ProfileParams extends Loading {
  employeeDetails: DataType.EmployeeDetails | undefined
  appModules: DataType.AllowedModule | null
}

export interface AppModuleParams extends Loading {
 employeeDetails: DataType.EmployeeDetails | undefined
 appModules: DataType.AllowedModule | null
}
export interface PitInstallationParams extends Loading {
  
}
export type Account = NativeStackScreenProps<
  TabRootParamList & RootStackParamList,
  'Account'
> & AccountParams
export type ProfileScreen = NativeStackScreenProps<
RootStackParamList,
'ProfileScreen'
> & ProfileParams;
export type AppModuleScreen = NativeStackScreenProps<
RootStackParamList,
'AppModulesScreen'
> & AppModuleParams;
export type PitInstallationScreen = NativeStackScreenProps<
RootStackParamList,
'PitInstallation'
> & PitInstallationParams;

//?=============== Settings ===============?//
export interface SettingsParams extends Loading {
}
export type Settings = NativeStackScreenProps<
  TabRootParamList & RootStackParamList,
  'Settings'
> & SettingsParams

