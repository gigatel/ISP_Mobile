import React, {FC, useCallback, useMemo, useRef, useState} from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Geolocation from '@react-native-community/geolocation';
import LinearGradient from 'react-native-linear-gradient';
import type {RootStackParamList} from '@navigation/navigator';
import {BackHeader} from '@molecules';
import {Screen} from '@organisms';
import {COLORS, IMAGES, SIZE} from '@res';
import {
  getPausedRouteSnapshots,
  PausedRouteCoordinate,
  PausedRouteSnapshot,
} from '../../services/pausedRouteStorage';
import {Location} from '@utils';
import PointerSvg from '../../res/images/pointer.svg';
import GoogleMapsIconSvg from '../../res/images/Google_Maps_icon.svg';
import styles from './styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Select-Paused-Route'>;

type PausedRouteListRow = {
  type: 'route';
  key: string;
  route: PausedRouteSnapshot;
  isNearest: boolean;
};

type CurrentPositionFix = PausedRouteCoordinate & {
  accuracy: number;
};

const asText = (value: unknown) => String(value ?? '').trim();

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceBetween = (
  from: PausedRouteCoordinate,
  to: PausedRouteCoordinate,
) => {
  const radius = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const statusLabel = (route: PausedRouteSnapshot) => {
  if (route.status === 'unsaved') {
    return 'Unsaved';
  }
  if (route.status === 'stopped') {
    return 'Stopped';
  }
  return 'Paused';
};

const getCurrentPosition = ({
  enableHighAccuracy,
  timeout,
  maximumAge,
}: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}) =>
  new Promise<CurrentPositionFix>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number(position.coords.accuracy) || Number.MAX_VALUE,
        });
      },
      reject,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
    );
  });

const isValidPosition = (position: PausedRouteCoordinate) =>
  Number.isFinite(position.latitude) &&
  Number.isFinite(position.longitude) &&
  Math.abs(position.latitude) <= 90 &&
  Math.abs(position.longitude) <= 180;

