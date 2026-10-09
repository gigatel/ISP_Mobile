import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {FONTS, IMAGES, SIZE} from '@res';
import ConnectivityMap from './ConnectivityMap';
import {ConnectivityIcon, HeaderPattern} from './ConnectivityIcons';
import {
  Coordinate,
  distanceToItem,
  previousSplitterOf,
  typeOf,
  nodeIdOf,
  withEndpointNodes,
  circuitModeOf,
} from './connectivity';
import {checkPermission, getGeoLocation} from '../../utils/location';
import {circuitConnectivityService} from '../../services/circuitConnectivityService';

const PURPLE = '#7B4AEE';

const valueOf = (item: any, ...keys: string[]) => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item[key] !== '') {
      return item[key];
    }
  }
  return '';
};

const display = (value: any) =>
  value === undefined || value === null || value === '' ? '-' : String(value);

const asList = (value: any): any[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (Array.isArray(value?.data)) {
    return value.data;
  }
  return [];
};

const circuitIdOf = (item: any) =>
  String(
    valueOf(
      item,
      'circuitCode',
      'CircuitCode',
      'circuitId',
      'CircuitId',
      'circuitID',
      'id',
      'Id',
    ),
  );

const circuitNameOf = (item: any) =>
  display(valueOf(item, 'circuitName', 'CircuitName', 'name', 'Name'));

const joinCodeAndName = (code: any, name: any) => {
  const safeCode = display(code);
  const safeName = display(name);
  if (safeCode === '-') {
    return safeName;
  }
  if (safeName === '-') {
    return safeCode;
  }
  return `(${safeCode}) ${safeName}`;
};

const masterLabelOf = (item: any, prefix: 'from' | 'to') =>
  joinCodeAndName(
    valueOf(item, `${prefix}MasterType`, `${prefix}MasterCode`),
    valueOf(item, `${prefix}MasterName`),
  );

const routeLabelOf = (item: any) =>
  joinCodeAndName(
    valueOf(item, 'fiberCode', 'FiberCode'),
    valueOf(item, 'routeName', 'RouteName', 'routeId', 'RouteId'),
  );

const isRouteDetail = (item: any) =>
  Number(valueOf(item, 'routeFiberId', 'RouteFiberId')) > 0 ||
  !!valueOf(item, 'routeName', 'RouteName') ||
  String(valueOf(item, 'infraType', 'InfraType'))
    .toLowerCase()
    .includes('route');

const normalizeCircuit = (item: any) => {
  const summary = item?.circuit ?? {};
  const fullCircuit = item?.fullDetails?.circuit ?? {};
  const details = asList(
    item?.fullDetails?.details ?? item?.details ?? item?.connectivityList,
  );
  const masters = new Map<string, {name: any; type: any}>();

  details.forEach(detail => {
    const fromId = valueOf(detail, 'fromMasterId', 'FromMasterId');
    const toId = valueOf(detail, 'toMasterId', 'ToMasterId');
    if (Number(fromId) > 0) {
      masters.set(String(fromId), {
        name: valueOf(detail, 'fromMasterName', 'FromMasterName'),
        type: valueOf(detail, 'fromMasterType', 'FromMasterType'),
      });
    }
    if (Number(toId) > 0) {
      masters.set(String(toId), {
        name: valueOf(detail, 'toMasterName', 'ToMasterName'),
        type: valueOf(detail, 'toMasterType', 'ToMasterType'),
      });
    }
  });

  const normalizedDetails = details.map(detail => {
    const deviceId = Number(valueOf(detail, 'deviceId', 'DeviceId'));
    const matchesFrom =
      deviceId > 0 && deviceId === Number(summary?.fromDeviceId);
    const matchesTo = deviceId > 0 && deviceId === Number(summary?.toDeviceId);
    const masterId = valueOf(detail, 'deviceMasterId', 'DeviceMasterId');
    const linkedMaster = masters.get(String(masterId));
    const masterType =
      valueOf(detail, 'deviceMasterType', 'DeviceMasterType') ||
      linkedMaster?.type;

    return {
      ...detail,
      infraType:
        valueOf(
          detail,
          'infraType',
          'InfraType',
          'deviceMasterType',
          'DeviceMasterType',
        ) ||
        (isRouteDetail(detail) ? 'Route' : valueOf(detail, 'type', 'Type')),
      popName:
        valueOf(detail, 'popName', 'PopName') ||
        joinCodeAndName(masterType, linkedMaster?.name || masterId),
      switchName: matchesFrom
        ? joinCodeAndName(summary?.fromDeviceCode, summary?.fromDeviceName)
        : matchesTo
        ? joinCodeAndName(summary?.toDeviceCode, summary?.toDeviceName)
        : valueOf(detail, 'deviceName', 'DeviceName'),
      port: matchesFrom
        ? valueOf(
            summary,
            'fromPortName',
            'fromPortAlias',
            'fromPortDescription',
          )
        : matchesTo
        ? valueOf(summary, 'toPortName', 'toPortAlias', 'toPortDescription')
        : valueOf(detail, 'portName', 'PortName', 'portNo', 'PortNo'),
    };
  });

  return {
    ...item,
    ...summary,
    ...fullCircuit,
    details: normalizedDetails,
    fullDetails: item?.fullDetails,
  };
};

