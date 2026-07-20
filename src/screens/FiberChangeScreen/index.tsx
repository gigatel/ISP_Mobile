import React, {FC, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {BackHeader} from '@molecules';
import type {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {COLORS, IMAGES, SIZE} from '@res';
import {Location} from '@utils';
import {
  getCompletedAppRoute,
  StoredRouteFiberSelection,
} from '../../services/routeFiberChangeStorage';
import PointerSvg from '../../res/images/pointer.svg';
import GoogleMapsIconSvg from '../../res/images/Google_Maps_icon.svg';
import styles from './styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Fiber-Change'>;

type Coordinate = {latitude: number; longitude: number};

type RouteMaster = {
  key: string;
  raw: any;
  masterId: string;
  masterType: string;
  masterTypeLabel: string;
  name: string;
  address: string;
  latLngText: string;
  coordinate: Coordinate | null;
  distance: number;
  fiberLabel: string;
  active: boolean;
  images: string[];
  icon: any;
  loopMeters: string;
};

const MASTER_META: Record<string, {label: string; icon: any}> = {
  pole: {label: 'Pole', icon: IMAGES.PoleImage},
  tree: {label: 'Tree', icon: IMAGES.treeIcon},
  building: {label: 'Building', icon: IMAGES.Building},
  pop: {label: 'POP', icon: IMAGES.FiberEnclosur},
  splitter: {label: 'Splitter', icon: IMAGES.enclosureIcon},
  tiffin: {label: 'Tiffin', icon: IMAGES.TiffinIcon},
  enclosure: {label: 'Enclosure', icon: IMAGES.jointEnclosure},
  start: {label: 'Start Point', icon: IMAGES.mapPin},
  end: {label: 'End Point', icon: IMAGES.mapPin},
  master: {label: 'Master', icon: IMAGES.module},
};

const asText = (value: unknown) => String(value ?? '').trim();

const readField = (value: any, ...keys: string[]) => {
  const key = keys.find(item => value?.[item] !== undefined);
  return key ? value?.[key] : undefined;
};

const parseCoordinateText = (value: unknown): Coordinate | null => {
  const parts = asText(value)
    .split(',')
    .map(item => Number(item.trim()));
  if (
    parts.length < 2 ||
    !Number.isFinite(parts[0]) ||
    !Number.isFinite(parts[1])
  ) {
    return null;
  }
  return {latitude: parts[0], longitude: parts[1]};
};

const getCoordinate = (value: any): Coordinate | null => {
  const direct = value?.coordinate;
  if (Number.isFinite(direct?.latitude) && Number.isFinite(direct?.longitude)) {
    return direct;
  }
  const textCoordinate = parseCoordinateText(
    readField(value, 'latLng', 'LatLng', 'latlng', 'endLatLng', 'startLatLng'),
  );
  if (textCoordinate) {
    return textCoordinate;
  }
  const latitude = Number(readField(value, 'latitude', 'Latitude', 'lat'));
  const longitude = Number(
    readField(value, 'longitude', 'Longitude', 'lng', 'long'),
  );
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? {latitude, longitude}
    : null;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceBetween = (first: Coordinate, second: Coordinate) => {
  const radius = 6371000;
  const dLat = toRadians(second.latitude - first.latitude);
  const dLng = toRadians(second.longitude - first.longitude);
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const safeValue = Math.min(1, Math.max(0, value));
  return (
    radius * 2 * Math.atan2(Math.sqrt(safeValue), Math.sqrt(1 - safeValue))
  );
};

const requestCurrentPosition = (
  enableHighAccuracy: boolean,
  timeout: number,
  maximumAge: number,
) =>
  new Promise<Coordinate>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      value =>
        resolve({
          latitude: value.coords.latitude,
          longitude: value.coords.longitude,
        }),
      reject,
      {enableHighAccuracy, timeout, maximumAge},
    );
  });

