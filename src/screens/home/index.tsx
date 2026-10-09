import {APIs, URLs} from '@apis';
import {Buttons} from '@atoms';
import {LocationPermission, SyncOfflineDataSheet} from '@molecules';
import {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import NetInfo from '@react-native-community/netinfo';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, SIZE, STYLES} from '@res';
import {dashboardListApi, getLoginTokenApi} from '@slices/dashboard.slice';
import {GetMasterByNameAPI, GetRouteDetailsPaggiAPI} from '@slices/route.slice';
import {DataType, ScreenProps} from '@types';
import {
  attachPosterDispatch,
  postOnceIfDue,
} from '../../services/LocationPosterCore';
import {startForegroundPoster} from '../../services/ForegroundLocationPoster';
import {attachDispatch} from '../../services/LocationBatteryService';
import {loadRecentlyAddedMasters} from '../../services/airPlacedMasterStorage';
import {getCompletedAppRoutes} from '../../services/routeFiberChangeStorage';
import {FontSize, LineHeight, Padding, FontFamily} from '../../res/globalStyle';
import {Common, Location, Permissions, Preferences, Services} from '@utils';
import React, {
  FC,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  Platform,
  View,
  Linking,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  ScrollView,
} from 'react-native';
import {connect, useDispatch} from 'react-redux';
import DeviceInfo from 'react-native-device-info';
import {HomeDashboard} from './home-dashboard';

// ===== Types =====
type MobileVersion = {
  project_name?: string;
  access_url?: string;
  version_name?: string;
  version_code?: string | number;
  description?: string;
  created_on?: string;
};

type OperationalCounts = {
  totalMasters: number;
  routesAdded: number;
  buildings: number;
};

export type PendingSLDJob = {
  id: number;
  code: string;
  routeId: number;
  routeCode: string;
  routeName: string;
  fiberCode: string;
  fiberSpecification: string;
  fiberType: string;
  totalDrumLength: number;
  remainingDrumLength: number;
  routeLength: number;
  jobId: string;
  jobStatus: string;
};

type CachedOperationalCounts = OperationalCounts & {
  masterTypeCounts?: Record<string, number>;
};

const ISP_MASTER_TYPES = [
  'Pole',
  'Tree',
  'Building',
  'POP',
  'Splitter',
  'Tiffin',
  'Enclosure',
  'Chamber',
] as const;
const HOME_OPERATIONAL_COUNTS = Preferences.KEY.HOME_OPERATIONAL_COUNTS;

const asArray = (response: any): any[] => {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  const nested =
    response?.data?.data ??
    response?.data?.result ??
    response?.data?.items ??
    response?.data?.records ??
    response?.result ??
    response?.items ??
    response?.records ??
    response?.list ??
    response?.values;
  return Array.isArray(nested) ? nested : [];
};

const normalizedText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const getMasterType = (master: any, fallback = '') =>
  normalizedText(
    master?.masterType ?? master?.MasterType ?? master?.type ?? fallback,
  );

const getMasterIdentity = (master: any, fallbackType = '') => {
  const type = getMasterType(master, fallbackType);
  const id = normalizedText(
    master?.id ?? master?.Id ?? master?.masterId ?? master?.MasterId,
  );
  if (id && id !== '0') {
    return `${type}:id:${id}`;
  }
  const name = normalizedText(
    master?.name ?? master?.Name ?? master?.masterName ?? master?.MasterName,
  );
  const latLng = normalizedText(
    master?.latLng ?? master?.LatLng ?? master?.latlng,
  ).replace(/\s/g, '');
  return `${type}:value:${name}:${latLng}`;
};

const uniqueMasters = (masters: any[], fallbackType: string) =>
  Array.from(
    new Map(
      masters.map(master => [getMasterIdentity(master, fallbackType), master]),
    ).values(),
  );

const getCachedOperationalCounts = (): CachedOperationalCounts => {
  const cached = Preferences.getData(HOME_OPERATIONAL_COUNTS);
  return {
    totalMasters: Number(cached?.totalMasters) || 0,
    routesAdded: Number(cached?.routesAdded) || 0,
    buildings: Number(cached?.buildings) || 0,
    masterTypeCounts:
      cached?.masterTypeCounts && typeof cached.masterTypeCounts === 'object'
        ? cached.masterTypeCounts
        : {},
  };
};
let navigator: NativeStackNavigationProp<RootStackParamList>;
const check = (name: string, lName: string) =>
  Common.isEqualIgnoreCase(name, lName);

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