const Field = ({label, value, wide = false}: any) => (
  <View style={[styles.field, wide && styles.fieldWide]}>
    <Text style={styles.fieldLabel}>{label}:</Text>
    <Text selectable style={styles.fieldValue}>
      {display(value)}
    </Text>
  </View>
);

const RouteTable = ({rows}: {rows: any[]}) => (
  <View style={styles.tableCard}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.headerCell, styles.serialCell]}>S.no</Text>
          <Text style={[styles.headerCell, styles.typeCell]}>Infra Type</Text>
          <Text style={[styles.headerCell, styles.routeCell]}>Route ID</Text>
          <Text style={[styles.headerCell, styles.masterCell]}>
            From Master
          </Text>
          <Text style={[styles.headerCell, styles.masterCell]}>To Master</Text>
        </View>
        {rows.map((row, index) => (
          <View
            key={`${index}-${display(valueOf(row, 'routeId', 'RouteId'))}`}
            style={styles.tableRow}>
            <Text style={[styles.bodyCell, styles.serialCell]}>
              {index + 1}
            </Text>
            <Text style={[styles.bodyCell, styles.typeCell]}>
              {display(valueOf(row, 'infraType', 'InfraType', 'type', 'Type'))}
            </Text>
            <Text style={[styles.bodyCell, styles.routeCell]}>
              {routeLabelOf(row)}
            </Text>
            <Text style={[styles.bodyCell, styles.masterCell]}>
              {valueOf(row, 'fromMaster', 'FromMaster') ||
                masterLabelOf(row, 'from')}
            </Text>
            <Text style={[styles.bodyCell, styles.masterCell]}>
              {valueOf(row, 'toMaster', 'ToMaster') || masterLabelOf(row, 'to')}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  </View>
);

const InfraCard = ({item}: {item: any}) => (
  <View style={styles.infraCard}>
    <View style={styles.fieldRow}>
      <Field
        label="Infra Type"
        value={valueOf(item, 'infraType', 'InfraType', 'type', 'Type')}
      />
      <Field
        label="Area"
        value={valueOf(
          item,
          'areaName',
          'AreaName',
          'area',
          'Area',
          'location',
          'Location',
        )}
      />
    </View>
    <View style={styles.divider} />
    <Field
      wide
      label="POP Name"
      value={valueOf(item, 'popName', 'PopName', 'POPName', 'masterName')}
    />
    <Field
      wide
      label={
        typeOf(item).includes('customer')
          ? 'Customer Name'
          : typeOf(item).includes('split')
          ? 'Splitter Name'
          : 'Switch Name'
      }
      value={valueOf(
        item,
        'customerName',
        'CustomerName',
        'splitterName',
        'SplitterName',
        'switchName',
        'SwitchName',
        'deviceName',
        'masterName',
      )}
    />
    <Field
      wide
      label="Port"
      value={valueOf(
        item,
        'port',
        'Port',
        'portNo',
        'PortNo',
        'portName',
        'PortName',
      )}
    />
    <Field
      wide
      label="Rack Name"
      value={valueOf(item, 'rackName', 'RackName')}
    />
    <View style={styles.fieldRow}>
      <Field
        label="Rack Position"
        value={valueOf(item, 'rackPosition', 'RackPosition')}
      />
      <Field
        label="Type"
        value={valueOf(
          item,
          'connectVia',
          'ConnectVia',
          'customerConnectiontype',
          'connectionType',
          'ConnectionType',
          'lanType',
        )}
      />
    </View>
    <Field
      wide
      label="Remark"
      value={valueOf(item, 'remarks', 'Remarks', 'remark', 'Remark')}
    />
  </View>
);

const InfraConnectivityScreen = ({navigation, route}: any) => {
  const insets = useSafeAreaInsets();
  const company = route?.params?.company;
  const companyId = Number(valueOf(company, 'id', 'companyId', 'CompanyId'));
  const customer = route?.params?.connectivityType === 'customer';
  const [mapVisible, setMapVisible] = useState(false);
  const [radius, setRadius] = useState(300);
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [focusedNode, setFocusedNode] = useState<any>(null);
  useEffect(() => {
    if (!mapVisible) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setMapVisible(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [mapVisible]);
  const scrollRef = useRef<ScrollView>(null);
  const candidate = route?.params?.initialCircuit;
  const initialCircuit =
    candidate &&
    (!circuitModeOf(candidate) ||
      circuitModeOf(candidate) === (customer ? 'customer' : 'infra'))
      ? normalizeCircuit(candidate)
      : null;
  const [circuits, setCircuits] = useState<any[]>(
    initialCircuit ? [initialCircuit] : [],
  );
  const [selectedCircuit, setSelectedCircuit] = useState<any>(
    initialCircuit ?? null,
  );
  const [infraItems, setInfraItems] = useState<any[]>(
    asList(initialCircuit?.details),
  );
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  useEffect(
    () => () => {
      requestSequence.current++;
    },
    [],
  );

  const locate = useCallback(async () => {
    setLocating(true);
    setLocationError('');
    try {
      if ((await checkPermission()) !== 'granted') {
        throw new Error('Enable location to filter nearby connectivity.');
      }
      const fix = await getGeoLocation();
      setLocation({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
      });
    } catch (e: any) {
      setLocationError(e?.message || 'Could not get current location.');
    } finally {
      setLocating(false);
    }
  }, []);
  useEffect(() => {
    locate();
  }, [locate]);
  useEffect(() => {
    setInfraItems(asList(selectedCircuit?.details));
    setFocusedNode(null);
  }, [selectedCircuit]);

  const load = useCallback(
    async (refresh = false) => {
      if (!Number.isFinite(companyId) || companyId <= 0) {
        setError(
          'Selected company is invalid. Please select the company again.',
        );
        setCircuits([]);
        setSelectedCircuit(null);
        setInfraItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const sequence = ++requestSequence.current;
      refresh ? setRefreshing(true) : setLoading(true);
      setError('');

      const response = await circuitConnectivityService.getCircuitsWithDetails({
        page: 1,
        size: 100,
        search: query.trim(),
        companyId,
      });

      if (response.success) {
        const total = Math.max(response.recordsFiltered, response.recordsTotal);
        for (let page = 2; (page - 1) * 100 < total; page++) {
          if (sequence !== requestSequence.current) {
            return;
          }
          const next = await circuitConnectivityService.getCircuitsWithDetails({
            page,
            size: 100,
            search: query.trim(),
            companyId,
          });
          if (!next.success) {
            response.success = false;
            response.message = next.message;
            break;
          }
          response.data.push(...next.data);
          if (!next.data.length) {
            break;
          }
        }
      }
      if (sequence !== requestSequence.current) {
        return;
      }

      if (response.success) {
        const list = response.data
          .map(normalizeCircuit)
          .filter(
            item =>
              !circuitModeOf(item) ||
              circuitModeOf(item) === (customer ? 'customer' : 'infra'),
          );
        setCircuits(list);

        if (list.length) {
          setSelectedCircuit((current: any) => {
            if (query.trim() && current) {
              return current;
            }
            const updated =
              list.find(item => circuitIdOf(item) === circuitIdOf(current)) ??
              list[0];
            return updated;
          });
        } else if (!query.trim() && !list.length) {
          setSelectedCircuit(null);
          setInfraItems([]);
        }
      } else {
        setCircuits([]);
        setError(response.message || 'Failed to load circuits');
      }

      setLoading(false);
      setRefreshing(false);
    },
    [companyId, customer, query],
  );

  useEffect(() => {
    const debounce = setTimeout(load, query.trim() ? 400 : 0);
    return () => clearTimeout(debounce);
  }, [load, query]);

  const matchingCircuits = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return circuits;
    }
    return circuits;
  }, [circuits, query]);

  const selectCircuit = (circuit: any) => {
    setSelectedCircuit(circuit);
    setQuery('');
    setSearchOpen(false);
    setLoading(true);
    setError('');
    setInfraItems(asList(circuit?.details));
    setFocusedNode(null);
    requestAnimationFrame(() => {
      setLoading(false);
    });
  };

  const routeRowsFor = (item: any) => {
    const nested = valueOf(
      item,
      'routeList',
      'RouteList',
      'routes',
      'Routes',
      'connectivityList',
      'ConnectivityList',
    );
    return asList(nested).length ? asList(nested) : [item];
  };

  const defaultRows = useMemo(() => {
    const nested = valueOf(
      selectedCircuit,
      'routeList',
      'RouteList',
      'routes',
      'Routes',
    );
    return asList(nested);
  }, [selectedCircuit]);

  const allItems = useMemo(
    () => (infraItems.length ? infraItems : defaultRows),
    [infraItems, defaultRows],
  );
  const visibleItems = useMemo(() => {
    const nearby = customer
      ? allItems
      : location
      ? allItems.filter(item => distanceToItem(location, item) <= radius)
      : [];
    if (!focusedNode) {
      return nearby;
    }
    const id = nodeIdOf(focusedNode);
    const edges = allItems.filter(
      item =>
        item !== focusedNode &&
        (String(valueOf(item, 'fromMasterId', 'FromMasterId')) === id ||
          String(valueOf(item, 'toMasterId', 'ToMasterId')) === id),
    );
    const connectedIds = new Set(
      edges.flatMap(item => [
        String(valueOf(item, 'fromMasterId', 'FromMasterId')),
        String(valueOf(item, 'toMasterId', 'ToMasterId')),
      ]),
    );
    const connectedNodes = withEndpointNodes(allItems).filter(
      item =>
        item !== focusedNode &&
        nodeIdOf(item) !== id &&
        connectedIds.has(nodeIdOf(item)) &&
        !edges.includes(item),
    );
    return [focusedNode, ...edges, ...connectedNodes];
  }, [allItems, customer, location, radius, focusedNode]);
  const unlocatedCount = allItems.filter(
    item => !Number.isFinite(distanceToItem({latitude: 0, longitude: 0}, item)),
  ).length;
  const topologyItems = useMemo(() => withEndpointNodes(allItems), [allItems]);
  const groupedItems = useMemo(() => {
    const groups: any[] = [];
    visibleItems.forEach(item => {
      const last = groups[groups.length - 1];
      if (isRouteDetail(item) && last?.routeGroup) {
        last.rows.push(item);
      } else {
        groups.push(
          isRouteDetail(item)
            ? {routeGroup: true, rows: routeRowsFor(item)}
            : {item},
        );
      }
    });
    return groups;
  }, [visibleItems]);
  const currentNode =
    focusedNode ??
    [...topologyItems]
      .reverse()
      .find(item => typeOf(item).includes('customer')) ??
    [...topologyItems].reverse().find(item => typeOf(item).includes('split'));
  const previousSplitter = previousSplitterOf(topologyItems, currentNode);
  const viewPrevious = () => {
    if (previousSplitter) {
      setFocusedNode(previousSplitter);
      scrollRef.current?.scrollTo({y: 0, animated: true});
    }
  };
  const previousButton = customer && (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={!previousSplitter}
      onPress={viewPrevious}
      style={[
        styles.previousButton,
        !previousSplitter && styles.mapButtonDisabled,
      ]}>
      <LinearGradient
        pointerEvents="none"
        colors={['#8A54FA', '#6031D0']}
        style={[StyleSheet.absoluteFill, styles.buttonGradient]}
      />
      <Text style={styles.retryText}>View Previous Splitter</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#814CF3', '#5B25D6']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={[styles.header, {paddingTop: insets.top}]}>
        <HeaderPattern />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() =>
            mapVisible ? setMapVisible(false) : navigation.goBack()
          }
          style={styles.backButton}>
          <Image source={IMAGES.arrowBack} style={styles.backImage} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {customer ? 'Customer End Connectivity' : 'Infra Connectivity'}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setMapVisible(!mapVisible)}
          style={styles.mapButton}>
          <View style={styles.mapIcon}>
            {mapVisible ? (
              <Image source={IMAGES.close} style={styles.closeImage} />
            ) : (
              <ConnectivityIcon size={18} />
            )}
          </View>
          <Text style={styles.mapButtonText}>
            {mapVisible ? 'Close Map' : 'View Map'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      {mapVisible ? (
        <View
          style={[
            styles.mapContent,
            customer
              ? styles.mapWithFooter
              : {paddingBottom: Math.max(insets.bottom, 12)},
          ]}>
          <ConnectivityMap
            items={visibleItems}
            location={location}
            radius={radius}
            customer={customer}
          />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[PURPLE]}
              tintColor={PURPLE}
            />
          }>
          {searchOpen && (
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Image source={IMAGES.search} style={styles.searchIcon} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by Circuit Name / Circuit ID"
                  placeholderTextColor="#777D8E"
                  style={styles.searchInput}
                />
              </View>
            </View>
          )}

          {searchOpen && (
            <View style={styles.searchResults}>
              {matchingCircuits.map(item => (
                <TouchableOpacity
                  key={circuitIdOf(item)}
                  onPress={() => selectCircuit(item)}
                  style={styles.circuitResult}>
                  <Image source={IMAGES.Circuit} style={styles.resultIcon} />
                  <View style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>
                      {circuitNameOf(item)}
                    </Text>
                    <Text style={styles.resultSubtitle}>
                      {circuitIdOf(item)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {!matchingCircuits.length && (
                <Text style={styles.noMatch}>No matching circuit found.</Text>
              )}
            </View>
          )}

          <View style={styles.detailsHeading}>
            <Text style={styles.sectionTitle}>Circuit Details</Text>
            {!customer && (
              <View style={styles.rangeControl}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Decrease location range by 100 metres"
                  disabled={radius <= 100}
                  onPress={() => setRadius(value => Math.max(100, value - 100))}
                  style={styles.rangeButton}>
                  <Text style={styles.rangeSymbol}>−</Text>
                </TouchableOpacity>
                <Text style={styles.rangeText}>{radius}m</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Increase location range by 100 metres"
                  onPress={() => setRadius(value => value + 100)}
                  style={styles.rangeButton}>
                  <Text style={styles.rangeSymbol}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.sectionRule} />
          <Field
            wide
            label="Connectivity Type"
            value={customer ? 'Customer End' : 'Infra'}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choose circuit"
            accessibilityState={{expanded: searchOpen}}
            onPress={() => setSearchOpen(!searchOpen)}
            style={styles.circuitPicker}>
            <Field
              wide
              label="Circuit Name"
              value={circuitNameOf(selectedCircuit)}
            />
            <Image source={IMAGES.downArrow} style={styles.circuitPickerIcon} />
          </TouchableOpacity>
          <Field wide label="Circuit ID" value={circuitIdOf(selectedCircuit)} />

          {!customer && (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={locating}
              onPress={locate}>
              <Text style={styles.locationStatus}>
                {locating
                  ? 'Finding current location…'
                  : locationError ||
                    `Within ${radius}m of current location · Refresh location`}
              </Text>
            </TouchableOpacity>
          )}
          {!!error && !!selectedCircuit && (
            <Text style={styles.locationStatus}>{error}</Text>
          )}
          {focusedNode && (
            <TouchableOpacity onPress={() => setFocusedNode(null)}>
              <Text style={styles.locationStatus}>
                Show full customer connectivity
              </Text>
            </TouchableOpacity>
          )}
          {!customer && !loading && unlocatedCount > 0 && (
            <Text style={styles.stateText}>
              {unlocatedCount} records have no location coordinates and cannot
              be filtered by range.
            </Text>
          )}
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={PURPLE} />
              <Text style={styles.stateText}>
                Loading circuit connectivity…
              </Text>
            </View>
          ) : error && !selectedCircuit ? (
            <View style={styles.loadingState}>
              <Text style={styles.errorTitle}>Circuit details unavailable</Text>
              <Text style={styles.stateText}>{error}</Text>
              <TouchableOpacity
                onPress={() => load()}
                style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : visibleItems.length ? (
            groupedItems.map((group, index) => (
              <View
                key={`${index}-${display(
                  valueOf(group.item, 'id', 'Id', 'chamberId'),
                )}`}>
                {group.routeGroup ? (
                  <RouteTable rows={group.rows} />
                ) : (
                  <InfraCard item={group.item} />
                )}
                {index < groupedItems.length - 1 && (
                  <View style={styles.connector} />
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Image source={IMAGES.Circuit} style={styles.emptyIcon} />
              <Text style={styles.errorTitle}>No connectivity data found</Text>
              <Text style={styles.stateText}>
                {error ||
                  (!customer
                    ? locationError ||
                      (locating
                        ? 'Waiting for current location.'
                        : `No located records within ${radius}m. Increase the range to see more.`)
                    : 'No customer end connectivity records were returned for this company.')}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
      {customer && (
        <View
          style={[
            styles.bottomActions,
            {paddingBottom: Math.max(insets.bottom, 12)},
          ]}>
          {previousButton}
        </View>
      )}
    </View>
  );
};

export default InfraConnectivityScreen;

const shadow = {
  shadowColor: '#27184C',
  shadowOffset: {width: 0, height: 3},
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

const styles = StyleSheet.create({
  circuitPicker: {flexDirection: 'row', alignItems: 'center', paddingRight: 20},
  circuitPickerIcon: {
    position: 'absolute',
    right: 0,
    width: 12,
    height: 12,
    tintColor: '#737987',
    resizeMode: 'contain',
  },
  mapContent: {flex: 1, padding: 12, gap: 10},
  mapWithFooter: {paddingBottom: 0},
  bottomActions: {
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#F3F5F9',
  },
  buttonGradient: {borderRadius: 6},
  previousButton: {
    backgroundColor: PURPLE,
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
  },
  detailsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  rangeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D8DCE5',
  },
  rangeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeSymbol: {color: '#737987', fontSize: 18},
  rangeText: {fontSize: 11, color: '#515663'},
  locationStatus: {color: '#7953CB', fontSize: 11, marginVertical: 8},
  closeImage: {width: 14, height: 14, tintColor: '#FFF', resizeMode: 'contain'},
  closeIcon: {fontSize: 20, color: '#FFF'},
  mapIcon: {
    backgroundColor: PURPLE,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  screen: {flex: 1, backgroundColor: '#F3F5F9'},
  header: {
    minHeight: SIZE.MVS(90),
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SIZE.MS(12),
    paddingBottom: SIZE.MVS(12),
  },
  backButton: {
    width: SIZE.MS(34),
    height: SIZE.MS(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backImage: {width: 22, height: 22, tintColor: '#FFF', resizeMode: 'contain'},
  backArrow: {fontSize: SIZE.MS(34), lineHeight: SIZE.MS(34), color: '#FFF'},
  headerTitle: {
    color: '#FFF',
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(15),
    marginBottom: 4,
    flex: 1,
  },
  scroll: {flex: 1},
  content: {padding: SIZE.MS(12), paddingBottom: SIZE.MVS(36)},
  searchRow: {flexDirection: 'row', alignItems: 'center', gap: SIZE.MS(8)},
  searchBox: {
    ...shadow,
    flex: 1,
    minWidth: 0,
    minHeight: SIZE.MVS(48),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(10),
    borderWidth: 1,
    borderColor: '#E9EAF0',
  },
  searchIcon: {
    width: SIZE.MS(17),
    height: SIZE.MS(17),
    tintColor: '#697080',
    resizeMode: 'contain',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MVS(9),
    color: '#272A35',
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(12),
  },
  mapButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3EAFF',
    borderRadius: 5,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  mapButtonDisabled: {opacity: 0.5},
  mapButtonText: {
    color: '#343842',
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(11),
  },
  searchResults: {
    ...shadow,
    backgroundColor: '#FFF',
    borderRadius: SIZE.MS(9),
    marginTop: SIZE.MVS(5),
    padding: SIZE.MS(6),
    borderWidth: 1,
    borderColor: '#E5E7ED',
  },
  circuitResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZE.MS(9),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E6EB',
  },
  resultIcon: {
    width: SIZE.MS(22),
    height: SIZE.MS(22),
    resizeMode: 'contain',
    tintColor: PURPLE,
  },
  resultCopy: {flex: 1, marginLeft: SIZE.MS(9)},
  resultTitle: {
    fontFamily: FONTS.MEDIUM,
    color: '#30333D',
    fontSize: SIZE.MS(12),
  },
  resultSubtitle: {
    fontFamily: FONTS.REGULAR,
    color: '#7B7F8B',
    fontSize: SIZE.MS(10),
    marginTop: 2,
  },
  noMatch: {
    fontFamily: FONTS.REGULAR,
    color: '#777C89',
    padding: SIZE.MS(10),
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(12),
    color: '#323640',
    marginTop: 0,
  },
  sectionRule: {
    height: 1,
    backgroundColor: '#E3E5E9',
    marginTop: SIZE.MVS(7),
    marginBottom: SIZE.MVS(6),
  },
  fieldRow: {flexDirection: 'row', alignItems: 'flex-start'},
  field: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    paddingVertical: SIZE.MVS(4),
    paddingRight: SIZE.MS(8),
  },
  fieldWide: {width: '100%', flex: 0},
  fieldLabel: {
    fontFamily: FONTS.MEDIUM,
    color: '#343842',
    fontSize: SIZE.MS(11),
    marginRight: SIZE.MS(7),
  },
  fieldValue: {
    flex: 1,
    fontFamily: FONTS.REGULAR,
    color: '#515663',
    fontSize: SIZE.MS(11),
    lineHeight: SIZE.MVS(16),
  },
  tableCard: {
    marginTop: 0,
    borderWidth: 1,
    borderColor: '#CDD9ED',
    borderRadius: SIZE.MS(7),
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: SIZE.MVS(46),
    backgroundColor: '#FFF',
  },
  tableHeader: {minHeight: SIZE.MVS(36), backgroundColor: '#8051EE'},
  headerCell: {
    color: '#FFF',
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(6),
    paddingVertical: SIZE.MVS(9),
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  bodyCell: {
    color: '#424753',
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(10),
    lineHeight: SIZE.MVS(14),
    paddingHorizontal: SIZE.MS(6),
    paddingVertical: SIZE.MVS(8),
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: '#D9E0EB',
  },
  serialCell: {width: SIZE.MS(34), textAlign: 'center'},
  typeCell: {width: SIZE.MS(64)},
  routeCell: {width: SIZE.MS(140)},
  masterCell: {width: SIZE.MS(130)},
  connector: {
    alignSelf: 'center',
    width: 0,
    height: SIZE.MVS(18),
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#84AFE2',
  },
  infraCard: {
    ...shadow,
    backgroundColor: '#FFF',
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(10),
    paddingVertical: SIZE.MVS(8),
    marginBottom: SIZE.MVS(2),
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  divider: {height: 1, backgroundColor: '#ECEEF2', marginBottom: SIZE.MVS(3)},
  loadingState: {
    minHeight: SIZE.MVS(250),
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZE.MS(20),
  },
  emptyState: {
    minHeight: SIZE.MVS(220),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(28),
  },
  emptyIcon: {
    width: SIZE.MS(48),
    height: SIZE.MS(48),
    resizeMode: 'contain',
    tintColor: '#8C65E9',
    marginBottom: SIZE.MVS(12),
  },
  errorTitle: {
    fontFamily: FONTS.SEMI_BOLD,
    color: '#303342',
    fontSize: SIZE.MS(15),
    textAlign: 'center',
  },
  stateText: {
    fontFamily: FONTS.REGULAR,
    color: '#777C88',
    fontSize: SIZE.MS(12),
    textAlign: 'center',
    marginTop: SIZE.MVS(7),
  },
  retryButton: {
    marginTop: SIZE.MVS(14),
    backgroundColor: PURPLE,
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(20),
    paddingVertical: SIZE.MVS(9),
  },
  retryText: {color: '#FFF', fontFamily: FONTS.SEMI_BOLD},
});
