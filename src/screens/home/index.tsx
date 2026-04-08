import {APIs, URLs} from '@apis';
import {AnimImage, Buttons, ListView} from '@atoms';
import {DEVELOPER_NAME} from '@env';
import {
  LocationPermission,
  SyncOfflineDataSheet,
  UserNameDesigRow,
} from '@molecules';
import {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import Geolocation from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, CONSTANT, FONTS, IMAGES, SIZE, STYLES} from '@res';
import {todayAttendanceApi} from '@slices/attendance.slice';
import {getLoginTokenApi} from '@slices/dashboard.slice'; // ← dashboardListApi removed
import {DataType, ScreenProps} from '@types';
import {
  attachPosterDispatch,
  postOnceIfDue,
} from '../../services/LocationPosterCore';
import {startForegroundPoster} from '../../services/ForegroundLocationPoster';
import {attachDispatch} from '../../services/LocationBatteryService';
import WelcomeModal from '../../components/molecules/WelcomeModal';
import {
  FontSize,
  LineHeight,
  Padding,
  FontFamily,
  Height,
  Width,
  BoxShadow,
  Border,
} from '../../res/globalStyle';
import {
  Common,
  Location,
  Permissions,
  Preferences,
  Services,
  Voice,
} from '@utils';
import React, {
  FC,
  memo,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AppState,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  Platform,
  View,
  Linking,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Animiatable from 'react-native-animatable';
import {connect, useDispatch} from 'react-redux';
import DeviceInfo from 'react-native-device-info';

// ===== Types =====
type MobileVersion = {
  project_name?: string;
  access_url?: string;
  version_name?: string;
  version_code?: string | number;
  description?: string;
};
export interface ProjectListItemProps {
  data: DataType.Project;
  index?: number;
}
export interface ModuleListItemProps {
  data: DataType.Module;
}
export interface SubModuleListItemProps {
  item: DataType.SubModule;
}
interface ModuleCardProps {
  title: string;
  image: string;
  onPress?: () => void;
}

// ===== Dummy module data =====
const DUMMY_MODULES: {
  name: string;
  bg: string;
  emoji: string;
  screen: keyof RootStackParamList;
}[] = [
  {name: 'Add Master', bg: '#E6F1FB', emoji: '🗼', screen: 'addMaster'},
  {name: 'Add Route', bg: '#FCEBEB', emoji: '🛣️', screen: 'AddRouteScreen'},
];

let navigator: NativeStackNavigationProp<RootStackParamList>;

function getRandomDelay() {
  return Math.floor(Math.random() * (10000 - 2000 + 1)) + 2000;
}
const check = (name: string, lName: string) =>
  Common.isEqualIgnoreCase(name, lName);
const pickGoogleMapKey = (r: any) =>
  r?.googleMapKey ?? r?.data?.googleMapKey ?? null;
const employeeId = (r: any) =>
  r?.employeeDetails?.id ?? r?.data?.employeeDetails?.id ?? null;

const formatBytes = (n?: number) => {
  if (!n || n <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// ===== Version compare helpers =====
const toParts = (v?: string | number) =>
  String(v ?? '')
    .trim()
    .split('.')
    .map(s => parseInt(s, 10))
    .map(n => (Number.isFinite(n) ? n : 0));
const cmpDot = (a: string | number, b: string | number) => {
  const A = toParts(a);
  const B = toParts(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const av = A[i] ?? 0;
    const bv = B[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
};
const isServerNewerThanInstalled = async (serverCode?: string | number) => {
  const sc = String(serverCode ?? '').trim();
  if (!sc) return false;
  if (sc.includes('.')) {
    const appVerName = DeviceInfo.getVersion();
    return cmpDot(sc, appVerName) > 0;
  }
  const appBuild = parseInt(DeviceInfo.getBuildNumber(), 10) || 0;
  const srvBuild = parseInt(sc, 10) || 0;
  return srvBuild > appBuild;
};

// ===== iOS OTA helpers =====
type HeadProbe = {
  ok: boolean;
  status: number;
  contentType?: string | null;
  contentLength?: number | null;
  url: string;
  error?: string;
};
const normalizeUrl = (raw: string) => {
  let u = raw.trim();
  u = u.replace(/([^:])\/{2,}/g, '$1/');
  return u;
};
const probeUrl = async (url: string): Promise<HeadProbe> => {
  try {
    const res = await fetch(url, {method: 'HEAD' as any});
    const ct = res.headers.get('content-type');
    const cl = parseInt(res.headers.get('content-length') || '', 10);
    return {
      ok: res.ok,
      status: res.status,
      contentType: ct,
      contentLength: Number.isFinite(cl) ? cl : null,
      url: res.url || url,
    };
  } catch (_e) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {Range: 'bytes=0-0'},
      } as any);
      const ct = res.headers.get('content-type');
      const cl = parseInt(res.headers.get('content-length') || '', 10);
      return {
        ok: res.ok || res.status === 206,
        status: res.status,
        contentType: ct,
        contentLength: Number.isFinite(cl) ? cl : null,
        url: res.url || url,
      };
    } catch (e: any) {
      return {
        ok: false,
        status: 0,
        contentType: null,
        contentLength: null,
        url,
        error: e?.message || String(e),
      };
    }
  }
};
const isPlistUrl = (u: string) =>
  /\.plist(\?|$)/i.test(u) || /manifest\.plist/i.test(u);
const isIpaUrl = (u: string) => /\.ipa(\?|$)/i.test(u);
const toItmsFromPlist = (manifestUrl: string) =>
  `itms-services://?action=download-manifest&url=${encodeURIComponent(
    manifestUrl,
  )}`;
const openOtaIOS = async (rawUrl: string) => {
  const url = normalizeUrl(rawUrl);
  const probe = await probeUrl(url);
  if (!probe.ok) {
    Common.alert({
      title: 'Update link not reachable',
      msg:
        `URL: ${url}\n` +
        (probe.status ? `Status: ${probe.status}\n` : '') +
        (probe.error
          ? `Error: ${probe.error}`
          : 'Server did not respond as expected'),
    });
    return;
  }
  if (isPlistUrl(url)) {
    if (!url.startsWith('https://')) {
      Common.alert({
        title: 'Manifest must be HTTPS',
        msg: 'iOS requires the manifest.plist to be served over HTTPS.',
      });
      return;
    }
    const itms = toItmsFromPlist(url);
    const can = await Linking.canOpenURL(itms);
    if (!can) {
      Common.alert({title: 'Cannot open installer', msg: itms});
      return;
    }
    await Linking.openURL(itms);
    return;
  }
  if (isIpaUrl(url)) {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Common.alert({title: 'Cannot open URL in Safari', msg: url});
      return;
    }
    await Linking.openURL(url);
    return;
  }
  const can = await Linking.canOpenURL(url);
  if (!can) {
    Common.alert({title: 'Cannot open URL', msg: url});
    return;
  }
  await Linking.openURL(url);
};

