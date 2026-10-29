import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {PERMISSIONS, request, RESULTS} from 'react-native-permissions';
import {getGeoLocation} from '../../utils/location';
import {
  distanceLabel,
  getNearbyCustomerSplitters,
  hasSplitterCoordinate,
  powerLabel,
  splitterTitle,
  splitterRatio,
} from '../../services/lastMileConnectivityService';
import type {SplitterCoordinate} from '../../services/lastMileConnectivityService';
import type {Splitter} from './types';
import {
  getDistinctCustomerMapLines,
  loadSplitterCustomerLinks,
} from '../../services/splitterCustomerMap';
import type {
  SplitterCustomerLink,
  SplitterMapConnectionSummary,
} from '../../services/splitterCustomerMap';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle, Path} from 'react-native-svg';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {Screen} from '@organisms';
import {FONTS, IMAGES} from '@res';
import type {RootStackParamList} from '@navigation/navigator';
import PointerSvg from '../../res/images/pointer.svg';
import SplitterIcon from './SplitterIcon';
import SplitterMapDetails from './SplitterMapDetails';
import CustomerMapDetails from './CustomerMapDetails';
import {
  getNumberedSplitterMarkers,
  getSplitterListHeight,
  getSplitterMapRegion,
} from './layout';

const GRADIENT = ['#8858F9', '#6036C4'];

function CustomerMapIcon() {
  return (
    <Svg width={32} height={40} viewBox="0 0 32 40" fill="none">
      <Path
        d="M16 38C13 34 2 23 2 16a14 14 0 1 1 28 0c0 7-11 18-14 22Z"
        fill="#168D70"
        stroke="#FFFFFF"
        strokeWidth={2}
      />
      <Circle cx={16} cy={11} r={4} fill="#FFFFFF" />
      <Path d="M8 25v-2a8 8 0 0 1 16 0v2H8Z" fill="#FFFFFF" />
    </Svg>
  );
}