// ===== Update Gate =====
const UpdateGateScreen = ({children}: {children: React.ReactNode}) => (
  <ScrollView
    style={styles.updateScreen}
    contentContainerStyle={styles.updateScreenContent}
    showsVerticalScrollIndicator={false}>
    <View style={styles.updateScreenInner}>{children}</View>
  </ScrollView>
);

const UpdateRequiredCard = ({
  versionName,
  description,
  publishedOn,
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
  description?: string;
  publishedOn?: string;
  onUpdatePress: () => void | Promise<void>;
  projectNames: string[];
  currentVersionName?: string;
  currentBuild?: string | number;
  serverVersionCode?: string | number;
  downloading?: boolean;
  percent?: number;
  downloaded?: number;
  total?: number;
}) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const progress =
    typeof percent === 'number' && percent >= 0
      ? Math.min(100, Math.max(0, percent))
      : 0;

  return (
    <View style={styles.updateCard}>
      <View style={styles.updateVisual}>
        <Animated.View
          style={[
            styles.updatePulse,
            {
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.32, 0],
              }),
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1.35],
                  }),
                },
              ],
            },
          ]}
        />
        <View style={styles.updateIconCircle}>
          <Text style={styles.updateIcon}>↓</Text>
        </View>
        <View style={styles.updateShieldBadge}>
          <Text style={styles.updateShieldIcon}>✓</Text>
        </View>
      </View>

      <View style={styles.updateRequiredBadge}>
        <View style={styles.updateRequiredDot} />
        <Text style={styles.updateRequiredText}>IMPORTANT UPDATE</Text>
      </View>
      <Text style={styles.updateTitle}>A new version is ready</Text>
      <Text style={styles.updateSubtitle}>
        Update {projectNames.join(', ')} to keep using the latest features and
        improvements.
      </Text>

      <View style={styles.versionCompareRow}>
        <View style={styles.versionCompareItem}>
          <Text style={styles.versionCompareLabel}>INSTALLED</Text>
          <Text style={styles.versionCompareValue}>
            v{currentVersionName ?? '—'}
          </Text>
          <Text style={styles.versionCompareBuild}>
            Build {currentBuild ?? '—'}
          </Text>
        </View>
        <View style={styles.versionArrowCircle}>
          <Text style={styles.versionArrow}>›</Text>
        </View>
        <View style={[styles.versionCompareItem, styles.versionCompareLatest]}>
          <Text style={styles.versionCompareLabelLatest}>LATEST</Text>
          <Text style={styles.versionCompareValueLatest}>
            v{versionName ?? serverVersionCode ?? '—'}
          </Text>
          <Text style={styles.versionCompareBuildLatest}>
            Build {serverVersionCode ?? '—'}
          </Text>
        </View>
      </View>

      {!!description && (
        <View style={styles.releaseNotes}>
          <Text style={styles.releaseNotesIcon}>✦</Text>
          <View style={styles.releaseNotesCopy}>
            <Text style={styles.releaseNotesTitle}>What’s new</Text>
            <Text style={styles.releaseNotesText}>{description}</Text>
          </View>
        </View>
      )}

      {downloading && (
        <View style={styles.downloadPanel}>
          <View style={styles.downloadLabelRow}>
            <View style={styles.downloadStatusRow}>
              <ActivityIndicator size="small" color="#6D20D8" />
              <Text style={styles.downloadLabel}>Downloading update</Text>
            </View>
            <Text style={styles.downloadPercent}>
              {progress > 0 ? `${progress.toFixed(0)}%` : '…'}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, {width: `${progress}%` as any}]}
            />
          </View>
          {typeof downloaded === 'number' && total && total > 0 ? (
            <Text style={styles.downloadBytes}>
              {formatBytes(downloaded)} of {formatBytes(total)}
            </Text>
          ) : null}
        </View>
      )}

      <Buttons
        type="primary"
        title={downloading ? 'Downloading securely…' : 'Download & Update'}
        disabled={downloading}
        onPress={() => void onUpdatePress()}
        viewStyle={
          [
            styles.updateBtn,
            downloading ? styles.updateBtnDisabled : undefined,
          ] as any
        }
      />
      <Text style={styles.updateFooter}>
        🔒 Secure update from Gigatel
        {publishedOn ? `  •  ${publishedOn}` : ''}
      </Text>
    </View>
  );
};