// ===== NAVIGATION FOR SUB-MODULES =====
const moduleNavigation = (item: DataType.SubModule) => {
  Common.log('itemData:', item.subModuleName);
  if (
    check(item.subModuleName, 'TICKETS') ||
    check(item.subModuleName, 'COMPLAINTS') ||
    check(item.subModuleName, 'FIBER MAINTENANCE') ||
    check(item.subModuleName, 'SPLICER TICKET') ||
    check(item.subModuleName, 'COMPLAINT MANAGEMENT')
  ) {
    const hasTicketAccess = item.polices?.some(
      p =>
        p.policyName === 'ViewComplaint' ||
        p.policyName === 'AccessTicket' ||
        p.policyName === 'ViewTickets' ||
        p.policyName === 'AccessComplaints',
    );
    if (hasTicketAccess) {
      Common.success('✅ Opening Tickets Module');
      navigator?.getParent()?.navigate('TicketsList');
    } else {
      Common.showToast('❌ Access Denied for Tickets Module');
    }
    return;
  }
  if (check(item.subModuleName, 'ATTENDANCE')) {
    const isViewAllow = item.polices?.some(
      p => p.policyName === 'ViewAttendance',
    );
    const isMarkAllow = item.polices?.some(
      p => p.policyName === 'MarkAttendance',
    );
    navigator?.getParent()?.navigate('AttendanceDashboard', {
      shiftType: 'single',
      isViewAllow,
      isMarkAllow,
    });
  } else if (check(item.subModuleName, 'CONTACTS')) {
    navigator?.getParent()?.navigate('ContactsList');
  } else if (check(item.subModuleName, 'HOLIDAY')) {
    navigator?.getParent()?.navigate('HolidaysList');
  } else if (check(item.subModuleName, 'DOUBLE DUTY')) {
    const isViewAllow = item.polices?.some(
      p => p.policyName === 'ViewDoubleDuty',
    );
    const isMarkAllow = item.polices?.some(
      p => p.policyName === 'MarkDoubleDuty',
    );
    navigator?.getParent()?.navigate('DDAttendanceDashboard', {
      shiftType: 'double',
      isViewAllow,
      isMarkAllow,
    });
  } else if (check(item.subModuleName, 'PAYROLL')) {
    navigator.navigate('MonthlySalary');
  } else if (check(item.subModuleName, 'ROAD PROJECT')) {
    navigator?.getParent()?.navigate('RoadProject');
  } else if (check(item.subModuleName, 'CHAMBER COMPLAINT')) {
    navigator?.getParent()?.navigate('AddChamberComplaint');
  } else if (check(item.subModuleName, 'PATROLLER TASK')) {
    navigator?.getParent()?.navigate('PatrollerTask');
  } else if (check(item.subModuleName, 'CHAMBER DISTANCE')) {
    navigator?.getParent()?.navigate('ChamberDetailsScreen');
  } else if (check(item.subModuleName, 'Search By Customer Name')) {
    navigator?.getParent()?.navigate('SearchCustomer');
  } else if (check(item.subModuleName, 'Chamber Report')) {
    navigator?.getParent()?.navigate('ChamberReport');
  } else if (check(item.subModuleName, 'PIT INSTALLATION')) {
    navigator.navigate('PitInstallation');
  } else if (__DEV__) {
    navigator.navigate('DeveloperPKPScreen');
  } else {
    Common.showToast(item.subModuleName + ' is Under Development');
  }
};

