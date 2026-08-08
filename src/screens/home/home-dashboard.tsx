import {DataType} from '@types';
import {FONTS, IMAGES, SIZE} from '@res';
import DeviceInfo from 'react-native-device-info';
import LinearGradient from 'react-native-linear-gradient';
import React, {useEffect, useMemo, useRef} from 'react';
import Svg, {Circle, Path} from 'react-native-svg';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

type DashboardProps = {
  dashboardList: DataType.DasboardResponse | null;
  user: any;
  refreshing: boolean;
  lastSyncLabel: string;
  syncCompletedCount: number;
  syncSuccessful: boolean;
  operationalCounts: {
    totalMasters: number;
    routesAdded: number;
    buildings: number;
  };
  onRefresh: () => void;
  onSync: () => void;
  onAddMaster: () => void;
  onRouteFiber: () => void;
  onModulePress: (item: DataType.SubModule) => void;
};

type Stat = {
  label: string;
  value: number;
  icon?: ImageSourcePropType;
  iconNode?: React.ReactNode;
  tint: string;
  bg: string;
};

const TowerIcon = ({color = '#6D20D8', size = 32}) => (
  <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <Path
      d="M20 10.5L11.5 36M20 10.5L28.5 36M14.4 27H25.6M12 36H28M16.5 20.5H23.5M20 10.5V36"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="20" cy="9" r="2.5" fill={color} />
    <Path
      d="M13.5 5.5C11.2 7.8 11.2 11.5 13.5 13.8M26.5 5.5C28.8 7.8 28.8 11.5 26.5 13.8M9.5 2C5.3 6.2 5.3 13.1 9.5 17.3M30.5 2C34.7 6.2 34.7 13.1 30.5 17.3"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </Svg>
);

const getActivities = (dashboard: any) => {
  const possible =
    dashboard?.recentActivities ??
    dashboard?.recentActivity ??
    dashboard?.activityList ??
    dashboard?.data?.recentActivities ??
    [];
  return Array.isArray(possible) ? possible.slice(0, 3) : [];
};

const getSubModules = (dashboard: any): DataType.SubModule[] => {
  const modules = dashboard?.projectListAll?.flatMap(
    (project: DataType.Project) => project?.modules ?? [],
  );
  return (modules ?? []).flatMap(
    (module: DataType.Module) => module?.subModules ?? [],
  );
};

const activityColorStyles = StyleSheet.create({
  green: {backgroundColor: '#00A466'},
  blue: {backgroundColor: '#155DFC'},
  orange: {backgroundColor: '#F36A10'},
});
const activityColors = [
  activityColorStyles.green,
  activityColorStyles.blue,
  activityColorStyles.orange,
];

const AnimatedPath = Animated.createAnimatedComponent(Path);