// ===== HOME SCREEN =====
const Home: FC<ScreenProps.Home> = ({loading, dashboardList, navigation}) => {
  navigator = navigation;

  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [isLoading, setisLoading] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const locationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [dlActive, setDlActive] = useState<boolean>(false);
  const [dlPercent, setDlPercent] = useState<number>(0);
  const [dlDownloaded, setDlDownloaded] = useState<number>(0);
  const [dlTotal, setDlTotal] = useState<number>(-1);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [pendingSLDJobs, setPendingSLDJobs] = useState<PendingSLDJob[]>([]);
  const [pendingSLDJobsLoading, setPendingSLDJobsLoading] = useState(false);
  const [pendingSLDJobsError, setPendingSLDJobsError] = useState<string | null>(
    null,
  );
  const [lastSyncLabel, setLastSyncLabel] = useState(
    Preferences.getData('LAST_HOME_SYNC') ?? 'Not synced yet',
  );
  const [syncCompletedCount, setSyncCompletedCount] = useState(
    Number(Preferences.getData('HOME_SYNC_COUNT') ?? 0),
  );
  const [syncSuccessful, setSyncSuccessful] = useState(false);
  const [operationalCounts, setOperationalCounts] = useState<OperationalCounts>(
    () => {
      const cached = getCachedOperationalCounts();
      return {
        totalMasters: cached.totalMasters,
        routesAdded: cached.routesAdded,
        buildings: cached.buildings,
      };
    },
  );
  const loginData = Preferences.getData('LOGIN_RESPONSE');
  const user = loginData;

  const dispatch = useDispatch<StoreDispatch>();

  const refreshDashboard = useCallback(
    async (force = true) => {
      setDashboardRefreshing(true);
      try {
        await dispatch(dashboardListApi({isRefresh: force})).unwrap();
        const label = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        Preferences.setData('LAST_HOME_SYNC', label);
        setLastSyncLabel(label);
        return true;
      } catch (error) {
        __DEV__ && console.warn('[Home] dashboard refresh failed', error);
        Common.showToast('Unable to refresh dashboard. Please try again.');
        return false;
      } finally {
        setDashboardRefreshing(false);
      }
    },
    [dispatch],
  );

  const refreshOperationalCounts = useCallback(async () => {
    const cached = getCachedOperationalCounts();
    const recentMasters = loadRecentlyAddedMasters();
    const masterRequests = ISP_MASTER_TYPES.map(masterType =>
      dispatch(GetMasterByNameAPI({name: masterType})).unwrap(),
    );
    const routeRequest = dispatch(
      GetRouteDetailsPaggiAPI({page: 1, size: 1000, search: ''}),
    ).unwrap();
    const [routeResult, ...masterResults] = await Promise.allSettled([
      routeRequest,
      ...masterRequests,
    ]);

    const nextTypeCounts: Record<string, number> = {
      ...(cached.masterTypeCounts ?? {}),
    };

    ISP_MASTER_TYPES.forEach((masterType, index) => {
      const normalizedType = normalizedText(masterType);
      const localMasters = recentMasters.filter(
        master => getMasterType(master) === normalizedType,
      );
      const result = masterResults[index];
      if (result?.status === 'fulfilled') {
        const apiMasters = asArray(result.value);
        nextTypeCounts[normalizedType] = uniqueMasters(
          [...apiMasters, ...localMasters],
          masterType,
        ).length;
      } else {
        nextTypeCounts[normalizedType] = Math.max(
          Number(nextTypeCounts[normalizedType]) || 0,
          uniqueMasters(localMasters, masterType).length,
        );
      }
    });

    const localCompletedRoutes = getCompletedAppRoutes().length;
    let routesAdded = Math.max(cached.routesAdded, localCompletedRoutes);
    if (routeResult.status === 'fulfilled') {
      routesAdded = Math.max(
        Number(routeResult.value?.recordsFiltered) || 0,
        Number(routeResult.value?.recordsTotal) || 0,
        asArray(routeResult.value).length,
        localCompletedRoutes,
      );
    }

    const nextCounts: OperationalCounts = {
      totalMasters: ISP_MASTER_TYPES.reduce(
        (total, masterType) =>
          total + (Number(nextTypeCounts[normalizedText(masterType)]) || 0),
        0,
      ),
      routesAdded,
      buildings: Number(nextTypeCounts.building) || 0,
    };
    setOperationalCounts(nextCounts);
    Preferences.setData(HOME_OPERATIONAL_COUNTS, {
      ...nextCounts,
      masterTypeCounts: nextTypeCounts,
    });
    return (
      routeResult.status === 'fulfilled' &&
      masterResults.every(result => result.status === 'fulfilled')
    );
  }, [dispatch]);

  const refreshPendingSLDJobs = useCallback(async () => {
    setPendingSLDJobsLoading(true);
    setPendingSLDJobsError(null);
    try {
      const response = await APIs.getRequestWithQuery({
        path: URLs.getPendingSLDJobsISP,
        isAuth: true,
      });
      if (response?.success && response?.status === 200) {
        setPendingSLDJobs(asArray(response) as PendingSLDJob[]);
        return true;
      }
      throw response;
    } catch (error: any) {
      __DEV__ && console.warn('[Home] pending SLD jobs failed', error);
      setPendingSLDJobsError(
        error?.message ?? 'Unable to load pending SLD jobs.',
      );
      return false;
    } finally {
      setPendingSLDJobsLoading(false);
    }
  }, []);

  const refreshHomeData = useCallback(
    async (force = true) => {
      const [dashboardUpdated] = await Promise.all([
        refreshDashboard(force),
        refreshOperationalCounts(),
        refreshPendingSLDJobs(),
      ]);
      return dashboardUpdated;
    },
    [refreshDashboard, refreshOperationalCounts, refreshPendingSLDJobs],
  );

  const serverSyncCompleted = Number(
    (dashboardList as any)?.syncCompleted ??
      (dashboardList as any)?.syncCount ??
      (dashboardList as any)?.data?.syncCompleted ??
      0,
  );

  useEffect(() => {
    if (serverSyncCompleted > syncCompletedCount) {
      setSyncCompletedCount(serverSyncCompleted);
      Preferences.setData('HOME_SYNC_COUNT', serverSyncCompleted);
    }
  }, [serverSyncCompleted, syncCompletedCount]);

  useFocusEffect(
    useCallback(() => {
      // Always ask DashboardList2 for the latest mobileAppVersion1 on focus.
      // The regular dashboard cache must never delay a mandatory APK update.
      void refreshHomeData(true);
    }, [refreshHomeData]),
  );

  const serverVersionCode: string = String(
    dashboardList?.mobileAppVersion1?.version_code ?? '',
  );

  // ── Forced update gate ───────────────────────────────────────────────────────
  const [forcedUpdateRequired, setForcedUpdateRequired] = useState(false);
  const {
    forcedAccessUrl,
    forcedVersionName,
    forcedProjectName,
    forcedDescription,
    forcedPublishedOn,
  } = useMemo(() => {
    const mv1: MobileVersion | undefined = dashboardList?.mobileAppVersion1;
    return {
      forcedAccessUrl: mv1?.access_url as string | undefined,
      forcedVersionName: mv1?.version_name as string | undefined,
      forcedProjectName:
        (mv1?.project_name as string | undefined) ?? 'Employee Master',
      forcedDescription: mv1?.description,
      forcedPublishedOn: mv1?.created_on,
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
    const raw = forcedAccessUrl?.trim();
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
        if (locationTimerRef.current) clearInterval(locationTimerRef.current);
      };
    }, [ensurePostingServices, dispatch]),
  );

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
        Preferences.removeData('OFFLINE_ATTENDANCE');
        return true;
      } else {
        Common.showToast(
          res?.messege ?? 'Something went wrong in offline sync.',
        );
        return false;
      }
    } catch (err) {
      Common.error('Error in Sync at Home', err);
      setShowSync(false);
      setisLoading(false);
      return false;
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

  const handleSyncNow = async () => {
    setSyncSuccessful(false);
    const offlineAttendance = Preferences.getData('OFFLINE_ATTENDANCE');
    if (Array.isArray(offlineAttendance) && offlineAttendance.length > 0) {
      const offlineSynced = await syncOfflineData();
      if (!offlineSynced) {
        return;
      }
    }
    const dashboardSynced = await refreshDashboard(true);
    if (dashboardSynced) {
      await Promise.all([refreshOperationalCounts(), refreshPendingSLDJobs()]);
      const nextCount = Math.max(syncCompletedCount, serverSyncCompleted) + 1;
      setSyncCompletedCount(nextCount);
      Preferences.setData('HOME_SYNC_COUNT', nextCount);
      setSyncSuccessful(true);
    }
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
  return (
    <Screen
      loading={loading || isLoading}
      statusBgColor={COLORS.PRIMARY}
      preset="fixed">
      {hideDashboardModules ? (
        <UpdateGateScreen>
          <UpdateRequiredCard
            versionName={forcedVersionName}
            description={forcedDescription}
            publishedOn={forcedPublishedOn}
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
          <HomeDashboard
            dashboardList={dashboardList}
            user={user}
            refreshing={dashboardRefreshing || pendingSLDJobsLoading}
            pendingSLDJobs={pendingSLDJobs}
            pendingSLDJobsLoading={pendingSLDJobsLoading}
            pendingSLDJobsError={pendingSLDJobsError}
            lastSyncLabel={lastSyncLabel}
            syncCompletedCount={syncCompletedCount}
            syncSuccessful={syncSuccessful}
            operationalCounts={operationalCounts}
            onRefresh={() => void refreshHomeData(true)}
            onRetryPendingSLDJobs={() => void refreshPendingSLDJobs()}
            onPendingSLDJobPress={job =>
              navigator?.getParent()?.navigate('Select-Route-To-Change-Fiber', {
                initialPendingSLDJob: job,
              })
            }
            onSync={() => void handleSyncNow()}
            onAddMaster={() => navigator?.getParent()?.navigate('addMaster')}
            onRouteFiber={() =>
              navigator?.getParent()?.navigate('Route-Master-Hub')
            }
            onCircuitConnectivity={() =>
              navigator?.getParent()?.navigate('CircuitConnectivity')
            }
            onModulePress={moduleNavigation}
          />

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

// const MapStateToProps = (state: RootState) => ({
//   loading: state.attendance.onBehalfLoading === 'pending', // ← dashboard.loading removed
//   dashboardList: state.dashboard.dashboardList,
// });
// export default connect(MapStateToProps)(Home);
const MapStateToProps = (state: RootState) => ({
  loading: state.attendance.onBehalfLoading === 'pending',
  dashboardList: state.dashboard.dashboardList,
});

const ConnectedHome = connect(MapStateToProps)(Home);

// ✅ Wrapper absorbs navigation/route from Tab.Screen and passes to Redux-connected component
const HomeScreen: React.FC<any> = props => <ConnectedHome {...props} />;
export default HomeScreen;

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
  dummyImageIcon: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    tintColor: COLORS.colorMediumslateblue,
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
    backgroundColor: '#F4F0FC',
  },
  updateScreenContent: {
    flexGrow: 1,
    paddingHorizontal: SIZE.MS(16),
    paddingVertical: SIZE.MS(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateScreenInner: {
    width: '100%',
    maxWidth: SIZE.MS(420),
  },
  updateCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(26),
    borderWidth: 1,
    borderColor: '#E6DDF7',
    paddingVertical: SIZE.MS(24),
    paddingHorizontal: SIZE.MS(20),
    ...STYLES.SHADOW_PRIMARY_3,
  },
  updateVisual: {
    width: SIZE.MS(104),
    height: SIZE.MS(104),
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZE.MVS(12),
  },
  updatePulse: {
    position: 'absolute',
    width: SIZE.MS(92),
    height: SIZE.MS(92),
    borderRadius: SIZE.MS(46),
    backgroundColor: '#8B5CF6',
  },
  updateIconCircle: {
    width: SIZE.MS(76),
    height: SIZE.MS(76),
    borderRadius: SIZE.MS(38),
    backgroundColor: '#6D20D8',
    borderWidth: SIZE.MS(6),
    borderColor: '#EEE6FB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6D20D8',
    shadowOffset: {width: 0, height: 7},
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
  },
  updateIcon: {
    color: '#FFF',
    fontSize: SIZE.MS(38),
    fontFamily: FONTS.BOLD,
    lineHeight: SIZE.MS(43),
  },
  updateShieldBadge: {
    position: 'absolute',
    right: SIZE.MS(6),
    bottom: SIZE.MS(11),
    width: SIZE.MS(29),
    height: SIZE.MS(29),
    borderRadius: SIZE.MS(15),
    backgroundColor: '#14A66A',
    borderWidth: 3,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateShieldIcon: {
    color: '#FFF',
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(13),
  },
  updateRequiredBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0E7FF',
    paddingHorizontal: SIZE.MS(10),
    paddingVertical: SIZE.MVS(5),
    borderRadius: SIZE.MS(14),
    marginBottom: SIZE.MVS(9),
  },
  updateRequiredDot: {
    width: SIZE.MS(6),
    height: SIZE.MS(6),
    borderRadius: SIZE.MS(3),
    backgroundColor: '#6D20D8',
    marginRight: SIZE.MS(6),
  },
  updateRequiredText: {
    color: '#6D20D8',
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(9),
    letterSpacing: 0.9,
  },
  updateTitle: {
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MVS(23),
    color: '#17132D',
    marginBottom: SIZE.MS(7),
    textAlign: 'center',
  },
  updateSubtitle: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MVS(13),
    color: '#68627A',
    marginBottom: SIZE.MS(18),
    lineHeight: SIZE.MVS(20),
    textAlign: 'center',
  },
  versionCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZE.MVS(14),
  },
  versionCompareItem: {
    flex: 1,
    minHeight: SIZE.MVS(75),
    borderRadius: SIZE.MS(14),
    backgroundColor: '#F6F4F9',
    borderWidth: 1,
    borderColor: '#E9E5EE',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZE.MS(8),
  },
  versionCompareLatest: {
    backgroundColor: '#F1EAFE',
    borderColor: '#CFBAF4',
  },
  versionCompareLabel: {
    fontFamily: FONTS.BOLD,
    color: '#918B9D',
    fontSize: SIZE.MS(8),
    letterSpacing: 0.7,
  },
  versionCompareLabelLatest: {
    fontFamily: FONTS.BOLD,
    color: '#6D20D8',
    fontSize: SIZE.MS(8),
    letterSpacing: 0.7,
  },
  versionCompareValue: {
    fontFamily: FONTS.BOLD,
    color: '#504A5B',
    fontSize: SIZE.MS(15),
    marginTop: 3,
  },
  versionCompareValueLatest: {
    fontFamily: FONTS.BOLD,
    color: '#5B16B7',
    fontSize: SIZE.MS(15),
    marginTop: 3,
  },
  versionCompareBuild: {
    fontFamily: FONTS.REGULAR,
    color: '#918B9D',
    fontSize: SIZE.MS(9),
    marginTop: 2,
  },
  versionCompareBuildLatest: {
    fontFamily: FONTS.REGULAR,
    color: '#7950B5',
    fontSize: SIZE.MS(9),
    marginTop: 2,
  },
  versionArrowCircle: {
    width: SIZE.MS(28),
    height: SIZE.MS(28),
    borderRadius: SIZE.MS(14),
    marginHorizontal: SIZE.MS(7),
    backgroundColor: '#6D20D8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  versionArrow: {
    color: '#FFF',
    fontSize: SIZE.MS(23),
    lineHeight: SIZE.MS(25),
  },
  releaseNotes: {
    flexDirection: 'row',
    backgroundColor: '#F8F6FB',
    borderRadius: SIZE.MS(13),
    padding: SIZE.MS(12),
    marginBottom: SIZE.MVS(14),
  },
  releaseNotesIcon: {
    color: '#6D20D8',
    fontSize: SIZE.MS(18),
    marginRight: SIZE.MS(9),
  },
  releaseNotesCopy: {flex: 1},
  releaseNotesTitle: {
    fontFamily: FONTS.SEMI_BOLD,
    color: '#29233A',
    fontSize: SIZE.MS(11),
    marginBottom: 3,
  },
  releaseNotesText: {
    fontFamily: FONTS.REGULAR,
    color: '#6E687A',
    fontSize: SIZE.MS(10),
    lineHeight: SIZE.MVS(15),
  },
  downloadPanel: {
    marginBottom: SIZE.MVS(12),
  },
  downloadLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZE.MVS(7),
  },
  downloadStatusRow: {flexDirection: 'row', alignItems: 'center'},
  downloadLabel: {
    marginLeft: SIZE.MS(7),
    fontFamily: FONTS.MEDIUM,
    color: '#4D465B',
    fontSize: SIZE.MS(10),
  },
  downloadPercent: {
    fontFamily: FONTS.BOLD,
    color: '#6D20D8',
    fontSize: SIZE.MS(11),
  },
  progressTrack: {
    height: SIZE.MVS(8),
    borderRadius: SIZE.MS(4),
    backgroundColor: '#EAE4F2',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: SIZE.MS(4),
    backgroundColor: '#6D20D8',
  },
  downloadBytes: {
    marginTop: SIZE.MVS(5),
    textAlign: 'right',
    fontFamily: FONTS.REGULAR,
    color: '#8B8497',
    fontSize: SIZE.MS(9),
  },
  updateBtn: {
    width: '100%',
    height: SIZE.MVS(48),
    borderRadius: SIZE.MS(14),
    marginBottom: SIZE.MS(11),
  },
  updateBtnDisabled: {opacity: 0.72},
  updateFooter: {
    fontFamily: FONTS.REGULAR,
    color: '#918B9D',
    fontSize: SIZE.MS(9),
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