const getMasterArrays = (route: any): any[] => {
  const candidates = [
    route?.routeChamberMappingVM,
    route?.routeChamberMappings,
    route?.routeMasterDetails,
    route?.routeMasters,
    route?.masterDetails,
    route?.masters,
  ];
  return candidates.find(Array.isArray) ?? [];
};

const getImages = (value: any): string[] => {
  const source = value?.master ?? value;
  const candidates = [
    value?.imageUrls,
    source?.images,
    source?.Images,
    source?.imageUrl1,
    source?.ImageUrl1,
    source?.image1,
    source?.Image1,
    source?.imageUrl2,
    source?.ImageUrl2,
    source?.image2,
    source?.Image2,
  ].flatMap(item => (Array.isArray(item) ? item : [item]));
  return Array.from(
    new Set(
      candidates
        .map(item =>
          typeof item === 'object'
            ? asText(item?.uri ?? item?.url ?? item?.imageUrl)
            : asText(item),
        )
        .filter(item => /^(https?:|file:|content:|data:image)/i.test(item)),
    ),
  ).slice(0, 2);
};

const normalizeMaster = (
  item: any,
  index: number,
  defaultFiber: string,
): RouteMaster => {
  const source = item?.master ?? item;
  const masterType = asText(
    item?.masterType ??
      item?.MasterType ??
      source?.__masterType ??
      source?.masterType ??
      source?.MasterType ??
      source?.type,
  ).toLowerCase();
  const meta = MASTER_META[masterType] ?? {
    label:
      asText(item?.masterTypeLabel ?? source?.__masterTypeLabel) || 'Master',
    icon: IMAGES.module,
  };
  const coordinate = getCoordinate(item) ?? getCoordinate(source);
  const masterId = asText(
    item?.masterId ??
      item?.MasterId ??
      source?.id ??
      source?.Id ??
      source?.masterId,
  );
  const address =
    asText(
      item?.address ??
        item?.Address ??
        source?.address ??
        source?.Address ??
        source?.selectedAddress,
    ) || 'Address unavailable';
  const name =
    asText(
      item?.name ??
        source?.name ??
        source?.Name ??
        source?.masterName ??
        source?.MasterName,
    ) || meta.label;
  const latLngText = coordinate
    ? `${coordinate.latitude}, ${coordinate.longitude}`
    : 'Location unavailable';
  const distance = Number(
    item?.distance ?? item?.Distance ?? source?.distance ?? 0,
  );

  return {
    key: asText(item?.key) || `${masterType || 'master'}-${masterId || index}`,
    raw: {
      ...source,
      masterType,
      masterId,
      name,
      address,
      latLng: coordinate
        ? `${coordinate.latitude}, ${coordinate.longitude}`
        : '',
    },
    masterId,
    masterType,
    masterTypeLabel: meta.label,
    name,
    address,
    latLngText,
    coordinate,
    distance: Number.isFinite(distance) ? distance : 0,
    fiberLabel:
      asText(
        item?.fiberTypeName ?? item?.fiberIdStr ?? source?.fiberTypeName,
      ) || defaultFiber,
    active: readField(source, 'isActive', 'IsActive', 'status') !== false,
    images: getImages(item),
    icon: item?.icon ?? meta.icon,
    loopMeters: asText(item?.loopMeters),
  };
};

