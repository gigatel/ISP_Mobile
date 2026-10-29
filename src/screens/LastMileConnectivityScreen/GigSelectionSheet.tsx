import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PERMISSIONS, request, RESULTS} from 'react-native-permissions';
import LinearGradient from 'react-native-linear-gradient';
import {FONTS, IMAGES} from '@res';
import {getGeoLocation} from '../../utils/location';
import {
  FIBER_CORE_COLORS,
  filterGigRoutes,
  getNearbyGigRoutes,
  isGigCoreUnavailable,
} from '../../services/nearbyGigRoutes';
import {getGigTubeCores} from '../../services/gigTubeCores';
import type {GigTubeCore} from '../../services/gigTubeCores';
import type {GigRoute, GigCoreAssignment} from '../../services/nearbyGigRoutes';
import type {SplitterCoordinate} from '../../services/lastMileConnectivityService';
import {distanceLabel} from '../../services/lastMileConnectivityService';
import PointerSvg from '../../res/images/pointer.svg';

type Props = {
  onClose: () => void;
  onSelect: (route: GigRoute, tube: string, core: string) => void;
  selectedFiberMappingId?: number;
  selectedTube?: string;
  selectedCore?: string;
  occupiedAssignments?: GigCoreAssignment[];
  editingAssignment?: GigCoreAssignment;
};
const GRADIENT = ['#8858F9', '#6036C4'];
const optionCount = (value: number | null | undefined) =>
  value != null && Number.isSafeInteger(value) && value > 0 ? value : 0;
const coreColorName = (core: GigTubeCore) =>
  core.coreName.replace(/^\d+\s*[.:-]\s*/, '') || `Core ${core.coreId}`;
const coreColor = (core: GigTubeCore) =>
  FIBER_CORE_COLORS.find(
    color => color.name.toLowerCase() === coreColorName(core).toLowerCase(),
  )?.color ??
  FIBER_CORE_COLORS[(core.coreId - 1) % FIBER_CORE_COLORS.length].color;
const withinOptions = (value: string, count: number) =>
  Number.isInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= count;