// ===== ModuleCard (real API modules) =====
const ModuleCard: FC<ModuleCardProps> = ({title, image, onPress}) => (
  <TouchableOpacity
    style={styles.moduleCardContainer}
    activeOpacity={CONSTANT.BUTTON_OPACITY}
    onPress={onPress}>
    <View style={styles.moduleCardImageContainer}>
      <AnimImage
        animation={'rubberBand'}
        useNativeDriver={true}
        iterationCount={'infinite'}
        duration={getRandomDelay()}
        source={{uri: image}}
        style={styles.moduleCardImage}
      />
    </View>
  </TouchableOpacity>
);

// ===== Dummy Module Tile =====
const DummyModuleTile: FC<{
  name: string;
  bg: string;
  emoji: string;
  onPress: () => void;
}> = ({name, bg, emoji, onPress}) => {
  const cardWidth = (Common.width - 90) / 4;
  return (
    <Animiatable.View
      animation="zoomIn"
      style={[styles.subModuleItemView, {width: cardWidth}]}>
      <TouchableOpacity
        style={styles.moduleCardContainer}
        activeOpacity={CONSTANT.BUTTON_OPACITY}
        onPress={onPress}>
        <View style={[styles.dummyIconContainer, {backgroundColor: bg}]}>
          <Text style={styles.dummyEmoji}>{emoji}</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.moduleCardTitleText}>{name}</Text>
    </Animiatable.View>
  );
};
// ===== LogoView =====
const LogoView: FC<{
  desc?: string;
  verCode?: string;
  employeeName?: string;
  showWelcome?: boolean;
}> = ({desc = '', verCode = '', employeeName = '', showWelcome = false}) => {
  const appVersion = DeviceInfo.getVersion();
  const buildNumber = DeviceInfo.getBuildNumber();
  return (
    <>
      <Animiatable.Image
        useNativeDriver
        iterationCount="infinite"
        animation="pulse"
        source={IMAGES.globe}
        style={styles.globe}
      />
      {/* //{showWelcome && <WelcomeModal name={user?.userFullName || ''} />} */}
      <View style={styles.parent}>
        <View style={[styles.logoBarRow, styles.viewFlexBox]}>
          <View style={[styles.technosoftParent, styles.viewFlexBox]}>
            <Text style={[styles.technosoft, styles.devTypo]}>GIGA ISP</Text>
            <View
              style={[
                styles.crown24dp1f1f1fFill1Wght20Parent,
                styles.parentFlexBox,
              ]}>
              <Image
                style={styles.crown24dp1f1f1fFill1Wght20Icon}
                resizeMode="cover"
                source={IMAGES.crown}
              />
              <Text style={[styles.dev, styles.devTypo]}>
                {/* {__DEV__ ? 'DEV' : desc || 'DEV'} */}
                PROD
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.android24dp1f1f1fFill0WghtParent,
              styles.parentFlexBox,
            ]}>
            <Image
              style={styles.android24dp1f1f1fFill0WghtIcon}
              resizeMode="cover"
              source={IMAGES.android}
            />
            <View style={{marginLeft: 4}}>
              <Text style={[styles.v21, styles.devTypo2]}>v{appVersion}</Text>
              {verCode ? (
                <Text style={styles.verCodeText}>code {verCode}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </>
  );
};

// ===== StatsDashboard =====
const StatsDashboard: FC<{dashboardList?: any; employeeName: string}> = ({
  dashboardList,
  employeeName,
}) => (
  <View>
    <View style={styles.sectionRow}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionLabel}>MODULES</Text>
      <View style={styles.sectionLine} />
    </View>
    <View style={styles.subModuleListContainer}>
      {DUMMY_MODULES.map(m => (
        <DummyModuleTile
          key={m.name}
          name={m.name}
          bg={m.bg}
          emoji={m.emoji}
          onPress={() => {
            navigator?.getParent()?.navigate(m.screen);
          }}
        />
      ))}
    </View>
  </View>
);

// ===== Real API-driven lists =====
const ProjectList = memo(
  ({data, onRefresh}: {data: DataType.Project[]; onRefresh: () => void}) => (
    <ListView
      data={data}
      bounces
      isRefreshable
      onRefresh={onRefresh}
      renderItem={({item}) => <ProjectListItem data={item} />}
    />
  ),
);

const ProjectListItem: FC<ProjectListItemProps> = ({data}) => (
  <View>
    <ModuleList data={data.modules} />
  </View>
);