const buildFallbackMasters = (route: any, defaultFiber: string) => {
  const start = parseCoordinateText(route?.startLatLng);
  const end = parseCoordinateText(route?.endLatLng);
  const startAddress = asText(route?.startAddress);
  const endAddress = asText(route?.endAddress);
  const startName =
    asText(
      route?.startMasterName ?? route?.StartMasterName ?? route?.fromMasterName,
    ) ||
    startAddress.split(',')[0]?.trim() ||
    'Route Start';
  const endName =
    asText(
      route?.endMasterName ?? route?.EndMasterName ?? route?.toMasterName,
    ) ||
    endAddress.split(',')[0]?.trim() ||
    'Route End';
  const values = [
    start
      ? {
          key: 'route-start',
          masterType: asText(
            route?.startMasterType ??
              route?.StartMasterType ??
              route?.fromMasterType ??
              'master',
          ),
          masterId:
            route?.startMasterId ?? route?.StartMasterId ?? route?.fromMasterId,
          name: startName,
          address: startAddress,
          latLng: route?.startLatLng,
          distance: 0,
        }
      : null,
    end
      ? {
          key: 'route-end',
          masterType: asText(
            route?.endMasterType ??
              route?.EndMasterType ??
              route?.toMasterType ??
              'master',
          ),
          masterId:
            route?.endMasterId ?? route?.EndMasterId ?? route?.toMasterId,
          name: endName,
          address: endAddress,
          latLng: route?.endLatLng,
          distance: Number(route?.totalDistance) || 0,
        }
      : null,
  ].filter(Boolean);
  return values.map((item, index) =>
    normalizeMaster(item, index, defaultFiber),
  );
};

const getServerFibers = (route: any): StoredRouteFiberSelection[] => {
  const candidates = [
    route?.fiberDetails,
    route?.routeFiberDetails,
    route?.fibers,
    route?.fiberTypes,
  ];
  const list = candidates.find(Array.isArray) ?? [];
  const normalized = list.map((item: any, index: number) => ({
    id: `server-fiber-${index}-${asText(item?.id ?? item?.fiberTypeId)}`,
    fiberId: asText(item?.fiberTypeId ?? item?.id),
    fiberLabel:
      asText(item?.fiberLabel ?? item?.fiberIdStr ?? item?.fiberTypeName) ||
      'Fiber',
    armourLabel: asText(item?.armourLabel ?? item?.fiberSpecificationName),
    tubeCount: asText(item?.tubeCount ?? item?.noOfTubes),
    coreCount: asText(item?.coreCount ?? item?.noOfCores),
    drumId: asText(item?.drumId),
    drumLabel: asText(item?.drumNo),
    drumLength: Number(item?.drumLength) || 0,
    lengthToUse: Number(item?.lengthToUse) || 0,
    addedAt: 0,
  }));
  if (normalized.length > 0) {
    return normalized;
  }
  const scalarFiber = asText(
    route?.fiberIdStr ?? route?.fiberTypeName ?? route?.fiberType,
  );
  return scalarFiber
    ? [
        {
          id: 'server-fiber-current',
          fiberId: asText(route?.fiberTypeId),
          fiberLabel: scalarFiber,
          armourLabel: asText(route?.fiberSpecificationName),
          tubeCount: asText(route?.noOfTubes),
          coreCount: asText(route?.noOfCores),
          drumId: asText(route?.drumId),
          drumLabel: asText(route?.drumNo),
          drumLength: Number(route?.drumLength) || 0,
          lengthToUse: Number(route?.lengthToUse) || 0,
          addedAt: 0,
        },
      ]
    : [];
};

