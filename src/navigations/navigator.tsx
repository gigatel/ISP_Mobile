// navigator.tsx
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Login from '@screens/login';
import OtpVerification from '@screens/otp-verification';
import PrivacyPolicy from '@screens/privacy-policy';
import Splash from '@screens/splash';
import {Common, Preferences} from '@utils';
import React, {FC, useEffect, useState} from 'react';
import BottomTab from './bottom-tabs';
import {navigationRef} from './services';
import AddRouteScreen from '@screens/AddRouteScreen';
import AddRouteFiberScreen from '@screens/AddRouteFiberScreen';
import AttendanceDashboard from '@screens/attendance/attendance-dashboard';
import AttendanceInOut from '@screens/attendance/attendance-mark-inout';
import viewAttendanceReport from '@screens/attendance/view-attendance-report';
import DDAttendanceDashboard from '@screens/attendance/dd-attendance-dashboard';
import DDViewAttendanceReport from '@screens/attendance/dd-view-attendance-report';
import MonthlySalary from '@screens/attendance/payroll/monthly-salary';
import SalaryPaySlip from '@screens/attendance/payroll/salary-pay-slip';
import HolidaysList from '@screens/attendance/holidays-list';
import ContactsList from '@screens/attendance/contacts-list';
//
import SubmitPatrollerTask from '@screens/patroller-task/submit-patroller-task';
import PatrollerTask from '@screens/patroller-task/patroller-task';
//
import ChamberComplaintsList from '@screens/chamber-complaint/chamber-complaints-list';
import AddChamberComplaint from '@screens/chamber-complaint/add-chamber-complaint';
import DeveloperPKPScreen from '@screens/dev-pkp';
//
import CloseTicketScreen from '@screens/tickets/CloseTicketScreen';
import FollowUpScreen from '@screens/tickets/FollowUpScreen';
import TicketDetailsEnhanced from '@screens/tickets/TicketDetails';
import TicketsList from '@screens/tickets/TicketsList';
import {DataType} from '@types';
import {TicketData} from 'src/types/ticket.types';
import OldIRScreen from '@screens/tickets/OldIRScreen';
import NewIRScreen from '@screens/tickets/NewIRScreen';
import MapViewScreen from '@screens/tickets/MapViewScreen';
import {StartTicketScreen} from '@screens/tickets/StartTicketScreen';
import RoadProjectSurvey from '@screens/road-project-survey';
import DistanceCovered from '@screens/distance-covered';
import TubeCoreDetailsScreen from '@screens/tickets/TubeCoreDetailsScreen';
import ChamberDetailsScreen from '@screens/tickets/ChamberDetailsScreen';
import CustomerPickerScreen from '@screens/CustomerPickerScreen';
import SearchCustomer from '@screens/SearchCustomer';
import ChamberReport from '@screens/ChamberReport';
import ChamberDetails from '@screens/ChamberDetails';
import ProfileScreen from '@screens/ProfileScreen';
import AppModulesScreen from '@screens/AppModulesScreen';
import PitInstallation from '@screens/PitInstallationScreen';
import AddMaster from '@screens/addMaster';
import AllMasters from '@screens/allMasters';
import AddMasterForm from '@screens/addMasterForm';
import AddAirMasterOnSupport from '@screens/addAirMasterOnSupport';
import SelectRouteMasterScreen from '@screens/SelectRouteMasterScreen';
import RouteMasterHubScreen from '@screens/RouteMasterHubScreen';
import MakeRouteScreen from '@screens/MakeRouteScreen';
import SelectPausedRouteScreen from '@screens/SelectPausedRouteScreen';
import SelectRouteToChangeFiberScreen from '@screens/SelectRouteToChangeFiberScreen';
import FiberChangeScreen from '@screens/FiberChangeScreen';
import InstallFiberWithSLDScreen from '@screens/InstallFiberWithSLDScreen';
import CircuitConnectivityScreen from '@screens/CircuitConnectivityScreen';
import InfraConnectivityScreen from '@screens/InfraConnectivityScreen';
import type {PausedRouteSnapshot} from '../services/pausedRouteStorage';
export interface RootStackParamList {
  Splash: undefined;
  BottomTab: undefined;
  addMaster: undefined;
  'Add-Master-Form':
    | {
        selectedMasterType?: string;
        selectedMasterLabel?: string;
        routeMasterSelectionMode?: boolean;
        routeName?: string;
        routeDraft?: Record<string, any>;
        returnToRouteBuilder?: boolean;
        routeInitialMasters?: any[];
        returnToRouteHub?: boolean;
        returnToFiberChange?: boolean;
        fiberChangeRoute?: Record<string, any>;
        fiberChangeSelectedFibers?: any[];
        fiberChangeInstallationProgress?: PausedRouteSnapshot;
        fiberChangeInstallationScope?: 'full' | 'partial' | 'withoutSld';
        currentPosition?: {
          latitude: number;
          longitude: number;
        };
        currentAddress?: string;
      }
    | undefined;
  'Add-Air-Master-On-Support': {
    selectedMasterType: 'pop' | 'splitter' | 'tiffin' | 'enclosure';
    selectedMasterLabel: string;
    supportMaster: any;
    supportKey: string;
    currentPosition?: {
      latitude: number;
      longitude: number;
    };
    currentAddress?: string;
    localAttachedMasters?: any[];
  };
  'All-Masters':
    | {
        selectedMasterType?: string;
        selectedMasterLabel?: string;
        currentPosition?: {
          latitude: number;
          longitude: number;
        };
        currentAddress?: string;
        initialMasters?: any[];
        addedMaster?: any;
        addedMasterKey?: string;
        updatedSupportKey?: string;
        updatedSupportCount?: number;
        updatedSupportVersion?: string;
        updatedSupportAddedMaster?: any;
        routeSelectionMode?: boolean;
        routeName?: string;
        routeDraft?: Record<string, any>;
        returnToRouteBuilder?: boolean;
        routeExistingMasters?: any[];
        routeHubMode?: boolean;
        pendingMakeRoute?: RootStackParamList['Make-Route'];
        pendingMakeRouteVersion?: string;
      }
    | undefined;
  'Select-Route-Master': {
    routeSelectionMode: true;
    routeName: string;
    currentPosition: {
      latitude: number;
      longitude: number;
    };
    currentAddress: string;
    initialMasters: any[];
    routeExistingMasters?: any[];
    routeDraft: Record<string, any>;
    returnToRouteBuilder?: boolean;
    addedMaster?: any;
    addedMasterKey?: string;
  };
  'Select-Paused-Route': undefined;
  'Select-Route-To-Change-Fiber':
    | {
        initialPendingSLDJob?: Record<string, any>;
      }
    | undefined;
  'Fiber-Change': {
    selectedRoute: Record<string, any>;
    selectedFibers: any[];
    installationScope?: 'full' | 'partial' | 'withoutSld';
    installationProgress?: PausedRouteSnapshot;
    addedMaster?: any;
    addedMasterKey?: string;
    currentPosition?: {
      latitude: number;
      longitude: number;
    };
    currentAddress?: string;
  };
  'Make-Route': {
    routeName: string;
    routeDraft: Record<string, any>;
    currentPosition: {
      latitude: number;
      longitude: number;
    };
    currentAddress: string;
    selectedMaster?: any;
    selectedMasterVersion?: string;
    resumeSnapshot?: PausedRouteSnapshot;
    readOnly?: boolean;
    fiberChangeMode?: 'full' | 'partial' | 'withoutSld';
    fiberChangeRoute?: Record<string, any>;
    fiberChangeSelectedFibers?: any[];
    fiberChangeActiveMasterKey?: string;
  };
  PrivacyPolicy: undefined;
  Login: undefined;
  ChamberReport: undefined;
  SearchCustomer: undefined;
  CircuitConnectivity: undefined;
  InfraConnectivity: {
    customer: Record<string, any>;
    initialCircuit?: Record<string, any>;
  };
  ProfileScreen: undefined;
  PitInstallation: undefined;
  AddRouteFiberScreen:
    | {
        routeType?: 'new-route';
        asBottomSheet?: boolean;
        currentPosition?: {
          latitude: number;
          longitude: number;
        };
        currentAddress?: string;
        selectedMaster?: any;
        selectedMasterVersion?: string;
        initialRouteMode?: 'withSld' | 'withoutSld';
      }
    | undefined;
  'Install-Fiber-With-SLD': {
    selectedSld: Record<string, any>;
    currentPosition?: {latitude: number; longitude: number};
    currentAddress?: string;
    installationMode?:
      | 'new-route'
      | 'fiber-change-full'
      | 'fiber-change-partial';
    fiberChangeRoute?: Record<string, any>;
    fiberChangeSelectedFibers?: any[];
    routeFiberData?: any[];
    installationProgress?: PausedRouteSnapshot;
  };
  'Route-Master-Hub':
    | {
        currentPosition?: {
          latitude: number;
          longitude: number;
        };
        currentAddress?: string;
        initialMasters?: any[];
        addedMaster?: any;
        addedMasterKey?: string;
        pendingMakeRoute?: RootStackParamList['Make-Route'];
        pendingMakeRouteVersion?: string;
      }
    | undefined;
  AppModulesScreen: undefined;
  ChamberDetails: {
    chamberId: string;
    chamberName: string;
    latitude: number;
    longitude: number;
    address?: string;
  };
  OtpVerification: {
    userId: string;
    password: string;
    appType: string;
    organizationCode: string;
  };
  AttendanceDashboard: {
    shiftType: DataType.ShiftType;
    isViewAllow: boolean;
    isMarkAllow: boolean;
  };
  RoadProject: {};
  AttendanceInOut: {
    from: 'in' | 'out';
    shiftType: DataType.ShiftType;
    behalfOfData: DataType.TodayBehalfOf | null;
  };
  ViewAttendanceReport: undefined;
  DDAttendanceDashboard: {
    shiftType: DataType.ShiftType;
    isViewAllow: boolean;
    isMarkAllow: boolean;
  };
  DDViewAttendanceReport: undefined;
  MonthlySalary: undefined;
  SalaryPaySlip: undefined;
  HolidaysList: undefined;
  ContactsList: undefined;
  //
  PatrollerTask: undefined;
  SubmitPatrollerTask: {
    empID: number;
    selectedChamber: DataType.Chamber | null;
    currentPosition: DataType.Coords | null;
  };
  ChamberComplaintsList: undefined;
  AddChamberComplaint: undefined;
  DeveloperPKPScreen: undefined;
  TicketsList: undefined;
  ChamberDetailsScreen: {
    customerName?: string;
    circuitName?: string;
  };
  TicketDetails: {ticketId: string};
  TicketFollowUp: {
    ticketId: string;
    ticketData: TicketData;
  };
  FollowUpScreen: {
    ticketId: string;
    ticketData: TicketData;
    onReturn?: () => void;
  };
  ChamberSelection: {
    ticketId: string;
    currentLocation: {lat: number; lng: number};
  };
  CloseTicketScreen: {
    ticketId: string;
    ticketData: any;
  };
  // CustomerPickerScreen: {
  //   data: {label: string; value: string; icon?: any}[];
  //   selectedValue: string | null;
  //   onSelect: (v: string) => void;
  // };
  CustomerPickerScreen: {
    data: any[];
    selectedValue: string;
    onSelect: (val: string) => void;
  };