const NetworkHero = ({version}: {version: string}) => {
  const currentFlow = useRef(new Animated.Value(0)).current;
  const networkPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const flowAnimation = Animated.loop(
      Animated.timing(currentFlow, {
        toValue: 1,
        duration: 1350,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(networkPulse, {
          toValue: 1,
          duration: 1350,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(networkPulse, {
          toValue: 0,
          duration: 1350,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    flowAnimation.start();
    pulseAnimation.start();
    return () => {
      flowAnimation.stop();
      pulseAnimation.stop();
    };
  }, [currentFlow, networkPulse]);

  const routes = [
    'M884 495 C810 480 698 461 575 416',
    'M864 444 C843 397 808 354 798 307',
    'M938 447 C983 405 1055 385 1160 351',
    'M982 508 C1052 524 1142 524 1250 503',
    'M946 550 C990 586 1023 625 1060 682',
    'M824 540 C790 581 747 617 648 653',
  ];
  const nodePoints = [
    {cx: 575, cy: 416},
    {cx: 798, cy: 307},
    {cx: 1160, cy: 351},
    {cx: 1250, cy: 503},
    {cx: 1060, cy: 682},
    {cx: 648, cy: 653},
  ];

  return (
    <View style={styles.heroCard}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          '#FFFFFF',
          '#FFFFFF',
          '#F7F3FF',
          '#D8C9EC',
          '#9068C0',
          '#4A159F',
          '#2D0E6C',
        ]}
        locations={[0, 0.36, 0.43, 0.52, 0.64, 0.78, 1]}
        start={{x: 0, y: 0.45}}
        end={{x: 1, y: 0.55}}
        style={styles.networkBackdrop}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.networkAnimationLayer,
          {
            transform: [
              {
                translateY: networkPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [3, -3],
                }),
              },
              {
                scale: networkPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1.08],
                }),
              },
            ],
          },
        ]}>
        <Image
          source={IMAGES.gigaBuildingNetwork}
          resizeMode="contain"
          style={styles.networkImage}
        />
        <Animated.View
          style={[
            styles.networkCurrentLayer,
            {
              opacity: networkPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.82, 1],
              }),
            },
          ]}>
          <Svg width="100%" height="100%" viewBox="0 0 1672 941">
            {routes.map(route => (
              <Path
                key={`glow-${route}`}
                d={route}
                fill="none"
                stroke="rgba(24,187,255,0.58)"
                strokeWidth={31}
                strokeLinecap="round"
              />
            ))}
            {routes.map((route, index) => {
              const routeOffset = currentFlow.interpolate({
                inputRange: [0, 1],
                outputRange: [-index * 24, -360 - index * 24],
              });
              return (
                <React.Fragment key={route}>
                  <AnimatedPath
                    d={route}
                    fill="none"
                    opacity={0.96}
                    stroke="#20DFFF"
                    strokeWidth={24}
                    strokeLinecap="round"
                    strokeDasharray="76 104"
                    strokeDashoffset={routeOffset as any}
                  />
                  <AnimatedPath
                    d={route}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={11}
                    strokeLinecap="round"
                    strokeDasharray="48 132"
                    strokeDashoffset={routeOffset as any}
                  />
                </React.Fragment>
              );
            })}
            {nodePoints.map(point => (
              <Circle
                key={`${point.cx}-${point.cy}`}
                {...point}
                r={15}
                fill="#F9FBFF"
                stroke="#36D5FF"
                strokeWidth={7}
              />
            ))}
          </Svg>
        </Animated.View>
      </Animated.View>
      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>GIGA ISP</Text>
        <Text style={styles.heroSubtitle}>
          {'Connecting Communities,\nPowering Possibilities'}
        </Text>
        <View style={styles.versionBadge}>
          <Image source={IMAGES.android} style={styles.versionIcon} />
          <Text style={styles.versionText}>v{version}</Text>
        </View>
      </View>
    </View>
  );
};

const StatItem = ({item, compact}: {item: Stat; compact: boolean}) => (
  <View style={styles.statItem}>
    <View style={[styles.statIconCircle, {backgroundColor: item.bg}]}>
      {item.iconNode ??
        (item.icon ? (
          <Image
            source={item.icon}
            style={[styles.statIcon, {tintColor: item.tint}]}
          />
        ) : null)}
    </View>
    <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
      {item.value}
    </Text>
    <Text numberOfLines={compact ? 2 : 1} style={styles.statLabel}>
      {item.label}
    </Text>
  </View>
);

const ActionCard = ({
  title,
  subtitle,
  color,
  bg,
  icon,
  iconNode,
  onPress,
}: {
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  icon: ImageSourcePropType;
  iconNode?: React.ReactNode;
  onPress: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.82}
    accessibilityRole="button"
    accessibilityLabel={`${title}. ${subtitle}`}
    onPress={onPress}
    style={[styles.actionCard, {borderColor: `${color}22`}]}>
    <View style={[styles.actionIconBox, {backgroundColor: bg}]}>
      {iconNode ?? (
        <Image source={icon} style={[styles.actionIcon, {tintColor: color}]} />
      )}
    </View>
    <View style={styles.actionCopy}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </View>
    <View style={[styles.actionArrow, {backgroundColor: color}]}>
      <Text style={styles.actionArrowText}>›</Text>
    </View>
  </TouchableOpacity>
);