const ModuleList = memo(({data}: {data: DataType.Module[]}) => (
  <View>
    <ListView
      data={data}
      renderItem={({item}) => <ModuleListItem data={item} />}
    />
  </View>
));

const ModuleListItem = memo(({data}: {data: DataType.Module}) => (
  <View>
    <View style={[styles.view2, styles.viewBg]} />
    <Text style={styles.moduleTitleText}>{data?.moduleName}</Text>
    <SubModuleList data={data.subModules} />
  </View>
));

const SubModuleList = memo(({data}: {data: DataType.SubModule[]}) => (
  <View style={styles.subModuleListContainer}>
    {data.map(item => (
      <SubModuleListItem item={item} key={item?.subModuleName} />
    ))}
  </View>
));

const SubModuleListItem: FC<SubModuleListItemProps> = ({item}) => {
  const cardWidth = (Common.width - 90) / 4;
  return (
    <Animiatable.View
      animation={'zoomIn'}
      key={item?.subModuleName}
      style={[styles.subModuleItemView, {width: cardWidth}]}>
      <ModuleCard
        title={item.subModuleName}
        image={item.subModuleImage ?? ''}
        onPress={() => moduleNavigation(item)}
      />
      <Text style={styles.moduleCardTitleText}>{item?.subModuleName}</Text>
    </Animiatable.View>
  );
};

// ===== Update Gate =====
const UpdateGateScreen = ({children}: {children: React.ReactNode}) => (
  <View style={styles.updateScreen}>
    <View style={styles.updateScreenInner}>{children}</View>
  </View>
);

const UpdateRequiredCard = ({
  versionName,
  onUpdatePress,
  projectNames,
  currentVersionName,
  currentBuild,
  serverVersionCode,
  downloading,
  percent,
  downloaded,
  total,
}: {
  versionName?: string;
  onUpdatePress: () => void | Promise<void>;
  projectNames: string[];
  currentVersionName?: string;
  currentBuild?: string | number;
  serverVersionCode?: string | number;
  downloading?: boolean;
  percent?: number;
  downloaded?: number;
  total?: number;
}) => (
  <View style={styles.updateCard}>
    <Text style={styles.updateTitle}>Update Required</Text>
    <Text style={styles.updateSubtitle}>
      A new version {versionName ? `(${versionName}) ` : ''}is available for{' '}
      {projectNames.join(', ')} and you are using an older version of the
      application. Please update to continue.
    </Text>
    {(currentVersionName || currentBuild || serverVersionCode) && (
      <Text style={styles.updateNote}>
        App: v{currentVersionName ?? '—'} (build {currentBuild ?? '—'}){'\n'}
        Server version code: {serverVersionCode ?? '—'}
      </Text>
    )}
    {downloading ? (
      <Text style={styles.updateNote}>
        Downloading…
        {typeof percent === 'number' && percent >= 0
          ? ` ${percent.toFixed(0)}%`
          : ''}
        {typeof downloaded === 'number' &&
        typeof total === 'number' &&
        total > 0
          ? ` • ${formatBytes(downloaded)} / ${formatBytes(total)}`
          : ''}
      </Text>
    ) : null}
    <Buttons
      type="primary"
      title={downloading ? 'Downloading…' : 'Update Now'}
      onPress={() => void onUpdatePress()}
      viewStyle={styles.updateBtn}
    />
  </View>
);