const SelectPausedRouteScreen: FC<Props> = ({navigation}) => {
  const listRef = useRef<FlatList<PausedRouteListRow>>(null);
  const locationRequestRef = useRef(0);
  const [routes, setRoutes] = useState<PausedRouteSnapshot[]>([]);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(200);
  const [currentPosition, setCurrentPosition] =
    useState<PausedRouteCoordinate | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const loadRoutes = useCallback(() => {
    setRoutes(getPausedRouteSnapshots());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRoutes();

      return () => {
        locationRequestRef.current += 1;
      };
    }, [loadRoutes]),
  );

  const filteredRoutes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return routes;
    }

    return routes.filter(route => {
      const firstPoint = route.routePoints[0];
      const lastPoint = route.routePoints[route.routePoints.length - 1];
      return [
        route.routeName,
        firstPoint?.address,
        lastPoint?.address,
        route.currentAddress,
        route.routeDraft?.fiberTypeName,
        route.routeDraft?.fibreSpecification,
      ].some(value => asText(value).toLowerCase().includes(normalized));
    });
  }, [query, routes]);

  const nearestRouteIndex = useMemo(() => {
    if (!currentPosition || filteredRoutes.length === 0) {
      return -1;
    }

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    filteredRoutes.forEach((route, index) => {
      const routeDistance = distanceBetween(
        currentPosition,
        route.currentPosition,
      );
      if (routeDistance < closestDistance) {
        closestDistance = routeDistance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }, [currentPosition, filteredRoutes]);

  const listRows = useMemo<PausedRouteListRow[]>(() => {
    return filteredRoutes.map((route, index) => ({
      type: 'route',
      key: `route-${route.id}`,
      route,
      isNearest: Boolean(currentPosition && index === nearestRouteIndex),
    }));
  }, [currentPosition, filteredRoutes, nearestRouteIndex]);

  const resumeRoute = (snapshot: PausedRouteSnapshot) => {
    const selectedPoint =
      snapshot.routePoints[snapshot.routePoints.length - 1] ??
      snapshot.routePoints[0];

    navigation.navigate('Make-Route', {
      routeName: snapshot.routeName,
      routeDraft: snapshot.routeDraft,
      currentPosition: snapshot.currentPosition,
      currentAddress: snapshot.currentAddress,
      selectedMaster: selectedPoint?.master ?? selectedPoint,
      selectedMasterVersion:
        selectedPoint?.key ?? `resume-${snapshot.id}-${Date.now()}`,
      resumeSnapshot: snapshot,
    });
  };

  const openRouteMap = (snapshot: PausedRouteSnapshot) => {
    const {latitude, longitude} = snapshot.currentPosition;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Google Maps', 'Unable to open this route location.');
    });
  };

  const showCurrentLocation = async () => {
    if (isLocating) {
      return;
    }

    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;

    try {
      setIsLocating(true);

      if (Platform.OS === 'android') {
        const isGpsEnabled = await Location.checkGps();
        if (!isGpsEnabled) {
          throw new Error('Location services are disabled.');
        }
      }

      let bestAccuracy = Number.POSITIVE_INFINITY;
      let hasPosition = false;

      await new Promise<void>((resolve, reject) => {
        let failedRequests = 0;

        const handleFailure = (error: unknown) => {
          failedRequests += 1;
          if (failedRequests === 2 && !hasPosition) {
            reject(error);
          }
        };

        const showPosition = (fix: CurrentPositionFix) => {
          if (locationRequestRef.current !== requestId) {
            resolve();
            return;
          }

          if (!isValidPosition(fix)) {
            handleFailure(
              new Error('The device returned an invalid location.'),
            );
            return;
          }

          const isFirstPosition = !hasPosition;
          if (!isFirstPosition && fix.accuracy >= bestAccuracy) {
            return;
          }

          hasPosition = true;
          bestAccuracy = fix.accuracy;
          const position = {
            latitude: fix.latitude,
            longitude: fix.longitude,
          };
          setCurrentPosition(position);

          let closestIndex = -1;
          let closestDistance = Number.POSITIVE_INFINITY;
          filteredRoutes.forEach((route, index) => {
            const routeDistance = distanceBetween(
              position,
              route.currentPosition,
            );
            if (routeDistance < closestDistance) {
              closestDistance = routeDistance;
              closestIndex = index;
            }
          });

          if (closestIndex >= 0) {
            requestAnimationFrame(() => {
              listRef.current?.scrollToIndex({
                index: closestIndex,
                animated: true,
                viewPosition: 0.45,
              });
            });
          }

          if (isFirstPosition) {
            resolve();
          }
        };

        getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000,
        }).then(showPosition, handleFailure);

        getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }).then(showPosition, handleFailure);
      });
    } catch (error: any) {
      Alert.alert(
        'Current Location',
        error?.message ||
          'Unable to get your current location. Check GPS and location permission, then try again.',
      );
    } finally {
      if (locationRequestRef.current === requestId) {
        setIsLocating(false);
      }
    }
  };

  const renderRouteCard = (
    route: PausedRouteSnapshot,
    isCurrentLocationRoute: boolean,
  ) => {
    const firstPoint = route.routePoints[0];
    const lastPoint = route.routePoints[route.routePoints.length - 1];
    const routeId =
      asText(route.routeDraft?.routeIdStr ?? route.routeDraft?.routeId) ||
      route.id.slice(-8).toUpperCase();
    const fiberType =
      asText(route.routeDraft?.fiberTypeName) ||
      asText(route.routeDraft?.fibreSpecification) ||
      '--';

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={`Resume ${route.routeName}`}
        accessibilityState={{selected: isCurrentLocationRoute}}
        onPress={() => resumeRoute(route)}
        style={[
          styles.routeCard,
          isCurrentLocationRoute && styles.currentRouteCard,
        ]}>
        <View style={styles.cardTitleRow}>
          <Text numberOfLines={1} style={styles.routeName}>
            {route.routeName}
          </Text>
          <Text numberOfLines={1} style={styles.routeId}>
            Route#{routeId}
          </Text>
          <View
            style={[
              styles.statusBadge,
              route.status === 'unsaved' && styles.unsavedBadge,
              route.status === 'stopped' && styles.stoppedBadge,
            ]}>
            <Text style={styles.statusText}>{statusLabel(route)}</Text>
          </View>
        </View>

        <Text numberOfLines={2} style={styles.addressText}>
          <Text style={styles.addressLabel}>From: </Text>
          {firstPoint?.address || route.currentAddress || 'Address unavailable'}
        </Text>
        <Text numberOfLines={2} style={styles.addressText}>
          <Text style={styles.addressLabel}>To: </Text>
          {lastPoint?.address || route.currentAddress || 'Address unavailable'}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.metaText}>
            Total Distance:{' '}
            <Text style={styles.metaValue}>
              {Math.round(route.totalDistance)} meters
            </Text>
          </Text>
          <Text numberOfLines={1} style={styles.fiberText}>
            Fiber Type: <Text style={styles.metaValue}>{fiberType}</Text>
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Open ${route.routeName} in Google Maps`}
            onPress={() => openRouteMap(route)}
            style={styles.mapButton}>
            <GoogleMapsIconSvg width={SIZE.MS(28)} height={SIZE.MS(28)} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListRow = ({item}: {item: PausedRouteListRow}) => {
    return (
      <View style={styles.routeCardRow}>
        {item.isNearest ? (
          <View
            accessibilityLabel="Your exact current location"
            style={styles.currentLocationMarker}>
            <PointerSvg width={SIZE.MS(25)} height={SIZE.MS(25)} />
          </View>
        ) : null}
        {renderRouteCard(item.route, item.isNearest)}
      </View>
    );
  };

  return (
    <Screen
      preset="fixed"
      statusBgColor={COLORS.PRIMARY}
      navBarColor={COLORS.WHITE}>
      <View style={styles.screen}>
        <BackHeader
          title="Select Paused Route"
          onBackPress={() => navigation.goBack()}
        />

        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Image source={IMAGES.search} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#858B95"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setQuery('')}
                style={styles.clearButton}>
                <Image source={IMAGES.close} style={styles.clearIcon} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.rangeControl}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setRange(value => Math.max(50, value - 50))}
              style={styles.rangeButton}>
              <Text style={styles.rangeButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.rangeText}>{range}m</Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setRange(value => Math.min(1000, value + 50))}
              style={styles.rangeButton}>
              <Text style={styles.rangeButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.listArea}>
          <View style={styles.timeline} />

          <FlatList
            ref={listRef}
            data={listRows}
            keyExtractor={item => item.key}
            renderItem={renderListRow}
            contentContainerStyle={[
              styles.listContent,
              filteredRoutes.length === 0 && styles.emptyListContent,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={({averageItemLength, index}) => {
              listRef.current?.scrollToOffset({
                offset: averageItemLength * index,
                animated: true,
              });
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No paused routes</Text>
                <Text style={styles.emptyText}>
                  Routes you start, pause, or leave unfinished will appear here
                  automatically.
                </Text>
              </View>
            }
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          disabled={isLocating}
          onPress={showCurrentLocation}
          style={[
            styles.whereButtonTouchable,
            isLocating && styles.whereButtonDisabled,
          ]}>
          <LinearGradient
            colors={['#8B59F8', '#6036C4']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.whereButton}>
            <Text style={styles.whereButtonText}>
              {isLocating ? 'Locating...' : 'Where I am?'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

export default SelectPausedRouteScreen;