  OldIRScreen: {ticketId: string};
  NewIRScreen: {ticketId: string; chamberDetails?: any};
  TubeCoreDetailsScreen: {issueTypeId: string; ticketId: string};
  MapViewScreen: {latitude: number; longitude: number; title: string};
  IRDetailsScreen: {irId: string; ticketId: string; irData: any};
  [key: string]: any;
}
const Stack = createNativeStackNavigator<RootStackParamList>();
// Recursively read the deepest active route name (works for nested navigators)
const RootStack: FC<{initialRoute: string}> = ({initialRoute}) => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false}}
      initialRouteName={initialRoute}>
      <Stack.Screen name="Splash" component={Splash} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="BottomTab" component={BottomTab} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
      <Stack.Screen name="OtpVerification" component={OtpVerification} />
      <Stack.Screen name="AttendanceInOut" component={AttendanceInOut} />
      <Stack.Screen
        name="ViewAttendanceReport"
        component={viewAttendanceReport}
      />
      <Stack.Screen
        name="AttendanceDashboard"
        component={AttendanceDashboard}
      />
      <Stack.Screen
        name="DDAttendanceDashboard"
        component={DDAttendanceDashboard}
      />
      <Stack.Screen
        name="DDViewAttendanceReport"
        component={DDViewAttendanceReport}
      />
      <Stack.Screen
        name="CustomerPickerScreen"
        component={CustomerPickerScreen}
      />
      <Stack.Screen name="MonthlySalary" component={MonthlySalary} />
      <Stack.Screen name="SalaryPaySlip" component={SalaryPaySlip} />
      <Stack.Screen name="HolidaysList" component={HolidaysList} />
      <Stack.Screen name="ContactsList" component={ContactsList} />
      <Stack.Screen name="PatrollerTask" component={PatrollerTask} />
      <Stack.Screen
        name="SubmitPatrollerTask"
        component={SubmitPatrollerTask}
      />
      <Stack.Screen name="ChamberDetails" component={ChamberDetails} />
      <Stack.Screen
        name="ChamberComplaintsList"
        component={ChamberComplaintsList}
      />
      <Stack.Screen
        name="AddChamberComplaint"
        component={AddChamberComplaint}
      />
      <Stack.Screen name="AddRouteScreen" component={AddRouteScreen} />
      <Stack.Screen
        name="AddRouteFiberScreen"
        component={AddRouteFiberScreen}
        options={{
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: {backgroundColor: 'transparent'},
        }}
      />
      <Stack.Screen name="Route-Master-Hub" component={RouteMasterHubScreen} />
      <Stack.Screen name="SearchCustomer" component={SearchCustomer} />
      <Stack.Screen
        name="CircuitConnectivity"
        component={CircuitConnectivityScreen}
      />
      <Stack.Screen
        name="InfraConnectivity"
        component={InfraConnectivityScreen}
      />
      <Stack.Screen name="RoadProject" component={RoadProjectSurvey} />
      <Stack.Screen name="DistanceCovered" component={DistanceCovered} />
      <Stack.Screen name="PitInstallation" component={PitInstallation} />
      <Stack.Screen name="DeveloperPKPScreen" component={DeveloperPKPScreen} />
      <Stack.Screen name="addMaster" component={AddMaster} />
      <Stack.Screen name="All-Masters" component={AllMasters} />
      <Stack.Screen
        name="Select-Route-Master"
        component={SelectRouteMasterScreen}
      />
      <Stack.Screen name="Make-Route" component={MakeRouteScreen} />
      <Stack.Screen
        name="Install-Fiber-With-SLD"
        component={InstallFiberWithSLDScreen}
      />
      <Stack.Screen
        name="Select-Paused-Route"
        component={SelectPausedRouteScreen}
      />
      <Stack.Screen
        name="Select-Route-To-Change-Fiber"
        component={SelectRouteToChangeFiberScreen}
      />
      <Stack.Screen name="Fiber-Change" component={FiberChangeScreen} />
      <Stack.Screen name="Add-Master-Form" component={AddMasterForm} />
      <Stack.Screen
        name="Add-Air-Master-On-Support"
        component={AddAirMasterOnSupport}
      />
      <Stack.Screen
        name="TicketsList"
        component={TicketsList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ChamberDetailsScreen"
        component={ChamberDetailsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ChamberReport"
        component={ChamberReport}
        options={{headerShown: false}}
      />
      <Stack.Screen name="StartTicketScreen" component={StartTicketScreen} />
      <Stack.Screen
        name="TicketDetails"
        component={TicketDetailsEnhanced}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FollowUpScreen"
        component={FollowUpScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AppModulesScreen"
        component={AppModulesScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="CloseTicketScreen"
        component={CloseTicketScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="OldIRScreen"
        component={OldIRScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="NewIRScreen"
        component={NewIRScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="TubeCoreDetailsScreen"
        component={TubeCoreDetailsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="MapViewScreen"
        component={MapViewScreen}
        options={{headerShown: false}}
      />
      {/* <Stack.Screen
        name="IRDetailsScreen"
        component={IRDetailsScreen}
        options={{headerShown: false}}
      /> */}
    </Stack.Navigator>
  );
};
const RootNavigator = ({}) => {
  const [initialRoute, setInitialRoute] = useState('');
  const getActiveRouteName = (state: any): string | undefined => {
    if (!state) return undefined;
    const route = state.routes?.[state.index ?? 0];
    if (route?.state) return getActiveRouteName(route.state);
    return route?.name;
  };
  // const getActiveRouteName = (state: any): string | undefined => {
  //   if (!state) return undefined;
  //   const route = state.routes?.[state.index ?? 0];
  //   if (route?.state) return getActiveRouteName(route.state);
  //   return route?.name;
  // };
  useEffect(() => {
    const token = Preferences.getData('API_AUTH_TOKEN') ?? null;
    const timer = setTimeout(() => {
      if (token === null || token === undefined) {
        console.log('token', token);
        setInitialRoute('Login');
      } else {
        setInitialRoute('BottomTab');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, []);
  if (initialRoute === '') {
    return <Splash />;
  }
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        // Common.log('RootNavigator is ready');
      }}
      onStateChange={state => {
        try {
          const forced = Preferences.getData('FORCE_UPDATE_REQUIRED') === 'yes';
          if (!forced) return;
          const active = getActiveRouteName(state);
          const BLOCKED_TABS = new Set(['Account', 'Settings']);
          if (active && BLOCKED_TABS.has(active)) {
            Common.showToast(
              'Update to Latest App version to access other Tabs',
            );
            navigationRef.current?.navigate('BottomTab', {screen: 'Home'});
          }
        } catch (e) {}
      }}>
      <RootStack initialRoute={initialRoute} />
    </NavigationContainer>
  );
};

export default RootNavigator;
// eslint-disable-next-line no-lone-blocks
{
  /*
  <Button onPress={() => navigation.goBack()}>Go back</Button>
  <Button onPress={() => navigation.popTo('Home')}>Go to Home</Button>
  <Button onPress={() => navigation.popToTop()}>
    Go back to first screen in stack
  </Button>
      */
}