// ===== HOME SCREEN =====
const Home: FC<ScreenProps.Home> = ({
  loading,
  dashboardList,
  navigation,
  employeeDetails,
}) => {
  navigator = navigation;

  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [isLoading, setisLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const locationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [dlActive, setDlActive] = useState<boolean>(false);
  const [dlPercent, setDlPercent] = useState<number>(0);
  const [dlDownloaded, setDlDownloaded] = useState<number>(0);
  const [dlTotal, setDlTotal] = useState<number>(-1);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [address, setAddress] = useState('');
  const loginData = Preferences.getData('LOGIN_RESPONSE');
  const user = loginData;

  const dispatch = useDispatch<StoreDispatch>();

  const employeeName = useMemo(() => {
    const e = dashboardList?.employeeDetails;
    return `${e?.firstName ?? ''} ${e?.middleName ?? ''} ${
      e?.lastName ?? ''
    }`.trim();
  }, [dashboardList]);

  const serverVersionCode: string = String(
    dashboardList?.mobileAppVersion1?.version_code ??
      dashboardList?.mobileAppVersion?.version_code ??
      '',
  );

  const appDesc: string = dashboardList?.mobileAppVersion1?.description ?? '';

  // ── Forced update gate ───────────────────────────────────────────────────────
  const [forcedUpdateRequired, setForcedUpdateRequired] = useState(false);
  const {forcedAccessUrl, forcedVersionName, forcedProjectName} =
    useMemo(() => {
      const mv1: MobileVersion | undefined = dashboardList?.mobileAppVersion1;
      return {
        forcedAccessUrl: mv1?.access_url as string | undefined,
        forcedVersionName: mv1?.version_name as string | undefined,
        forcedProjectName:
          (mv1?.project_name as string | undefined) ?? 'Employee Master',
      };
    }, [dashboardList]);
  useEffect(() => {
    const interval = setInterval(() => {
      const addrData = Preferences.getData(Preferences.KEY.LAST_GEO_ADDRESS);
      if (addrData?.address && addrData.address !== currentAddress) {
        setCurrentAddress(addrData.address);
      }
    }, 5000); // check every 5s for UI update

    return () => clearInterval(interval);
  }, [currentAddress]);

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          const newer = await isServerNewerThanInstalled(serverVersionCode);
          if (isActive) setForcedUpdateRequired(newer);
        } else {
          if (isActive) setForcedUpdateRequired(false);
        }
      } catch (e) {
        __DEV__ && console.warn('[VersionCheck] failed', e);
        if (isActive) setForcedUpdateRequired(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [serverVersionCode]);

  const hideDashboardModules = forcedUpdateRequired;
  // const getAddressLocation = async (forceRefresh = false) => {
  //   try {
  //     console.log('data1');
  //     setisLoading(true);
  //     setLocationError('');

  //     const permissionStatus = await Location.checkPermission();

  //     if (permissionStatus !== 'granted') {
  //       Alert.alert(
  //         'Permission Required',
  //         'Location permission is required to fetch address.',
  //         [{text: 'OK'}],
  //       );
  //       return;
  //     }

  //     const data = await Location.getAddressFromLatLong(forceRefresh);

  //     // ✅ FIX: addressList handle करो
  //     let finalAddress = '';

  //     if (data?.addressList && data.addressList.length > 0) {
  //       finalAddress = data.addressList[0];
  //     } else if (data?.address) {
  //       finalAddress = data.address;
  //     }

  //     if (finalAddress) {
  //       setAddress(finalAddress);
  //       // Common.showToast('Address updated successfully!');
  //     } else {
  //       setLocationError('Unable to fetch address');
  //     }
  //   } catch (e: any) {
  //     setLocationError(e?.message || 'Location error');
  //   } finally {
  //     setisLoading(false);
  //   }
  // };
  useEffect(() => {
    Preferences.setData(
      'FORCE_UPDATE_REQUIRED',
      hideDashboardModules ? 'yes' : 'no',
    );
  }, [hideDashboardModules]);

  const onUpdatePress = useCallback(async () => {
    const raw = forcedAccessUrl;
    if (!raw) {
      Common.showToast('Update URL not found');
      return;
    }
    if (Platform.OS === 'ios') {
      await openOtaIOS(raw);
      return;
    }
    try {
      const canInstall =
        await NativeModules.ApkInstaller?.canRequestPackageInstalls();
      if (!canInstall) {
        Common.warn('Allow "Install unknown apps" for this app to continue.');
        NativeModules.ApkInstaller?.openUnknownSourcesSettings();
        return;
      }
      setDlActive(true);
      setDlPercent(0);
      setDlDownloaded(0);
      setDlTotal(-1);
      const fileName = `Gigatel-${forcedVersionName ?? 'update'}.apk`;
      await NativeModules.ApkInstaller?.downloadAndInstall(raw, fileName);
    } catch (e: any) {
      setDlActive(false);
      Common.alert({
        title: 'Install failed',
        msg:
          (e?.message ?? String(e)) +
          '\n\nIf you still see "App not installed – package conflicts", ' +
          'the existing app is signed with a different key or has a different packageId. ' +
          'Use the same keystore & package, and ensure versionCode is higher, or uninstall once.',
      });
    }
  }, [forcedAccessUrl, forcedVersionName]);
  // ── Initial setup (login token + permissions only — no dashboardListApi) ──────
  useEffect(() => {
    dispatch(getLoginTokenApi());
    Permissions.requestPermission();
  }, [dispatch]);
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBackgroundColor(COLORS.PRIMARY, true);
      StatusBar.setBarStyle('light-content', true);
    }, []),
  );
  // ── Ticket access derived from dashboardList prop (already in Redux store) ───
  // useEffect(() => {
  //   if (dashboardList) {
  //     const ticketAllowed =
  //       dashboardList?.projectListAll?.some((project: any) =>
  //         project.modules?.some(
  //           (module: any) =>
  //             module.moduleName?.toUpperCase() === 'TICKETS' &&
  //             module.subModules?.some(
  //               (sub: any) =>
  //                 sub.subModuleName?.toUpperCase() === 'TICKETS' &&
  //                 sub.polices?.some((p: any) =>
  //                   [
  //                     'AccessTicket',
  //                     'AccessComplaint',
  //                     'ViewAssignedTicket',
  //                     'ViewTickets',
  //                   ].includes(p.policyName),
  //                 ),
  //             ),
  //         ),
  //       ) ?? false;
  //     Preferences.setData('HAS_TICKET_ACCESS', ticketAllowed ? 'yes' : 'no');
  //   }
  // }, [dashboardList]);

  const ensurePostingServices = useCallback(async () => {
    try {
      attachDispatch(dispatch);
      attachPosterDispatch(dispatch);
      startForegroundPoster();
    } catch (e) {
      __DEV__ && console.warn('[Home] ensurePostingServices failed', e);
    }
  }, [dispatch]);
  // useEffect(() => {
  //   const sub = AppState.addEventListener('change', async state => {
  //     if (['active', 'background'].includes(state)) {
  //       await ensurePostingServices();

  //       // ✅ ADD THIS LINE (IMPORTANT)
  //       await postOnceIfDue('bg', dispatch);
  //     }
  //   });
  //   return () => sub.remove();
  // }, [ensurePostingServices]);
  useEffect(() => {
    void ensurePostingServices();
  }, [ensurePostingServices]);
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const startInterval = () => {
        if (locationTimerRef.current) clearInterval(locationTimerRef.current);
        locationTimerRef.current = setInterval(async () => {
          try {
            await postOnceIfDue('fg', dispatch);
          } catch (e) {
            __DEV__ && console.warn('[Home] postOnceIfDue failed', e);
          }
        }, 30_000); // every 30 seconds
      };

      const startLocationFlow = async () => {
        try {
          await ensurePostingServices();
          startInterval();
        } catch (err) {
          __DEV__ && console.warn('[Home] startLocationFlow failed', err);
        }
      };

      startLocationFlow();

      return () => {
        isMounted = false;
        if (locationTimerRef.current) clearInterval(locationTimerRef.current);
      };
    }, [ensurePostingServices, dispatch]),
  );

  useEffect(() => {
    if (employeeName.length > 0) setShowWelcome(true);
  }, [employeeName]);

  // ── APK installer events ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!NativeModules.ApkInstaller) return;
    const emitter = new NativeEventEmitter(NativeModules.ApkInstaller);
    const subP = emitter.addListener('ApkInstallerProgress', (e: any) => {
      setDlActive(true);
      setDlPercent(typeof e?.percent === 'number' ? e.percent : -1);
      setDlDownloaded(typeof e?.downloaded === 'number' ? e.downloaded : 0);
      setDlTotal(typeof e?.total === 'number' ? e.total : -1);
    });
    const subD = emitter.addListener('ApkInstallerDone', () => {
      setDlActive(false);
      setDlPercent(100);
    });
    const subE = emitter.addListener('ApkInstallerError', (e: any) => {
      setDlActive(false);
      Common.alert({
        title: 'Update failed',
        msg: `${e?.code ?? 'ERROR'}: ${e?.message ?? 'Unknown error'}`,
      });
    });
    return () => {
      subP.remove();
      subD.remove();
      subE.remove();
    };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      __DEV__ && console.log('[AppState]', state);
      if (
        state === 'active' ||
        state === 'background' ||
        state === 'inactive'
      ) {
        try {
          await ensurePostingServices();
        } catch (e) {
          __DEV__ && console.warn('[BG] ensure on AppState failed', e);
        }
      }
    });
    return () => sub.remove();
  }, [ensurePostingServices]);

  // ── Keep posting services alive on AppState changes ───────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (
        state === 'active' ||
        state === 'background' ||
        state === 'inactive'
      ) {
        try {
          await ensurePostingServices();
        } catch (e) {
          __DEV__ && console.warn('[BG] ensure on AppState failed', e);
        }
      }
    });
    return () => sub.remove();
  }, [ensurePostingServices]);

  const handleStartService = useCallback(async () => {
    const res = await Location.checkPermission();
    if (res) {
      await Location.initializeConfig();
      await Services.startLocationService();
      await ensurePostingServices();
    }
  }, [ensurePostingServices]);
  useEffect(() => {
    dispatch(getLoginTokenApi());
    Permissions.requestPermission();
    handleStartService();
  }, [dispatch, handleStartService]);

  // ── One-time mount: location sheet check only (no dashboardListApi) ───────────
  useEffect(() => {
    setShowLocationSheet(
      Preferences.getData('ALLOWED_ACCESS_FOR_LOCATION_BACKGROUND') !== 'yes',
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      setShowPrivacy(false);
      handleStartService();
    }, [handleStartService]),
  );
  const syncOfflineData = async () => {
    try {
      setShowSync(false);
      setisLoading(true);
      const lastAtt = Preferences.getData('OFFLINE_ATTENDANCE');
      const param: any[] = [];
      lastAtt?.forEach((item: any) => param.push(item.params));
      const res = await APIs.postRequestWithJson({
        path: URLs.syncOfflineAttendance,
        params: {attendanceList: param},
        isAuth: true,
      });
      setisLoading(false);
      if (res?.status === 200 && res.success) {
        const msg = 'ऑफलाइन डेटा सर्वर पर सिंक हो चुका है।';
        Common.alert({
          title: 'Sync Successful',
          msg: 'Offline data sync successfully to server. \n\n' + msg,
        });
        Voice.speak(msg);
        Preferences.removeData('OFFLINE_ATTENDANCE');
      } else {
        Common.alert({
          title: 'Alert',
          msg: res?.messege ?? 'Something went wrong in offline sync.',
        });
      }
    } catch (err) {
      Common.error('Error in Sync at Home', err);
      setShowSync(false);
      setisLoading(false);
    }
  };

  const sync = () => {
    const lastAtt = Preferences.getData('OFFLINE_ATTENDANCE');
    NetInfo.fetch().then(state => {
      if (state.isConnected && lastAtt && lastAtt.length > 0) {
        setShowSync(true);
      }
    });
  };
  useFocusEffect(
    useCallback(() => {
      sync();
    }, []),
  );
  useEffect(() => {
    const fetchAndSaveInitialAddress = async () => {
      try {
        // ✅ Ensure permission first
        const hasPermission = await Location.checkPermission();
        if (!hasPermission) {
          const granted = await Permissions.requestPermission();
          if (!granted) {
            __DEV__ &&
              console.log('[Home] Permission denied, skipping location fetch');
            return;
          }
        }

        // ✅ Get address using your helper (it gets coords internally)
        const geo =
          (await Location.getAddressFromLatLong()) as DataType.GeoAddress;
        console.log('[Home] updated geoLocation', geo);

        if (geo?.lat && geo?.long) {
          // Save to preferences
          Preferences.setData(Preferences.KEY.LAST_GEO_ADDRESS, {
            lat: geo.lat,
            long: geo.long,
            address: geo.address ?? '',
          });

          __DEV__ &&
            console.log('[Home] initial address fetched:', geo.address);

          // ✅ Trigger first post after address fetched
          await postOnceIfDue('fg', dispatch);
        } else {
          __DEV__ && console.log('[Home] could not fetch valid coordinates');
        }
      } catch (err) {
        __DEV__ && console.warn('[Home] initial address fetch error:', err);
      }
    };

    // small delay for GPS initialization
    const timer = setTimeout(fetchAndSaveInitialAddress, 1000);
    return () => clearTimeout(timer);
  }, [dispatch]);

  const appVersionName = DeviceInfo.getVersion();
  const appBuildNumber = DeviceInfo.getBuildNumber();
  const hasApiModules = (dashboardList?.projectListAll?.length ?? 0) > 0;
  return (
    <Screen
      loading={loading || isLoading}
      statusBgColor={COLORS.PRIMARY}
      preset="fixed">
      {hideDashboardModules ? (
        <UpdateGateScreen>
          <UpdateRequiredCard
            versionName={forcedVersionName}
            onUpdatePress={() => void onUpdatePress()}
            projectNames={[forcedProjectName]}
            currentVersionName={appVersionName}
            currentBuild={appBuildNumber}
            serverVersionCode={serverVersionCode}
            downloading={dlActive}
            percent={dlPercent}
            downloaded={dlDownloaded}
            total={dlTotal}
          />
        </UpdateGateScreen>
      ) : (
        <>
          {/* 1. Header bar */}
          <UserNameDesigRow
            name={user?.userFullName ?? ''}
            designation={user?.designaionName ?? ''}
            onBellPress={() => {}}
          />

          {/* 2. Scrollable body */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 3. Globe + branding bar + version */}
            <View style={{marginTop: SIZE.MVS(20)}}>
              <LogoView
                desc={appDesc}
                verCode={serverVersionCode}
                employeeName={employeeName}
                showWelcome={showWelcome}
              />
            </View>

            {/* 4. Dummy cards (Add Master / Add Route) */}
            <StatsDashboard
              dashboardList={dashboardList}
              employeeName={employeeName}
            />
            {/* 5. Real API modules from Redux store */}
            {hasApiModules && (
              <View style={styles.innerContainer}>
                <ProjectList
                  onRefresh={() => sync()}
                  data={dashboardList?.projectListAll ?? []}
                />
              </View>
            )}
          </ScrollView>

          {/* 6. Location permission sheet */}
          {!showPrivacy && (
            <LocationPermission
              show={showLocationSheet}
              onAllowPress={() => setShowLocationSheet(false)}
              onPrivacyPress={() => {
                setShowPrivacy(true);
                navigation.getParent()?.navigate('PrivacyPolicy');
              }}
            />
          )}
          <Text>{user?.email}</Text>
          {/* 7. Offline sync sheet */}
          <SyncOfflineDataSheet
            show={showSync}
            onSyncPress={() => syncOfflineData()}
          />
        </>
      )}
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading: state.attendance.onBehalfLoading === 'pending', // ← dashboard.loading removed
  dashboardList: state.dashboard.dashboardList,
});
export default connect(MapStateToProps)(Home);