const FiberChangeScreen: FC<Props> = ({navigation, route}) => {
  const selectedRoute = route.params.selectedRoute;
  const selectedFibers = useMemo(
    () => route.params.selectedFibers ?? [],
    [route.params.selectedFibers],
  );
  const scrollRef = useRef<ScrollView>(null);
  const masterYRef = useRef<Record<string, number>>({});
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(
    null,
  );
  const [isLocating, setIsLocating] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const completedRoute = useMemo(
    () => getCompletedAppRoute(selectedRoute.routeId, selectedRoute.routeName),
    [selectedRoute.routeId, selectedRoute.routeName],
  );
  const allFibers = useMemo(() => {
    const combined = [...getServerFibers(selectedRoute), ...selectedFibers];
    return combined.filter(
      (fiber, index, values) =>
        values.findIndex(item => item.id === fiber.id) === index,
    );
  }, [selectedFibers, selectedRoute]);
  const latestFiber = selectedFibers[selectedFibers.length - 1] ?? null;
  const defaultFiber =
    latestFiber?.fiberLabel ?? allFibers[0]?.fiberLabel ?? '--';
  const masters = useMemo(() => {
    const storedMasters = completedRoute?.routePoints ?? [];
    const serverMasters = getMasterArrays(selectedRoute);
    const source = storedMasters.length > 0 ? storedMasters : serverMasters;
    if (source.length > 0) {
      return source.map((item, index) =>
        normalizeMaster(item, index, defaultFiber),
      );
    }
    return buildFallbackMasters(selectedRoute, defaultFiber);
  }, [completedRoute?.routePoints, defaultFiber, selectedRoute]);

  const nearestMasterIndex = useMemo(() => {
    if (!currentPosition) {
      return -1;
    }
    let index = -1;
    let minimum = Number.POSITIVE_INFINITY;
    masters.forEach((master, masterIndex) => {
      if (!master.coordinate) {
        return;
      }
      const distance = distanceBetween(currentPosition, master.coordinate);
      if (distance < minimum) {
        minimum = distance;
        index = masterIndex;
      }
    });
    return index;
  }, [currentPosition, masters]);

  const showCurrentLocation = async () => {
    if (isLocating) {
      return;
    }
    try {
      setIsLocating(true);
      if (Platform.OS === 'android' && !(await Location.checkGps())) {
        throw new Error('Location services are disabled.');
      }
      const position = await new Promise<Coordinate>((resolve, reject) => {
        let failures = 0;
        let resolved = false;
        const onSuccess = (value: Coordinate) => {
          if (!resolved) {
            resolved = true;
            resolve(value);
          }
        };
        const onFailure = (error: unknown) => {
          failures += 1;
          if (failures === 2 && !resolved) {
            reject(error);
          }
        };
        requestCurrentPosition(false, 8000, 60000).then(onSuccess, onFailure);
        requestCurrentPosition(true, 20000, 0).then(onSuccess, onFailure);
      });
      setCurrentPosition(position);
      let nearestIndex = -1;
      let minimum = Number.POSITIVE_INFINITY;
      masters.forEach((master, index) => {
        if (!master.coordinate) {
          return;
        }
        const distance = distanceBetween(position, master.coordinate);
        if (distance < minimum) {
          minimum = distance;
          nearestIndex = index;
        }
      });
      const nearest = masters[nearestIndex];
      if (nearest) {
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, (masterYRef.current[nearest.key] ?? 0) - 150),
            animated: true,
          });
        }, 160);
      }
    } catch (error: any) {
      Alert.alert(
        'Current Location',
        error?.message || 'Unable to get your current location.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  const openMap = (master: RouteMaster) => {
    if (!master.coordinate) {
      Alert.alert('Google Maps', 'Location is unavailable for this master.');
      return;
    }
    Linking.openURL(
      `https://maps.google.com/?q=${master.coordinate.latitude},${master.coordinate.longitude}`,
    ).catch(() => Alert.alert('Google Maps', 'Unable to open Google Maps.'));
  };

  const openRoutePage = () => {
    if (masters.length === 0) {
      return;
    }
    const firstCoordinate =
      masters.find(item => item.coordinate)?.coordinate ??
      parseCoordinateText(selectedRoute.startLatLng);
    if (!firstCoordinate) {
      Alert.alert('Route Details', 'Route coordinates are unavailable.');
      return;
    }
    const routePoints = masters.map(master => ({
      key: master.key,
      master: master.raw,
      masterId: master.masterId,
      masterType: master.masterType,
      masterTypeLabel: master.masterTypeLabel,
      name: master.name,
      address: master.address,
      coordinate: master.coordinate,
      loopMeters: master.loopMeters,
      isLocked: true,
    }));
    const routePath = completedRoute?.routePath?.length
      ? completedRoute.routePath
      : masters
          .map(item => item.coordinate)
          .filter((item): item is Coordinate => item !== null);
    const walkingSegments = completedRoute?.walkingSegments?.length
      ? completedRoute.walkingSegments
      : masters.slice(1).map((master, index) => ({
          id: `view-segment-${index}`,
          afterPointKey: master.key,
          distance: master.distance,
        }));
    const now = Date.now();
    navigation.navigate('Make-Route', {
      routeName: asText(selectedRoute.routeName) || 'Route Details',
      routeDraft: {
        fiberTypeId: latestFiber?.fiberId,
        fiberTypeLabel: latestFiber?.fiberLabel,
      },
      currentPosition: firstCoordinate,
      currentAddress:
        completedRoute?.currentAddress ||
        asText(selectedRoute.startAddress) ||
        'Route location',
      selectedMaster: masters[0].raw,
      selectedMasterVersion: `view-${selectedRoute.routeId}-${now}`,
      readOnly: true,
      resumeSnapshot: {
        id: `completed-view-${selectedRoute.routeId}`,
        routeName: asText(selectedRoute.routeName) || 'Route Details',
        routeDraft: {},
        currentPosition: firstCoordinate,
        currentAddress:
          completedRoute?.currentAddress ||
          asText(selectedRoute.startAddress) ||
          'Route location',
        routePoints,
        routePath,
        walkingSegments,
        segmentDistance: 0,
        trackingState: 'idle',
        drumAllocations: [],
        totalDistance:
          completedRoute?.totalDistance ||
          Number(selectedRoute.totalDistance) ||
          0,
        status: 'stopped',
        createdAt: completedRoute?.createdAt ?? now,
        updatedAt: completedRoute?.updatedAt ?? now,
      },
    });
  };

  return (
    <Screen
      preset="fixed"
      statusBgColor={COLORS.PRIMARY}
      navBarColor={COLORS.WHITE}>
      <View style={styles.screen}>
        <BackHeader
          title="Fiber Change"
          showGps={false}
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.routeHeader}>
            <Text numberOfLines={1} style={styles.routeName}>
              {asText(selectedRoute.routeName) || 'Unnamed Route'}
            </Text>
            <Text style={styles.routeId}>
              Route#
              {asText(selectedRoute.routeIdStr).replace(/^route/i, '') ||
                selectedRoute.routeId}
            </Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>Active</Text>
            </View>
            <TouchableOpacity
              onPress={() => openMap(masters[masters.length - 1] ?? masters[0])}
              style={styles.headerMapButton}>
              <GoogleMapsIconSvg width={SIZE.MS(27)} height={SIZE.MS(27)} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>
            Current Fiber Types Installed:
          </Text>
          {allFibers.length === 0 ? (
            <View style={styles.emptyFiberCard}>
              <Text style={styles.emptyFiberTitle}>No fiber added yet</Text>
              <Text style={styles.emptyFiberText}>
                Go back and tap the route card to add its first fiber.
              </Text>
            </View>
          ) : null}
          {allFibers.map((fiber, index) => (
            <View key={fiber.id || `fiber-${index}`} style={styles.fiberCard}>
              <View style={styles.fiberLine}>
                <Text style={styles.fiberMeta}>
                  Fiber Type:{' '}
                  <Text style={styles.valueText}>{fiber.fiberLabel}</Text>
                </Text>
                <Text style={styles.fiberMeta}>
                  Cable Length:{' '}
                  <Text style={styles.valueText}>
                    {fiber.lengthToUse || fiber.drumLength || 0}m
                  </Text>
                </Text>
                <Text style={styles.fiberMeta}>
                  Masters:{' '}
                  <Text style={styles.valueText}>{masters.length}</Text>
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.fiberAddress}>
                From: {asText(selectedRoute.startAddress) || 'Unavailable'}
              </Text>
              <Text numberOfLines={1} style={styles.fiberAddress}>
                To: {asText(selectedRoute.endAddress) || 'Unavailable'}
              </Text>
              <Text style={styles.fiberSpecification}>
                {fiber.armourLabel || 'Cable specification unavailable'}
                {fiber.drumLabel ? ` • Drum ${fiber.drumLabel}` : ''}
              </Text>
            </View>
          ))}

          <View style={styles.selectedFiberBar}>
            <Text style={styles.selectedFiberLabel}>Fiber added: </Text>
            <Text numberOfLines={1} style={styles.selectedFiberValue}>
              {latestFiber
                ? `${latestFiber.fiberLabel}, ${latestFiber.armourLabel}`
                : '--'}
            </Text>
          </View>

          <View style={styles.masterTimeline}>
            <View style={styles.timelineLine} />
            {masters.map((master, index) => {
              const showPointer =
                Boolean(currentPosition) && index === nearestMasterIndex;
              return (
                <View
                  key={master.key}
                  onLayout={event => {
                    masterYRef.current[master.key] = event.nativeEvent.layout.y;
                  }}
                  style={styles.masterRow}>
                  {showPointer ? (
                    <View style={styles.currentLocationMarker}>
                      <PointerSvg width={SIZE.MS(25)} height={SIZE.MS(25)} />
                    </View>
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={openRoutePage}
                    style={styles.masterCard}>
                    <View style={styles.masterTitleRow}>
                      <Text numberOfLines={1} style={styles.masterName}>
                        {master.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.masterId}>
                        {master.masterTypeLabel}#{master.masterId || 'ID'}
                      </Text>
                      <View
                        style={[
                          styles.masterStatus,
                          !master.active && styles.inactiveBadge,
                        ]}>
                        <Text style={styles.masterStatusText}>
                          {master.active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    <Text numberOfLines={2} style={styles.masterAddress}>
                      <Text style={styles.boldText}>Address: </Text>
                      {master.address}
                    </Text>
                    <Text numberOfLines={1} style={styles.masterLatLng}>
                      <Text style={styles.boldText}>Lat/Lng: </Text>
                      {master.latLngText}
                    </Text>
                    <View style={styles.masterFooter}>
                      <Text style={styles.masterMeta}>
                        Distance:{' '}
                        <Text style={styles.valueText}>
                          {Math.round(master.distance)}m
                        </Text>
                      </Text>
                      <Text style={styles.masterMeta}>
                        Fiber Type:{' '}
                        <Text style={styles.valueText}>
                          {master.fiberLabel}
                        </Text>
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={event => {
                          event.stopPropagation();
                          if (master.images.length === 0) {
                            Alert.alert(
                              'View Images',
                              'No images are available for this master.',
                            );
                            return;
                          }
                          setPreviewImages(master.images);
                          setPreviewIndex(0);
                        }}
                        style={styles.imageButton}>
                        <Text style={styles.imageButtonText}>View Images</Text>
                        <Image
                          source={IMAGES.camera}
                          style={styles.cameraIcon}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={event => {
                          event.stopPropagation();
                          openMap(master);
                        }}
                        style={styles.mapButton}>
                        <GoogleMapsIconSvg
                          width={SIZE.MS(24)}
                          height={SIZE.MS(24)}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.86}
          disabled={isLocating || masters.length === 0}
          onPress={showCurrentLocation}
          style={styles.whereTouchable}>
          <LinearGradient
            colors={['#8B59F8', '#6036C4']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.whereButton}>
            <Text style={styles.whereText}>
              {isLocating ? 'Locating...' : 'Where I am?'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Modal
          visible={previewImages.length > 0}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setPreviewImages([])}>
          <Pressable
            onPress={() => setPreviewImages([])}
            style={styles.previewOverlay}>
            <Pressable style={styles.previewCard}>
              <Image
                source={{uri: previewImages[previewIndex]}}
                style={styles.previewImage}
              />
              <View style={styles.previewActions}>
                {previewImages.map((_, index) => (
                  <TouchableOpacity
                    key={`preview-${index}`}
                    onPress={() => setPreviewIndex(index)}
                    style={[
                      styles.previewDot,
                      previewIndex === index && styles.previewDotActive,
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity
                onPress={() => setPreviewImages([])}
                style={styles.previewClose}>
                <Text style={styles.previewCloseText}>×</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </Screen>
  );
};

export default FiberChangeScreen;