export default function GigSelectionSheet({
  onClose,
  onSelect,
  selectedFiberMappingId,
  selectedTube,
  selectedCore,
  occupiedAssignments = [],
  editingAssignment,
}: Props) {
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const [routes, setRoutes] = useState<GigRoute[]>([]);
  const [radius, setRadius] = useState(200);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<number | null>(
    selectedFiberMappingId ?? null,
  );
  const [tube, setTube] = useState(selectedTube ?? '');
  const [core, setCore] = useState(selectedCore ?? '');
  const [optionPicker, setOptionPicker] = useState<'tube' | 'core' | null>(
    null,
  );
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const coordinate = useRef<SplitterCoordinate | null>(null);
  const sequence = useRef(0);
  const coreSequence = useRef(0);
  const [coreState, setCoreState] = useState<{
    key: string;
    options: GigTubeCore[];
    loading: boolean;
    error: string;
  }>({key: '', options: [], loading: false, error: ''});
  const loadCores = useCallback(async (routeId: number, tubeNumber: number) => {
    const requestId = ++coreSequence.current;
    const key = `${routeId}:${tubeNumber}`;
    setCoreState({key, options: [], loading: true, error: ''});
    try {
      const options = await getGigTubeCores(routeId, tubeNumber);
      if (requestId === coreSequence.current) {
        setCoreState({key, options, loading: false, error: ''});
      }
    } catch (failure: any) {
      if (requestId === coreSequence.current) {
        setCoreState({
          key,
          options: [],
          loading: false,
          error: failure?.message || 'Could not load cores. Please retry.',
        });
      }
    }
  }, []);

  const load = useCallback(
    async (fresh = false) => {
      const id = ++sequence.current;
      setLoading(true);
      setError('');
      try {
        let position = coordinate.current;
        if (!position || fresh) {
          setLocating(true);
          const permission = await request(
            Platform.OS === 'ios'
              ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
              : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
          );
          if (id !== sequence.current) {
            return;
          }
          if (
            permission !== RESULTS.GRANTED &&
            permission !== RESULTS.LIMITED
          ) {
            throw new Error('Allow location access to find nearby GIG routes.');
          }
          const fix = await getGeoLocation(true);
          if (id !== sequence.current) {
            return;
          }
          position = {
            latitude: fix.coords.latitude,
            longitude: fix.coords.longitude,
          };
          coordinate.current = position;
          setLocating(false);
        }
        const result = await getNearbyGigRoutes(position, radius);
        if (id !== sequence.current) {
          return;
        }
        setRoutes(result);
        const selectionExists = result.some(
          route => route.id === activeIdRef.current,
        );
        setActiveId(
          selectionExists ? activeIdRef.current : result[0]?.id ?? null,
        );
        if (!selectionExists) {
          setTube('');
          setCore('');
        }
      } catch (failure: any) {
        if (id === sequence.current) {
          setRoutes([]);
          setError(
            failure?.message || 'Could not load GIG routes. Please retry.',
          );
        }
      } finally {
        if (id === sequence.current) {
          setLoading(false);
          setLocating(false);
        }
      }
    },
    [radius],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 200);
    return () => {
      clearTimeout(timer);
      sequence.current += 1;
    };
  }, [load]);

  const activeRoute = routes.find(item => item.id === activeId);
  const tubeCount = optionCount(activeRoute?.tubeNo);
  const coresReady =
    !loading &&
    coreState.key === `${activeId}:${Number(tube)}` &&
    !coreState.loading &&
    !coreState.error;
  const coreOptions = coresReady ? coreState.options : [];
  const selectedCoreOption = coreOptions.find(
    option => option.coreId === Number(core),
  );
  const selectedCoreColor = selectedCoreOption
    ? coreColor(selectedCoreOption)
    : '#FFFFFF';
  const routeWithCoreOptions = (route: GigRoute): GigRoute => ({
    ...route,
    tubeCoreOptions: {tubeNo: Number(tube), cores: coreOptions},
  });
  const coreUnavailable = (coreNumber: number, route = activeRoute) =>
    !coresReady ||
    !route ||
    isGigCoreUnavailable(
      routeWithCoreOptions(route),
      Number(tube),
      coreNumber,
      occupiedAssignments,
      editingAssignment,
    );
  useEffect(() => {
    if (!loading && activeRoute && withinOptions(tube, tubeCount)) {
      loadCores(activeRoute.id, Number(tube));
    }
    return () => {
      coreSequence.current += 1;
    };
  }, [activeRoute, loading, tube, tubeCount, loadCores]);
  useEffect(() => {
    if (!loading && tube && !withinOptions(tube, tubeCount)) {
      setTube('');
      setCore('');
    }
  }, [loading, tube, tubeCount]);
  useEffect(() => {
    if (
      coresReady &&
      core &&
      !coreState.options.some(
        item => item.coreId === Number(core) && !item.isUsed,
      )
    ) {
      setCore('');
    }
  }, [coresReady, core, coreState.options]);

  const pickerOptions =
    optionPicker === 'tube'
      ? Array.from({length: tubeCount}, (_, index) => ({
          coreId: index + 1,
          coreName: '',
          isUsed: false,
        }))
      : coreOptions;
  const visibleRoutes = filterGigRoutes(routes, query);
  const close = () => (optionPicker ? setOptionPicker(null) : onClose());
  const activate = (route: GigRoute) => {
    if (route.id !== activeId) {
      setActiveId(route.id);
      setTube('');
      setCore('');
    }
  };
  const choose = (route: GigRoute) => {
    if (
      !withinOptions(tube, optionCount(route.tubeNo)) ||
      !coreOptions.some(option => option.coreId === Number(core))
    ) {
      Alert.alert(
        'Select tube and core',
        'Choose a tube and core before selecting this GIG.',
      );
      return;
    }
    if (coreUnavailable(Number(core), route)) {
      Alert.alert(
        'Core already in use',
        'This core is connected to another customer. Select a different core.',
      );
      return;
    }
    onSelect(routeWithCoreOptions(route), tube, core);
  };
  const renderRoute = ({item}: {item: GigRoute}) => (
    <View style={styles.routeCard}>
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Choose ${item.fiberCode}, ${item.routeName}`}
        onPress={() => activate(item)}
        style={styles.routeBody}>
        <View style={styles.routeHeading}>
          <Text style={styles.fiberCode}>{item.fiberCode || '—'}</Text>
          <Text style={styles.routeName}>{item.routeName || '—'}</Text>
          <Text style={styles.length}>
            Length: {distanceLabel(item.totalDistance)}
          </Text>
        </View>
        <Text style={styles.routeCode}>
          {[item.routeIdStr, item.sldCode].filter(Boolean).join('  •  ') || '—'}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailKey}>From: </Text>
          {item.startArea || '—'}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailKey}>To: </Text>
          {item.endArea || '—'}
        </Text>
        <View style={styles.routeBottom}>
          <Text style={styles.detail}>
            <Text style={styles.detailKey}>Fiber Type: </Text>
            {item.fiberTypeName || '—'}
          </Text>
          <Text style={styles.detail}>
            Distance:{' '}
            <Text style={styles.distance}>
              {distanceLabel(item.distanceMeters)}
            </Text>
          </Text>
        </View>
      </TouchableOpacity>
      {activeId === item.id && (
        <View style={styles.connectionControls}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Select tube"
            onPress={() => setOptionPicker('tube')}
            style={styles.dropdown}>
            <Text style={styles.dropdownText}>
              {tube ? `Tube ${tube}` : 'Tube'}
            </Text>
            <Image source={IMAGES.down} style={styles.arrow} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Select core"
            onPress={() =>
              tube
                ? setOptionPicker('core')
                : Alert.alert(
                    'Select tube',
                    'Choose a tube before selecting its core.',
                  )
            }
            style={styles.dropdown}>
            {core && (
              <View
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: selectedCoreColor,
                  },
                ]}
              />
            )}
            <Text style={styles.dropdownText}>
              {core ? `Core ${core}` : 'Core'}
            </Text>
            <Image source={IMAGES.down} style={styles.arrow} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Select GIG ${item.fiberCode}`}
            disabled={
              Boolean(tube) &&
              (!coresReady ||
                (Boolean(core) && coreUnavailable(Number(core), item)))
            }
            accessibilityState={{
              disabled:
                Boolean(tube) &&
                (!coresReady ||
                  (Boolean(core) && coreUnavailable(Number(core), item))),
            }}
            onPress={() => choose(item)}>
            <LinearGradient
              colors={GRADIENT}
              style={[
                styles.selectButton,
                Boolean(core) &&
                  coreUnavailable(Number(core), item) &&
                  styles.usedOption,
              ]}>
              <Text style={styles.buttonText}>Select</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close GIG selection"
        />
        <View
          style={[
            styles.sheet,
            {height: Math.min(height * 0.9, height - insets.top - 12)},
          ]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Select GIG</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close GIG sheet"
              style={styles.closeButton}
              onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Image source={IMAGES.search} style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                accessibilityLabel="Search nearby GIG routes"
                placeholder="Search..."
                placeholderTextColor="#9398A4"
                style={styles.searchInput}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear GIG search"
                style={styles.clearButton}
                onPress={() => setQuery('')}>
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rangeControl}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Decrease GIG range"
                disabled={radius === 0}
                style={styles.rangeButton}
                onPress={() => setRadius(value => Math.max(0, value - 100))}>
                <Text style={styles.rangeSign}>−</Text>
              </TouchableOpacity>
              <Text style={styles.rangeText}>{radius}m</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Increase GIG range"
                disabled={radius >= 5000}
                style={styles.rangeButton}
                onPress={() => setRadius(value => Math.min(5000, value + 100))}>
                <Text style={styles.rangeSign}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.sectionLabel}>Near by GIG :</Text>
          <View style={styles.listArea}>
            {!loading && !error && visibleRoutes.length > 0 && (
              <>
                <View style={styles.timeline} />
                <View style={styles.locationIcon}>
                  <PointerSvg width={28} height={28} />
                </View>
              </>
            )}
            {loading ? (
              <View style={styles.state}>
                <ActivityIndicator color="#8858F9" />
                <Text style={styles.stateText}>
                  {locating
                    ? 'Finding your current location…'
                    : 'Loading nearby GIG routes…'}
                </Text>
              </View>
            ) : error ? (
              <View style={styles.state}>
                <Text style={styles.stateText}>{error}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.retryButton}
                  onPress={() => load(!coordinate.current)}>
                  <Text style={styles.buttonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={visibleRoutes}
                keyExtractor={item => String(item.id)}
                renderItem={renderRoute}
                extraData={{activeId, tube, core}}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <Text style={styles.stateText}>
                    {query
                      ? 'No GIG routes match your search.'
                      : 'No connected GIG routes found. Change the range or refresh your location.'}
                  </Text>
                }
              />
            )}
          </View>
          <View
            style={[
              styles.footer,
              {paddingBottom: Math.max(insets.bottom, 12)},
            ]}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={loading}
              onPress={() => load(true)}>
              <LinearGradient colors={GRADIENT} style={styles.whereButton}>
                <Text style={styles.buttonText}>
                  {locating
                    ? 'Locating…'
                    : loading
                    ? 'Loading…'
                    : 'Where I am?'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          {optionPicker && (
            <View style={styles.optionOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setOptionPicker(null)}
                accessibilityRole="button"
                accessibilityLabel="Close tube or core options"
              />
              <View style={[styles.optionsCard, {maxHeight: height * 0.64}]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  {optionPicker === 'core' && !coresReady && (
                    <View style={styles.state}>
                      {coreState.error ? (
                        <>
                          <Text style={styles.stateText}>
                            {coreState.error}
                          </Text>
                          <TouchableOpacity
                            accessibilityLabel="Retry core availability"
                            accessibilityRole="button"
                            style={styles.retryButton}
                            onPress={() =>
                              activeRoute &&
                              loadCores(activeRoute.id, Number(tube))
                            }>
                            <Text style={styles.buttonText}>Retry</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <ActivityIndicator color="#8858F9" />
                          <Text style={styles.stateText}>Loading cores…</Text>
                        </>
                      )}
                    </View>
                  )}
                  {pickerOptions.map(option => (
                    <TouchableOpacity
                      key={option.coreId}
                      accessibilityRole="button"
                      accessibilityLabel={
                        optionPicker === 'tube'
                          ? `Tube ${option.coreId}`
                          : `Core ${option.coreId} ${coreColorName(option)}`
                      }
                      disabled={
                        optionPicker === 'core' &&
                        coreUnavailable(option.coreId)
                      }
                      accessibilityState={{
                        disabled:
                          optionPicker === 'core' &&
                          coreUnavailable(option.coreId),
                      }}
                      style={[
                        styles.optionRow,
                        optionPicker === 'core' &&
                          coreUnavailable(option.coreId) &&
                          styles.usedOption,
                      ]}
                      onPress={() => {
                        if (
                          optionPicker === 'core' &&
                          coreUnavailable(option.coreId)
                        ) {
                          return;
                        }
                        if (optionPicker === 'tube') {
                          setTube(String(option.coreId));
                          setCore('');
                        } else {
                          setCore(String(option.coreId));
                        }
                        setOptionPicker(null);
                      }}>
                      <Text style={styles.optionLabel}>
                        {optionPicker === 'tube' ? 'Tube' : 'Core'}{' '}
                        {option.coreId}
                      </Text>
                      {optionPicker === 'core' && (
                        <>
                          <View
                            style={[
                              styles.colorDot,
                              {backgroundColor: coreColor(option)},
                            ]}
                          />
                          <Text style={styles.optionColor}>
                            {coreColorName(option)}
                          </Text>
                        </>
                      )}
                      {optionPicker === 'core' &&
                        coreUnavailable(option.coreId) && (
                          <Text style={styles.usedLabel}>In use</Text>
                        )}
                    </TouchableOpacity>
                  ))}
                  {pickerOptions.length === 0 &&
                    (optionPicker === 'tube' || coresReady) && (
                      <View style={styles.state}>
                        <Text style={styles.stateText}>
                          No {optionPicker === 'tube' ? 'tubes' : 'cores'}{' '}
                          available for this GIG.
                        </Text>
                      </View>
                    )}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(25,16,43,0.5)',
  },
  sheet: {
    backgroundColor: '#F4F7FA',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  handle: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#9C9C9C',
    alignSelf: 'center',
    marginTop: 4,
  },
  titleRow: {minHeight: 36, justifyContent: 'center', alignItems: 'center'},
  title: {fontFamily: FONTS.MEDIUM, fontSize: 14, color: '#393D45'},
  closeButton: {
    position: 'absolute',
    right: 8,
    top: 0,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {fontSize: 23, color: '#737988'},
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    marginVertical: 7,
  },
  searchBox: {
    flex: 1,
    minHeight: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  searchIcon: {
    width: 15,
    height: 15,
    resizeMode: 'contain',
    tintColor: '#818794',
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    paddingVertical: 6,
    color: '#393D45',
  },
  clearButton: {
    width: 23,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F2F5',
  },
  clearText: {fontSize: 20, color: '#5D6370'},
  rangeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 7,
  },
  rangeButton: {
    width: 25,
    height: 26,
    borderRadius: 4,
    backgroundColor: '#F1F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeSign: {fontSize: 19, color: '#4D5260'},
  rangeText: {
    minWidth: 42,
    textAlign: 'center',
    fontFamily: FONTS.REGULAR,
    fontSize: 10,
    color: '#393D45',
  },
  sectionLabel: {
    fontFamily: FONTS.MEDIUM,
    color: '#9299A4',
    fontSize: 9,
    marginLeft: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  listArea: {flex: 1, minHeight: 0},
  listContent: {paddingLeft: 36, paddingRight: 14, paddingBottom: 14},
  timeline: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 18,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderLeftColor: '#C4C8CE',
  },
  locationIcon: {
    position: 'absolute',
    left: 5,
    top: 34,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    marginBottom: 8,
    overflow: 'hidden',
  },
  routeBody: {padding: 8},
  routeHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  fiberCode: {fontFamily: FONTS.MEDIUM, color: '#0085FF', fontSize: 10},
  routeName: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: FONTS.REGULAR,
    fontSize: 10,
    color: '#393D45',
  },
  length: {
    fontFamily: FONTS.REGULAR,
    fontSize: 9,
    color: '#555A65',
    backgroundColor: '#F1F2F5',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  routeCode: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 10,
    color: '#8858F9',
    marginTop: 3,
    marginBottom: 4,
  },
  detail: {
    fontFamily: FONTS.REGULAR,
    color: '#414651',
    fontSize: 10,
    lineHeight: 16,
  },
  detailKey: {fontFamily: FONTS.MEDIUM},
  routeBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 5,
  },
  distance: {fontFamily: FONTS.MEDIUM, color: '#0085FF'},
  connectionControls: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#EEE7FE',
    padding: 7,
  },
  dropdown: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 7,
    minHeight: 32,
  },
  dropdownText: {
    flex: 1,
    fontFamily: FONTS.REGULAR,
    color: '#454B55',
    fontSize: 10,
  },
  arrow: {width: 11, height: 11, resizeMode: 'contain', tintColor: '#545B68'},
  selectButton: {
    minHeight: 32,
    minWidth: 78,
    paddingHorizontal: 9,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {fontFamily: FONTS.MEDIUM, color: '#FFFFFF', fontSize: 11},
  state: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    fontFamily: FONTS.REGULAR,
    color: '#838A97',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#8050DF',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 7,
  },
  footer: {paddingHorizontal: 14, paddingTop: 8},
  whereButton: {
    minHeight: 42,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,25,25,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D5D5D5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  optionLabel: {
    width: 62,
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    color: '#343943',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C5C8CE',
  },
  optionColor: {fontFamily: FONTS.REGULAR, color: '#454B55', fontSize: 11},
  usedOption: {backgroundColor: '#F0F1F4', opacity: 0.5},
  usedLabel: {
    marginLeft: 'auto',
    fontFamily: FONTS.MEDIUM,
    fontSize: 10,
    color: '#7A7E89',
  },
});