// ====== STYLES ======
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
  },
  scrollContent: {
    paddingBottom: SIZE.MS(24),
  },

  // ── LogoView ──────────────────────────────────────────────────────────────────
  globe: {
    width: SIZE.MS(200),
    height: SIZE.MS(200),
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  parent: {
    backgroundColor: COLORS.colorGainsboro,
    borderRadius: SIZE.MS(20),
    marginHorizontal: SIZE.MS(14),
    marginBottom: SIZE.MS(10),
  },
  logoBarRow: {
    width: '100%',
    overflow: 'hidden',
    paddingHorizontal: SIZE.MVS(12),
    paddingVertical: SIZE.MVS(14),
    gap: SIZE.MVS(24),
    backgroundColor: COLORS.colorGainsboro,
  },
  viewFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    borderRadius: SIZE.MS(6),
  },
  technosoftParent: {
    gap: SIZE.MS(8),
  },
  technosoft: {
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
    lineHeight: LineHeight.lh_19,
    fontSize: FontSize.fs_15,
  },
  crown24dp1f1f1fFill1Wght20Parent: {
    borderRadius: 6,
    backgroundColor: '#766B6B30',
    paddingLeft: 6,
    paddingTop: Padding.padding_4,
    paddingRight: 8,
    paddingBottom: Padding.padding_4,
    gap: 3,
  },
  crown24dp1f1f1fFill1Wght20Icon: {
    height: 11,
    width: 11,
  },
  dev: {
    fontSize: 11,
    lineHeight: 13,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  devTypo: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    color: '#393d45',
  },
  devTypo2: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    color: '#0ca2dd',
    fontSize: 13,
  },
  android24dp1f1f1fFill0WghtParent: {
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  android24dp1f1f1fFill0WghtIcon: {
    height: 24,
    width: 24,
  },
  v21: {
    color: '#0ca2dd',
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
    lineHeight: LineHeight.lh_19,
    fontSize: FontSize.fs_15,
  },
  verCodeText: {
    color: COLORS.TEXT_LIGHT ?? '#999',
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.REGULAR,
    textAlign: 'left',
  },
  parentFlexBox: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },

  // ── Section divider ───────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SIZE.MS(14),
    marginTop: SIZE.MS(14),
    marginBottom: SIZE.MS(6),
  },
  sectionLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: COLORS.colorGainsboro,
  },
  sectionLabel: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    marginHorizontal: SIZE.MS(8),
    letterSpacing: 0.8,
  },

  // ── Dummy tile ────────────────────────────────────────────────────────────────
  dummyIconContainer: {
    width: '70%',
    aspectRatio: 1,
    borderRadius: SIZE.MS(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  dummyEmoji: {
    fontSize: SIZE.MS(18),
  },

  // ── Shared module grid ────────────────────────────────────────────────────────
  subModuleItemView: {margin: SIZE.MS(6)},
  subModuleListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZE.MS(8),
    paddingBottom: SIZE.MS(14),
  },
  innerContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
    padding: SIZE.MS(15),
  },
  moduleCardContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(12),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  moduleCardImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  moduleCardImage: {
    width: SIZE.MS(28),
    height: SIZE.MS(28),
  },
  moduleCardTitleText: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(8),
    color: COLORS.TEXT_DARK,
    textAlign: 'center',
    marginTop: SIZE.MS(5),
  },
  moduleTitleText: {
    fontSize: SIZE.MS(12),
    lineHeight: SIZE.MS(19),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    margin: SIZE.MS(10),
  },
  viewBg: {
    backgroundColor: COLORS.colorGainsboro,
    flex: 1,
  },
  view2: {
    width: '100%',
    height: SIZE.MS(1),
    marginTop: SIZE.MVS(10),
  },

  // ── Update gate ───────────────────────────────────────────────────────────────
  updateScreen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
    paddingHorizontal: SIZE.MS(16),
    paddingVertical: SIZE.MS(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateScreenInner: {
    width: '100%',
    maxWidth: SIZE.MS(420),
  },
  updateCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(12),
    paddingVertical: SIZE.MS(20),
    paddingHorizontal: SIZE.MS(16),
    ...STYLES.SHADOW_PRIMARY_3,
  },
  updateTitle: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(22),
    color: COLORS.PRIMARY_DARK,
    marginBottom: SIZE.MS(10),
    textAlign: 'center',
  },
  updateSubtitle: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MVS(14),
    color: COLORS.TEXT_DARK,
    marginBottom: SIZE.MS(16),
    lineHeight: SIZE.MVS(20),
    textAlign: 'center',
  },
  updateBtn: {
    alignSelf: 'center',
    paddingHorizontal: SIZE.MS(18),
    height: SIZE.MVS(44),
    borderRadius: SIZE.MS(10),
    marginTop: SIZE.MS(6),
    marginBottom: SIZE.MS(10),
  },
  updateNote: {
    marginTop: SIZE.MS(6),
    marginBottom: SIZE.MS(6),
    fontSize: SIZE.MVS(12),
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
  },

  // ── Stats container ───────────────────────────────────────────────────────────
  dashContainer: {
    backgroundColor: COLORS.WHITE,
    marginHorizontal: SIZE.MS(14),
    marginBottom: SIZE.MS(10),
    borderRadius: SIZE.MS(16),
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
});