export const HomeDashboard = ({
  dashboardList,
  user,
  refreshing,
  lastSyncLabel,
  syncCompletedCount,
  syncSuccessful,
  operationalCounts,
  onRefresh,
  onSync,
  onAddMaster,
  onRouteFiber,
  onModulePress,
}: DashboardProps) => {
  const {width} = useWindowDimensions();
  const compact = width < 360;
  const employee = dashboardList?.employeeDetails as any;
  const displayName =
    user?.userFullName ??
    [employee?.firstName, employee?.middleName, employee?.lastName]
      .filter(Boolean)
      .join(' ') ??
    'GIGA ISP User';
  const designation =
    user?.designaionName ?? employee?.designationName ?? 'Field Executive';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0])
      .join('')
      .toUpperCase() || 'GI';
  const subModules = useMemo(
    () => getSubModules(dashboardList),
    [dashboardList],
  );
  const stats = useMemo<Stat[]>(() => {
    return [
      {
        label: 'Total Masters',
        value: operationalCounts.totalMasters,
        iconNode: <TowerIcon size={27} />,
        tint: '#6D20D8',
        bg: '#F0E4FF',
      },
      {
        label: 'Routes Added',
        value: operationalCounts.routesAdded,
        icon: IMAGES.FiberEnclosur,
        tint: '#00975B',
        bg: '#E4F5EA',
      },
      {
        label: 'Buildings',
        value: operationalCounts.buildings,
        icon: IMAGES.Building,
        tint: '#F36A10',
        bg: '#FFF0E4',
      },
      {
        label: 'Sync Completed',
        value: syncCompletedCount,
        icon: IMAGES.checkImage,
        tint: '#155DFC',
        bg: '#E9EFFF',
      },
    ];
  }, [operationalCounts, syncCompletedCount]);
  const activities = useMemo(
    () => getActivities(dashboardList),
    [dashboardList],
  );
  const version = DeviceInfo.getVersion();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#351184', '#47149D', '#301070']}
        style={styles.headerBg}>
        <View style={styles.orbitOne} />
        <View style={styles.orbitTwo} />
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={styles.profileName}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={styles.profileRole}>
              {designation}
            </Text>
            <View style={styles.envBadge}>
              <Image source={IMAGES.crown} style={styles.crown} />
              <Text style={styles.envText}>GIGA ISP</Text>
              <Text style={styles.envDot}>•</Text>
              <Text style={styles.envPill}>{__DEV__ ? 'DEV' : 'PROD'}</Text>
            </View>
          </View>
          <View accessibilityLabel="Notifications" style={styles.bellButton}>
            <Image source={IMAGES.notification} style={styles.bellIcon} />
            {!!dashboardList?.notification && (
              <View style={styles.notificationDot} />
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6D20D8"
            colors={['#6D20D8']}
          />
        }>
        <NetworkHero version={version} />

        <View style={styles.statsCard}>
          {stats.map((item, index) => (
            <React.Fragment key={item.label}>
              <StatItem item={item} compact={compact} />
              {index < stats.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MODULES</Text>
        </View>

        <View style={[styles.actionsRow, compact && styles.actionsColumn]}>
          <ActionCard
            title="Add Master"
            subtitle="Add new master with location & details"
            color="#6D20D8"
            bg="#F0E4FF"
            icon={IMAGES.globe}
            iconNode={<TowerIcon size={36} />}
            onPress={onAddMaster}
          />
          <ActionCard
            title="Add Route / Change Fiber"
            subtitle="Manage routes and fiber changes"
            color="#00975B"
            bg="#E7F5EC"
            icon={IMAGES.FiberEnclosur}
            onPress={onRouteFiber}
          />
        </View>

        {subModules.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.apiModuleRow}>
            {subModules.slice(0, 8).map(item => (
              <TouchableOpacity
                key={`${item.subModuleId}-${item.subModuleName}`}
                onPress={() => onModulePress(item)}
                style={styles.apiModuleCard}>
                {item.subModuleImage ? (
                  <Image
                    source={{uri: item.subModuleImage}}
                    style={styles.apiModuleIcon}
                  />
                ) : (
                  <Image source={IMAGES.module} style={styles.apiModuleIcon} />
                )}
                <Text numberOfLines={2} style={styles.apiModuleText}>
                  {item.subModuleName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>Pending Activity</Text>
            {activities.length > 0 && (
              <Text style={styles.linkText}>See All</Text>
            )}
          </View>
          {activities.length > 0 ? (
            activities.map((activity: any, index: number) => (
              <View
                key={activity?.id ?? index}
                style={[
                  styles.activityRow,
                  index > 0 && styles.activityBorder,
                ]}>
                <View
                  style={[
                    styles.activityIconWrap,
                    activityColors[Math.min(index, activityColors.length - 1)],
                  ]}>
                  <Text style={styles.activityCheck}>✓</Text>
                </View>
                <Text numberOfLines={2} style={styles.activityText}>
                  {activity?.title ??
                    activity?.message ??
                    activity?.name ??
                    'Activity updated'}
                </Text>
                <Text style={styles.activityTime}>
                  {activity?.time ?? activity?.createdAt ?? ''}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyActivity}>
              <View style={styles.emptyActivityIcon}>
                <Text style={styles.activityCheck}>✓</Text>
              </View>
              <Text style={styles.emptyActivityText}>
                No pending activity from the server yet
              </Text>
            </View>
          )}
        </View>

        <LinearGradient colors={['#F3FCF8', '#F7FFFC']} style={styles.syncCard}>
          <View style={styles.syncCloud}>
            <Image source={IMAGES.sync} style={styles.syncCloudIcon} />
          </View>
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>
              {syncSuccessful ? 'Sync Successful' : 'All data is up to date'}
            </Text>
            <Text style={styles.syncSubtitle}>Last sync: {lastSyncLabel}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{disabled: refreshing}}
            disabled={refreshing}
            onPress={onSync}
            style={[
              styles.syncButton,
              refreshing && styles.syncButtonDisabled,
            ]}>
            <Image
              source={syncSuccessful ? IMAGES.checkImage : IMAGES.sync}
              style={styles.syncButtonIcon}
            />
            <Text style={styles.syncButtonText}>
              {refreshing
                ? 'Syncing...'
                : syncSuccessful
                ? 'Sync Successful'
                : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>
    </View>
  );
};

const shadow = {
  shadowColor: '#201547',
  shadowOffset: {width: 0, height: 4},
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#F8F8FB'},
  headerBg: {
    height: SIZE.MVS(202),
    paddingHorizontal: SIZE.MS(18),
    paddingTop: SIZE.MVS(30),
    overflow: 'hidden',
  },
  orbitOne: {
    position: 'absolute',
    width: 340,
    height: 150,
    borderRadius: 170,
    borderWidth: 1,
    borderColor: 'rgba(172,115,255,0.24)',
    right: -90,
    bottom: -80,
    transform: [{rotate: '-8deg'}],
  },
  orbitTwo: {
    position: 'absolute',
    width: 290,
    height: 130,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(172,115,255,0.18)',
    right: -20,
    bottom: -83,
    transform: [{rotate: '-8deg'}],
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZE.MVS(7),
  },
  avatar: {
    width: SIZE.MS(58),
    height: SIZE.MS(58),
    borderRadius: SIZE.MS(29),
    backgroundColor: '#FAF8FF',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {fontFamily: FONTS.BOLD, color: '#5518AE', fontSize: SIZE.MS(22)},
  profileCopy: {flex: 1, marginLeft: SIZE.MS(14)},
  profileName: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(19),
    lineHeight: SIZE.MVS(23),
    color: '#FFF',
  },
  profileRole: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(13),
    color: 'rgba(255,255,255,0.92)',
    marginTop: 2,
  },
  envBadge: {
    alignSelf: 'flex-start',
    marginTop: SIZE.MVS(8),
    minHeight: SIZE.MVS(24),
    paddingHorizontal: SIZE.MS(8),
    borderRadius: SIZE.MS(12),
    backgroundColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  crown: {
    width: SIZE.MS(13),
    height: SIZE.MS(13),
    resizeMode: 'contain',
    tintColor: '#5C1DB8',
  },
  envText: {
    fontFamily: FONTS.SEMI_BOLD,
    color: '#5C1DB8',
    fontSize: SIZE.MS(10),
    marginLeft: 4,
  },
  envDot: {color: '#8C75B7', marginHorizontal: 5},
  envPill: {fontFamily: FONTS.MEDIUM, color: '#5C1DB8', fontSize: SIZE.MS(10)},
  bellButton: {
    width: SIZE.MS(48),
    height: SIZE.MS(48),
    borderRadius: SIZE.MS(15),
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    resizeMode: 'contain',
    tintColor: '#FFF',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4D67',
  },
  scroll: {flex: 1, marginTop: SIZE.MVS(-74)},
  content: {paddingHorizontal: SIZE.MS(15), paddingBottom: SIZE.MVS(22)},
  heroCard: {
    ...shadow,
    height: SIZE.MVS(184),
    borderRadius: SIZE.MS(20),
    overflow: 'hidden',
    backgroundColor: '#F9F8FF',
    borderWidth: 1,
    borderColor: '#D9D3E5',
  },
  networkAnimationLayer: {
    position: 'absolute',
    left: '33%',
    width: '73%',
    height: '100%',
    top: 0,
  },
  networkImage: {width: '100%', height: '100%'},
  networkBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  networkCurrentLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: SIZE.MS(20),
    width: '54%',
  },
  heroTitle: {
    fontFamily: FONTS.BLACK,
    color: '#10113F',
    fontSize: SIZE.MS(25),
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontFamily: FONTS.REGULAR,
    color: '#30345F',
    fontSize: SIZE.MS(12),
    lineHeight: SIZE.MVS(18),
    marginTop: SIZE.MVS(8),
  },
  versionBadge: {
    marginTop: SIZE.MVS(14),
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(10),
    height: SIZE.MVS(28),
    borderRadius: SIZE.MS(14),
    backgroundColor: '#DCEEFF',
  },
  versionIcon: {
    width: SIZE.MS(19),
    height: SIZE.MS(19),
    resizeMode: 'contain',
    tintColor: '#087FD7',
  },
  versionText: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(11),
    color: '#087FD7',
    marginLeft: 6,
  },
  statsCard: {
    ...shadow,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    minHeight: SIZE.MVS(106),
    marginTop: SIZE.MVS(14),
    borderRadius: SIZE.MS(18),
    borderWidth: 1,
    borderColor: '#E3E2E8',
    paddingVertical: SIZE.MVS(12),
    paddingHorizontal: 2,
  },
  statItem: {flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 2},
  statIconCircle: {
    width: SIZE.MS(39),
    height: SIZE.MS(39),
    borderRadius: SIZE.MS(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {width: SIZE.MS(21), height: SIZE.MS(21), resizeMode: 'contain'},
  statValue: {
    fontFamily: FONTS.BOLD,
    color: '#111127',
    fontSize: SIZE.MS(17),
    marginTop: SIZE.MVS(6),
  },
  statLabel: {
    fontFamily: FONTS.REGULAR,
    color: '#535775',
    textAlign: 'center',
    fontSize: SIZE.MS(9),
    lineHeight: SIZE.MVS(12),
    marginTop: 1,
  },
  statDivider: {width: 1, height: SIZE.MVS(67), backgroundColor: '#E8E7EC'},
  sectionHeader: {
    marginTop: SIZE.MVS(20),
    marginBottom: SIZE.MVS(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(14),
    letterSpacing: 1.2,
    color: '#131638',
  },
  linkText: {fontFamily: FONTS.MEDIUM, color: '#7020DE', fontSize: SIZE.MS(12)},
  actionsRow: {flexDirection: 'row', gap: SIZE.MS(9)},
  actionsColumn: {flexDirection: 'column'},
  actionCard: {
    ...shadow,
    flex: 1,
    minHeight: SIZE.MVS(104),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: SIZE.MS(16),
    borderWidth: 1,
    padding: SIZE.MS(10),
  },
  actionIconBox: {
    width: SIZE.MS(47),
    height: SIZE.MS(64),
    borderRadius: SIZE.MS(13),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {width: SIZE.MS(29), height: SIZE.MS(29), resizeMode: 'contain'},
  actionCopy: {flex: 1, minWidth: 0, paddingLeft: SIZE.MS(9)},
  actionTitle: {
    fontFamily: FONTS.SEMI_BOLD,
    color: '#121329',
    fontSize: SIZE.MS(11),
    lineHeight: SIZE.MVS(15),
  },
  actionSubtitle: {
    fontFamily: FONTS.REGULAR,
    color: '#5D617B',
    fontSize: SIZE.MS(9),
    lineHeight: SIZE.MVS(13),
    marginTop: 3,
  },
  actionArrow: {
    width: SIZE.MS(25),
    height: SIZE.MS(25),
    borderRadius: SIZE.MS(13),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  actionArrowText: {
    color: '#FFF',
    fontSize: SIZE.MS(23),
    lineHeight: SIZE.MS(23),
    marginTop: -2,
  },
  apiModuleRow: {
    paddingTop: SIZE.MVS(12),
    paddingRight: SIZE.MS(15),
    gap: SIZE.MS(9),
  },
  apiModuleCard: {
    width: SIZE.MS(86),
    minHeight: SIZE.MVS(82),
    borderRadius: SIZE.MS(14),
    borderWidth: 1,
    borderColor: '#E6E3EC',
    backgroundColor: '#FFF',
    padding: SIZE.MS(9),
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiModuleIcon: {
    width: SIZE.MS(29),
    height: SIZE.MS(29),
    resizeMode: 'contain',
  },
  apiModuleText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(8.5),
    lineHeight: SIZE.MVS(11),
    color: '#343750',
    textAlign: 'center',
    marginTop: 6,
  },
  activityCard: {
    ...shadow,
    marginTop: SIZE.MVS(16),
    borderRadius: SIZE.MS(17),
    borderWidth: 1,
    borderColor: '#E3E2E8',
    backgroundColor: '#FFF',
    padding: SIZE.MS(16),
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZE.MVS(7),
  },
  activityTitle: {
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(14),
    color: '#17182E',
  },
  activityRow: {
    minHeight: SIZE.MVS(45),
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityBorder: {borderTopWidth: 1, borderTopColor: '#EEEFF3'},
  activityIconWrap: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    borderRadius: SIZE.MS(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCheck: {color: '#FFF', fontFamily: FONTS.BOLD, fontSize: SIZE.MS(11)},
  activityText: {
    flex: 1,
    marginHorizontal: SIZE.MS(10),
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(10),
    color: '#535775',
  },
  activityTime: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(9),
    color: '#9295A6',
  },
  emptyActivity: {
    minHeight: SIZE.MVS(49),
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyActivityIcon: {
    width: SIZE.MS(22),
    height: SIZE.MS(22),
    borderRadius: SIZE.MS(11),
    backgroundColor: '#00A466',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActivityText: {
    fontFamily: FONTS.REGULAR,
    color: '#73778E',
    fontSize: SIZE.MS(10),
    marginLeft: SIZE.MS(10),
  },
  syncCard: {
    marginTop: SIZE.MVS(16),
    minHeight: SIZE.MVS(78),
    borderRadius: SIZE.MS(17),
    borderWidth: 1,
    borderColor: '#BFE9D7',
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZE.MS(13),
  },
  syncCloud: {
    width: SIZE.MS(38),
    height: SIZE.MS(38),
    borderRadius: SIZE.MS(19),
    backgroundColor: '#09AA6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncCloudIcon: {
    width: SIZE.MS(21),
    height: SIZE.MS(21),
    tintColor: '#FFF',
    resizeMode: 'contain',
  },
  syncCopy: {flex: 1, marginLeft: SIZE.MS(10)},
  syncTitle: {
    fontFamily: FONTS.SEMI_BOLD,
    color: '#06945A',
    fontSize: SIZE.MS(12),
  },
  syncSubtitle: {
    fontFamily: FONTS.REGULAR,
    color: '#535775',
    fontSize: SIZE.MS(9),
    marginTop: 3,
  },
  syncButton: {
    minHeight: SIZE.MVS(34),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#06945A',
    borderRadius: SIZE.MS(18),
    paddingHorizontal: SIZE.MS(11),
  },
  syncButtonDisabled: {opacity: 0.65},
  syncButtonIcon: {
    width: SIZE.MS(14),
    height: SIZE.MS(14),
    tintColor: '#06945A',
    resizeMode: 'contain',
  },
  syncButtonText: {
    fontFamily: FONTS.SEMI_BOLD,
    color: '#078E58',
    fontSize: SIZE.MS(10),
    marginLeft: 6,
  },
});