export default function LastMileConnectivityScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'LastMileConnectivity'>) {
  const insets = useSafeAreaInsets();
  const {width, height, fontScale} = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  const splitterListRef = useRef<ScrollView>(null);
  const [nearestSplitterId, setNearestSplitterId] = useState<string | null>(
    null,
  );
  const [mapFocus, setMapFocus] = useState<'all' | 'location'>('all');
  const expandedMapRef = useRef<MapView | null>(null);
  const [range, setRange] = useState(200);
  const [expanded, setExpanded] = useState(false);
  const [splitters, setSplitters] = useState<Splitter[]>([]);
  const [position, setPosition] = useState<SplitterCoordinate | null>(null);
  const positionRef = useRef<SplitterCoordinate | null>(null);
  const requestId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  const linkRequestId = useRef(0);
  const [customerLinks, setCustomerLinks] = useState<SplitterCustomerLink[]>(
    [],
  );
  const [connectionStats, setConnectionStats] = useState<
    Record<string, SplitterMapConnectionSummary>
  >({});
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksFailed, setLinksFailed] = useState(false);
  const [missingCoordinates, setMissingCoordinates] = useState(0);
  const loadConnections = useCallback(async (items: Splitter[]) => {
    const id = ++linkRequestId.current;
    setCustomerLinks([]);
    setConnectionStats({});
    setLinksLoading(items.length > 0);
    setLinksFailed(false);
    setMissingCoordinates(0);
    const result = await loadSplitterCustomerLinks(
      items,
      () => id === linkRequestId.current,
    );
    if (id !== linkRequestId.current) {
      return;
    }
    setCustomerLinks(result.links);
    setConnectionStats(result.connectionsBySplitter);
    setMissingCoordinates(result.missingCoordinates);
    setLinksFailed(result.failedSplitterIds.length > 0);
    setLinksLoading(false);
  }, []);
  const customerCoordinates = customerLinks.map(link => link.coordinates[1]);
  const customerMapLines = getDistinctCustomerMapLines(customerLinks);

  const loadSplitters = useCallback(
    async (freshLocation = false) => {
      const id = ++requestId.current;
      linkRequestId.current += 1;
      setCustomerLinks([]);
      setConnectionStats({});
      setLinksLoading(false);
      setLinksFailed(false);
      setMissingCoordinates(0);
      setLoading(true);
      setError('');
      setSelectedMarker(null);
      setNearestSplitterId(null);
      try {
        let coordinate = positionRef.current;
        if (freshLocation || !coordinate) {
          setLocating(true);
          const permission = await request(
            Platform.OS === 'ios'
              ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
              : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
          );
          if (id !== requestId.current) {
            return;
          }
          if (
            permission !== RESULTS.GRANTED &&
            permission !== RESULTS.LIMITED
          ) {
            throw new Error('Allow location access to find nearby splitters.');
          }
          const fix = await getGeoLocation(true);
          if (id !== requestId.current) {
            return;
          }
          coordinate = {
            latitude: fix.coords.latitude,
            longitude: fix.coords.longitude,
          };
          positionRef.current = coordinate;
          setPosition(coordinate);
          setLocating(false);
        }
        const nearby = await getNearbyCustomerSplitters(range, coordinate);
        if (id !== requestId.current) {
          return;
        }
        setSplitters(nearby);
        setNearestSplitterId(
          nearby.find(splitter => splitter.distance !== null)?.id ?? null,
        );
        if (freshLocation) {
          splitterListRef.current?.scrollTo({y: 0, animated: true});
          mainScrollRef.current?.scrollTo({y: 0, animated: true});
        }
        loadConnections(nearby);
      } catch (failure: any) {
        if (id === requestId.current) {
          setSplitters([]);
          setError(
            failure?.message ||
              'Could not load nearby splitters. Please retry.',
          );
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLocating(false);
        }
      }
    },
    [range, loadConnections],
  );

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        loadSplitters();
      }, 250);
      return () => {
        clearTimeout(timer);
        requestId.current += 1;
        linkRequestId.current += 1;
      };
    }, [loadSplitters]),
  );

  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const layoutKey = `${width}:${fontScale}`;
  const listHeight = getSplitterListHeight(splitters, cardHeights, layoutKey);
  const listReady = listHeight !== null;
  const [inlineMapReady, setInlineMapReady] = useState(false);
  const [expandedMapReady, setExpandedMapReady] = useState(false);
  const [inlineMapSize, setInlineMapSize] = useState({width: 0, height: 0});
  const [expandedMapSize, setExpandedMapSize] = useState({width: 0, height: 0});
  const attachInlineMap = useCallback((map: MapView | null) => {
    mapRef.current = map;
    setInlineMapReady(false);
  }, []);
  const attachExpandedMap = useCallback((map: MapView | null) => {
    expandedMapRef.current = map;
    setExpandedMapReady(false);
  }, []);
  const inlineRegion = position
    ? getSplitterMapRegion(
        position,
        splitters,
        range,
        inlineMapSize.width,
        inlineMapSize.height,
        mapFocus === 'location' ? [] : customerCoordinates,
      )
    : null;
  const expandedRegion = position
    ? getSplitterMapRegion(
        position,
        splitters,
        range,
        expandedMapSize.width,
        expandedMapSize.height,
        mapFocus === 'location' ? [] : customerCoordinates,
      )
    : null;
  const inlineRegionKey = inlineRegion ? JSON.stringify(inlineRegion) : '';
  const expandedRegionKey = expandedRegion
    ? JSON.stringify(expandedRegion)
    : '';

  useEffect(() => {
    if (
      (loading && mapFocus !== 'location') ||
      !listReady ||
      !inlineMapReady ||
      !inlineMapSize.width ||
      !inlineMapSize.height ||
      !inlineRegionKey
    ) {
      return;
    }
    mapRef.current?.animateToRegion(JSON.parse(inlineRegionKey), 0);
  }, [
    loading,
    listReady,
    inlineMapReady,
    inlineMapSize.width,
    inlineMapSize.height,
    inlineRegionKey,
    mapFocus,
  ]);
  useEffect(() => {
    if (
      !expanded ||
      (loading && mapFocus !== 'location') ||
      !listReady ||
      !expandedMapReady ||
      !expandedMapSize.width ||
      !expandedMapSize.height ||
      !expandedRegionKey
    ) {
      return;
    }
    expandedMapRef.current?.animateToRegion(JSON.parse(expandedRegionKey), 0);
  }, [
    expanded,
    loading,
    listReady,
    expandedMapReady,
    expandedMapSize.width,
    expandedMapSize.height,
    expandedRegionKey,
    mapFocus,
  ]);
  const compact = width < 380;
  const recenter = () => {
    setMapFocus('location');
    if (!expanded) {
      mainScrollRef.current?.scrollTo({y: 0, animated: true});
    }
    splitterListRef.current?.scrollTo({y: 0, animated: true});
    loadSplitters(true);
  };
  const toggleExpanded = (next: boolean) => {
    setSelectedMarker(null);
    setExpandedMapReady(false);
    setExpandedMapSize({width: 0, height: 0});
    setExpanded(next);
  };
  useEffect(() => {
    if (!selectedMarker || expanded) {
      return;
    }
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedMarker(null);
      return true;
    });
    return () => listener.remove();
  }, [selectedMarker, expanded]);

  const renderMarkerDetails = () => {
    const customerLink = customerLinks.find(
      link => `customer:${link.key}` === selectedMarker,
    );
    if (customerLink) {
      const items = [
        customerLink,
        ...customerLinks.filter(
          link =>
            link.key !== customerLink.key &&
            link.coordinates[1].latitude ===
              customerLink.coordinates[1].latitude &&
            link.coordinates[1].longitude ===
              customerLink.coordinates[1].longitude,
        ),
      ];
      return (
        <CustomerMapDetails
          key={`customer:${customerLink.key}`}
          items={items}
          maxHeight={height * 0.72}
          bottomInset={insets.bottom}
          onClose={() => setSelectedMarker(null)}
          onOpen={link => {
            setSelectedMarker(null);
            if (expanded) {
              toggleExpanded(false);
            }
            navigation.navigate('LastMileSplitterDetails', {
              splitter: link.splitter,
            });
          }}
        />
      );
    }
    const group = getNumberedSplitterMarkers(splitters).find(
      item => item.key === selectedMarker,
    );
    if (!group) {
      return null;
    }
    return (
      <SplitterMapDetails
        key={group.key}
        items={group.items}
        connectionStats={connectionStats}
        maxHeight={height * 0.72}
        bottomInset={insets.bottom}
        onClose={() => setSelectedMarker(null)}
        onOpen={splitter => {
          setSelectedMarker(null);
          if (expanded) {
            toggleExpanded(false);
          }
          navigation.navigate('LastMileSplitterDetails', {splitter});
        }}
      />
    );
  };

  const renderMap = (fullScreen: boolean) => (
    <View
      onLayout={({nativeEvent: {layout}}) => {
        const setSize = fullScreen ? setExpandedMapSize : setInlineMapSize;
        const border = fullScreen ? 0 : 10;
        const mapWidth = Math.max(1, layout.width - border);
        const mapHeight = Math.max(1, layout.height - border);
        setSize(previous =>
          previous.width === mapWidth && previous.height === mapHeight
            ? previous
            : {width: mapWidth, height: mapHeight},
        );
      }}
      style={
        fullScreen
          ? styles.expandedMap
          : [
              styles.mapCard,
              {height: Math.max(280, Math.min(width * 0.85, height * 0.48))},
            ]
      }>
      {position ? (
        <MapView
          ref={fullScreen ? attachExpandedMap : attachInlineMap}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={getSplitterMapRegion(
            position,
            splitters,
            range,
            fullScreen ? width : width - 38,
            fullScreen
              ? height
              : Math.max(280, Math.min(width * 0.85, height * 0.48)),
            mapFocus === 'location' ? [] : customerCoordinates,
          )}
          onMapReady={() =>
            (fullScreen ? setExpandedMapReady : setInlineMapReady)(true)
          }
          toolbarEnabled={false}
          showsMyLocationButton={false}>
          {customerMapLines.map(line => (
            <Polyline
              key={`customer-link:${line.key}`}
              coordinates={line.coordinates}
              strokeColor="#8050DF"
              strokeWidth={2}
              lineCap="round"
              lineJoin="round"
              geodesic={false}
              zIndex={1}
            />
          ))}
          {customerLinks.map(link => (
            <Marker
              key={`customer-avatar:${link.key}`}
              pinColor="#168D70"
              coordinate={link.coordinates[1]}
              accessibilityLabel={`Customer ${
                link.customer.name || 'Unnamed'
              }, splitter ${link.splitterNumber}, leg ${
                link.leg
              }. View details.`}
              zIndex={2}
              onPress={event => {
                event.stopPropagation();
                setSelectedMarker(`customer:${link.key}`);
              }}>
              <CustomerMapIcon />
            </Marker>
          ))}
          {getNumberedSplitterMarkers(splitters).map(group => (
            <Marker
              key={group.key}
              coordinate={group.coordinate}
              zIndex={3}
              onPress={() => setSelectedMarker(group.key)}>
              <View style={styles.mapPinGroup}>
                {group.items.map(({splitter, number}) => (
                  <View key={splitter.id} style={styles.mapPin}>
                    <SplitterIcon size={14} />
                    <Text style={styles.mapPinNumber}>{number}</Text>
                  </View>
                ))}
              </View>
            </Marker>
          ))}
          <Marker
            coordinate={position}
            title="You are here"
            accessibilityLabel="Your current GPS location"
            anchor={{x: 0.5, y: 0.5}}
            zIndex={5}>
            <View style={styles.currentLocationHalo}>
              <View style={styles.currentLocationDot} />
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.stateText}>
            Get your current location to view nearby splitters on the map.
          </Text>
        </View>
      )}
      <View style={styles.mapLinkSummary} pointerEvents="box-none">
        {mapFocus === 'location' && (
          <View style={styles.locationSummary}>
            <Text style={styles.locationText}>
              ● You are here · Nearby splitters
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Show all customer connections on map"
              onPress={() => setMapFocus('all')}>
              <Text style={styles.mapLinkRetry}>Show all connections</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.mapLinkText}>
          {linksLoading
            ? 'Loading customer connections…'
            : `${customerLinks.length} customer-to-splitter connections`}
        </Text>
        {missingCoordinates > 0 && (
          <Text style={styles.mapLinkText}>
            {missingCoordinates} connections have missing or invalid
            coordinates.
          </Text>
        )}
        {linksFailed && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry customer map connections"
            onPress={() => loadConnections(splitters)}>
            <Text style={styles.mapLinkRetry}>
              Some connections could not load. Tap to retry.
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={fullScreen ? 'Collapse map' : 'Expand map'}
        onPress={() => toggleExpanded(!fullScreen)}
        style={styles.expandButton}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d={
              fullScreen
                ? 'M9 3v6H3M15 3v6h6M3 15h6v6M21 15h-6v6'
                : 'M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6'
            }
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </Svg>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => (
    <View style={[styles.footer, {paddingBottom: Math.max(insets.bottom, 12)}]}>
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Where I am? Refresh current location and nearby splitters"
        disabled={loading}
        onPress={recenter}>
        <LinearGradient
          colors={GRADIENT}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.whereButton}>
          <Text style={styles.whereText}>
            {locating ? 'Locating…' : loading ? 'Loading…' : 'Where I am?'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <Screen
      preset="fixed"
      isSafeArea={false}
      isNavSafeArea={false}
      keyboardAvoidingEnabled={false}
      statusBgColor="#8858F9"
      statusBarStyle="light">
      <View style={styles.screen}>
        <LinearGradient
          colors={GRADIENT}
          style={[styles.header, {paddingTop: insets.top + 8}]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              style={styles.backButton}>
              <Image source={IMAGES.back} style={styles.backIcon} />
            </TouchableOpacity>
            <Text style={[styles.title, compact && styles.compactTitle]}>
              Last Mile Connectivity with Splitter
            </Text>
            <View style={styles.rangeControl}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Decrease range"
                accessibilityState={{disabled: range <= 100}}
                disabled={range <= 100}
                onPress={() => {
                  setMapFocus('all');
                  setRange(value => Math.max(100, value - 100));
                }}
                style={[styles.rangeButton, range <= 100 && styles.disabled]}>
                <Text style={styles.rangeSign}>−</Text>
              </TouchableOpacity>
              <Text style={styles.rangeText}>{range}m</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Increase range"
                accessibilityState={{disabled: range >= 1000}}
                disabled={range >= 1000}
                onPress={() => {
                  setMapFocus('all');
                  setRange(value => Math.min(1000, value + 100));
                }}
                style={[styles.rangeButton, range >= 1000 && styles.disabled]}>
                <Text style={styles.rangeSign}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
        <ScrollView
          ref={mainScrollRef}
          nestedScrollEnabled
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Near by Splitters :</Text>
          {loading && splitters.length === 0 ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color="#8858F9" />
              <Text style={styles.stateText}>
                {locating
                  ? 'Finding your current location…'
                  : 'Loading nearby splitters…'}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>{error}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  loadSplitters(!position);
                }}
                style={styles.retryButton}>
                <Text style={styles.whereText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : splitters.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>
                No splitters found within {range}m. Increase the range or
                refresh your location.
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.timeline} />
              <View
                style={styles.locationBadge}
                accessible
                accessibilityLabel="Person with location pin">
                <PointerSvg width={28} height={28} />
              </View>
              <ScrollView
                ref={splitterListRef}
                nestedScrollEnabled
                accessibilityLabel="Nearby splitters"
                style={[
                  styles.splitterList,
                  {height: listHeight ?? Math.min(4, splitters.length) * 140},
                ]}
                showsVerticalScrollIndicator
                contentContainerStyle={styles.list}>
                {splitters.map((splitter, index) => (
                  <TouchableOpacity
                    key={`${layoutKey}:${splitter.id}`}
                    style={[
                      styles.card,
                      splitter.id === nearestSplitterId && styles.nearestCard,
                    ]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Splitter ${index + 1}. View ${
                      splitter.name
                    } details${
                      splitter.id === nearestSplitterId
                        ? '. Nearest to your current location'
                        : ''
                    }`}
                    onPress={() =>
                      navigation.navigate('LastMileSplitterDetails', {splitter})
                    }
                    onLayout={event => {
                      if (index >= 4) {
                        return;
                      }
                      const cardHeight = event.nativeEvent.layout.height;
                      const key = `${layoutKey}:${splitter.id}`;
                      setCardHeights(previous =>
                        previous[key] === cardHeight
                          ? previous
                          : {...previous, [key]: cardHeight},
                      );
                    }}>
                    {splitter.id === nearestSplitterId && (
                      <Text style={styles.nearestBadge}>● Nearest to you</Text>
                    )}
                    <View style={styles.cardTop}>
                      <LinearGradient
                        colors={GRADIENT}
                        style={styles.splitterIcon}>
                        <Text style={styles.listNumber}>{index + 1}</Text>
                      </LinearGradient>
                      <Text style={styles.splitterName}>
                        {splitterTitle(splitter)}
                      </Text>
                      <Text style={styles.type}>
                        <Text style={styles.bold}>Type:</Text>{' '}
                        {splitterRatio(splitter)} | {splitter.free} Free
                      </Text>
                    </View>
                    <Text style={styles.details}>
                      <Text style={styles.bold}>Optical Power :</Text> In ={' '}
                      {powerLabel(splitter.opticalPowerIn)} | Out ={' '}
                      {powerLabel(splitter.opticalPowerOut)}
                    </Text>
                    <Text style={styles.details}>
                      <Text style={styles.bold}>Address :</Text>{' '}
                      {splitter.address || '—'}
                    </Text>
                    <View style={styles.cardBottom}>
                      <Text style={styles.details}>
                        <Text style={styles.bold}>Lat/Lng :</Text>{' '}
                        {hasSplitterCoordinate(splitter)
                          ? `${splitter.latitude}, ${splitter.longitude}`
                          : '—'}
                      </Text>
                      <Text style={styles.distanceRow}>
                        <Text style={styles.bold}>Distance: </Text>
                        <Text style={styles.distance}>
                          {distanceLabel(splitter.distance)}
                        </Text>
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {listReady && (!loading || splitters.length > 0) && renderMap(false)}
        </ScrollView>
        {renderFooter()}
        {!expanded && renderMarkerDetails()}
        <Modal
          visible={expanded}
          animationType="slide"
          onRequestClose={() =>
            selectedMarker ? setSelectedMarker(null) : toggleExpanded(false)
          }>
          <View style={[styles.screen, {paddingTop: insets.top}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nearby Splitters</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close expanded map"
                onPress={() => toggleExpanded(false)}
                style={styles.closeButton}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            {expanded && renderMap(true)}
            {renderFooter()}
            {renderMarkerDetails()}
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F4F7FA'},
  stateCard: {
    padding: 22,
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  stateText: {
    fontFamily: FONTS.REGULAR,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    color: '#727889',
  },
  retryButton: {
    backgroundColor: '#7947E8',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 7,
  },
  currentLocationHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,133,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationDot: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#0085FF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  locationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationText: {fontFamily: FONTS.BOLD, fontSize: 11, color: '#0075E6'},
  mapLinkSummary: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  mapLinkText: {fontFamily: FONTS.MEDIUM, fontSize: 10, color: '#51425F'},
  mapLinkRetry: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 10,
    color: '#0075E6',
    paddingVertical: 6,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#EBEDF4',
  },
  header: {paddingHorizontal: 8, paddingBottom: 12},
  headerRow: {flexDirection: 'row', alignItems: 'center', minHeight: 44},
  backButton: {width: 28, minHeight: 44, justifyContent: 'center'},
  backIcon: {
    width: 19,
    height: 19,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  title: {
    flex: 1,
    fontFamily: FONTS.MEDIUM,
    fontSize: 15,
    color: '#FFFFFF',
    paddingRight: 6,
  },
  compactTitle: {fontSize: 13},
  rangeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 4,
  },
  rangeButton: {
    width: 26,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#F0F1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeSign: {fontSize: 21, color: '#535763'},
  rangeText: {
    minWidth: 38,
    textAlign: 'center',
    fontFamily: FONTS.MEDIUM,
    fontSize: 10,
    color: '#393D45',
  },
  disabled: {opacity: 0.35},
  scroll: {flex: 1},
  content: {paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6},
  sectionLabel: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 10,
    color: '#858B97',
    marginBottom: 10,
  },
  splitterList: {flexGrow: 0},
  list: {paddingLeft: 24},
  timeline: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 10,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C2C7CD',
  },
  locationBadge: {
    position: 'absolute',
    left: -10,
    top: 34,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 9,
    marginBottom: 8,
    shadowColor: '#253047',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  nearestCard: {
    backgroundColor: '#F4F0FF',
    borderWidth: 1,
    borderColor: '#B8A0F7',
  },
  nearestBadge: {
    fontFamily: FONTS.BOLD,
    fontSize: 10,
    color: '#7041D8',
    marginBottom: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 3,
  },
  splitterIcon: {
    width: 21,
    height: 21,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitterName: {
    flexGrow: 1,
    fontFamily: FONTS.BOLD,
    fontSize: 10,
    color: '#393D45',
  },
  type: {fontFamily: FONTS.REGULAR, fontSize: 10, color: '#393D45'},
  details: {
    fontFamily: FONTS.REGULAR,
    fontSize: 10,
    lineHeight: 17,
    color: '#424650',
  },
  bold: {fontFamily: FONTS.BOLD},
  cardBottom: {gap: 3},
  distanceRow: {
    alignSelf: 'flex-end',
    fontFamily: FONTS.BOLD,
    fontSize: 11,
    lineHeight: 18,
    color: '#393D45',
  },
  distance: {color: '#0075E6', fontFamily: FONTS.BOLD, fontSize: 12},
  mapCard: {
    marginTop: 12,
    borderRadius: 9,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  expandedMap: {flex: 1, overflow: 'hidden'},
  mapPinGroup: {flexDirection: 'row', flexWrap: 'wrap', gap: 3, maxWidth: 150},
  mapPin: {
    minWidth: 42,
    height: 30,
    paddingHorizontal: 6,
    flexDirection: 'row',
    gap: 4,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7951EF',
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
  mapPinNumber: {fontFamily: FONTS.BOLD, fontSize: 12, color: '#FFFFFF'},
  listNumber: {fontFamily: FONTS.BOLD, fontSize: 11, color: '#FFFFFF'},
  expandButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#8050EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {paddingHorizontal: 14, paddingTop: 8, backgroundColor: '#F4F7FA'},
  whereButton: {
    minHeight: 44,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whereText: {fontFamily: FONTS.MEDIUM, color: '#FFFFFF', fontSize: 13},
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    minHeight: 52,
  },
  modalTitle: {fontFamily: FONTS.SEMI_BOLD, fontSize: 16, color: '#393D45'},
  closeButton: {padding: 12},
  closeText: {fontFamily: FONTS.MEDIUM, color: '#7041D8'},
});
