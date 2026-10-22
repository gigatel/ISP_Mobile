import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
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
import CustomerConnectivityCards, {
  CustomerCard,
  customerCardsOf,
  customerField,
} from './CustomerConnectivityCards';
import {
  customerSplitterView,
  previousSplitterMatch,
} from './customerSplitterChain';
import {customerMapItemsOf} from './customerMapItems';
import {ConnectivityIcon, HeaderPattern} from './ConnectivityIcons';
import {
  Coordinate,
  previousSplitterOf,
  typeOf,
  nodeIdOf,
  withEndpointNodes,
  circuitModeOf,
} from './connectivity';
import {checkPermission, getGeoLocation} from '../../utils/location';
import {circuitConnectivityService} from '../../services/circuitConnectivityService';

const PURPLE = '#7B4AEE';
const PAGE_SIZE = 10;

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

const routeLabelOf = (item: any) =>
  joinCodeAndName(
    valueOf(item, 'fiberCode', 'FiberCode'),
    valueOf(item, 'routeName', 'RouteName', 'routeId', 'RouteId'),
  );

const isRouteDetail = (item: any) =>
  Number(valueOf(item, 'routeFiberMappingId', 'RouteFiberMappingId')) > 0 ||
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

const MasterDetailsCell = ({row, side}: {row: any; side: 'from' | 'to'}) => (
  <View style={[styles.masterCell, styles.masterDetailsCell]}>
    {(['Name', 'Type', 'Address'] as const).map(label => (
      <Text key={label} selectable style={styles.masterDetailValue}>
        <Text style={styles.masterDetailLabel}>{label}: </Text>
        {display(
          valueOf(
            row,
            `${side}Master${label}`,
            `${side === 'from' ? 'From' : 'To'}Master${label}`,
          ),
        )}
      </Text>
    ))}
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
            <MasterDetailsCell row={row} side="from" />
            <MasterDetailsCell row={row} side="to" />
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
      value={valueOf(item, 'rackname', 'rackName', 'RackName')}
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
  const [filterMode, setFilterMode] = useState<'all' | 'name' | 'nearby'>(
    'all',
  );
  const [nameQuery, setNameQuery] = useState('');
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [focusedNode, setFocusedNode] = useState<any>(null);
  const [splitterStep, setSplitterStep] = useState(0);
  const [previousSplitters, setPreviousSplitters] = useState<CustomerCard[]>(
    [],
  );
  const [splitterLoading, setSplitterLoading] = useState(false);
  const [splitterError, setSplitterError] = useState('');
  const splitterRequest = useRef(0);
  const splitterLoadingRef = useRef(false);
  const [customerConnectionIndex, setCustomerConnectionIndex] = useState(0);
  const scrollRef = useRef<FlatList<any>>(null);
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
  const [selectedCircuit, setSelectedCircuit] = useState<any>(null);
  const [infraItems, setInfraItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState('');
  const pageRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const pagePayloadRef = useRef<
    | Parameters<typeof circuitConnectivityService.getCircuitsWithDetails>[0]
    | null
  >(null);
  const loadedCircuitsRef = useRef<any[]>([]);
  useEffect(
    () => () => {
      requestSequence.current++;
    },
    [],
  );

  const returnToCircuitList = useCallback(() => {
    setMapVisible(false);
    setSelectedCircuit(null);
    setFocusedNode(null);
    setSplitterStep(0);
    setCustomerConnectionIndex(0);
    scrollRef.current?.scrollToOffset({offset: 0, animated: false});
  }, []);
  const goBack = useCallback(() => {
    if (mapVisible) {
      setMapVisible(false);
    } else if (selectedCircuit) {
      returnToCircuitList();
    } else {
      navigation.goBack();
    }
  }, [mapVisible, selectedCircuit, returnToCircuitList, navigation]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (mapVisible || selectedCircuit) {
          goBack();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [mapVisible, selectedCircuit, goBack]);

  const locate = useCallback(async () => {
    setLocating(true);
    setLocation(null);
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
      setRefreshing(false);
      setLocationError(e?.message || 'Could not get current location.');
    } finally {
      setLocating(false);
    }
  }, []);
  const activateNearby = () => {
    returnToCircuitList();
    setFilterMode('nearby');
    setNameQuery('');
    locate();
  };
  const showAll = () => {
    returnToCircuitList();
    setFilterMode('all');
    setNameQuery('');
    setLocationError('');
  };
  const searchByName = (text: string) => {
    returnToCircuitList();
    setNameQuery(text);
    setFilterMode(text.trim() ? 'name' : 'all');
    setLocationError('');
  };
  const changeRadius = (step: number) => {
    setRadius(value => Math.max(100, value + step));
    if (filterMode !== 'nearby') {
      activateNearby();
    }
  };
  const activeLocation = filterMode === 'nearby' ? location : null;
  const activeRange = filterMode === 'nearby' ? radius : null;
  const activeName = filterMode === 'name' ? nameQuery.trim() : '';
  useEffect(() => {
    setInfraItems(asList(selectedCircuit?.details));
    if (!selectedCircuit) {
      setMapVisible(false);
    }
    setFocusedNode(null);
    setSplitterStep(0);
    setCustomerConnectionIndex(0);
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

      if (filterMode === 'nearby' && !activeLocation) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const sequence = ++requestSequence.current;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setPageError('');
      setHasMore(false);
      pagePayloadRef.current = null;
      pageRef.current = 0;
      refresh ? setRefreshing(true) : setLoading(true);
      setError('');

      const payload = {
        page: 1,
        size: PAGE_SIZE,
        search: '',
        companyId,
        CircuitType: customer ? ('Customer' as const) : ('Infra' as const),
        CustomerSearch: customer ? activeName : '',
        InfraSearch: customer ? '' : activeName,
        Range: activeRange,
        LatLng: activeLocation
          ? `${activeLocation.latitude}, ${activeLocation.longitude}`
          : '',
      };
      const response = await circuitConnectivityService.getCircuitsWithDetails(
        payload,
      );

      if (sequence !== requestSequence.current) {
        return;
      }

      if (response.success) {
        const list = response.data.map(normalizeCircuit);
        loadedCircuitsRef.current = list;
        pagePayloadRef.current = payload;
        pageRef.current = 1;
        setHasMore(
          response.data.length === PAGE_SIZE &&
            list.length < response.recordsFiltered,
        );
        setCircuits(list);

        setSelectedCircuit((current: any) =>
          current
            ? list.find(item => circuitIdOf(item) === circuitIdOf(current)) ??
              null
            : null,
        );
      } else {
        setCircuits([]);
        setSelectedCircuit(null);
        setInfraItems([]);
        setError(response.message || 'Failed to load circuits');
      }

      setLoading(false);
      setRefreshing(false);
    },
    [companyId, customer, activeLocation, activeName, activeRange, filterMode],
  );

  useEffect(() => {
    const sequenceRef = requestSequence;
    pagePayloadRef.current = null;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setHasMore(false);
    setPageError('');
    const debounce = setTimeout(load, 400);
    return () => {
      clearTimeout(debounce);
      sequenceRef.current++;
    };
  }, [load]);

  const loadMore = useCallback(
    async (retry = false) => {
      const payload = pagePayloadRef.current;
      if (
        selectedCircuit ||
        loading ||
        refreshing ||
        loadingMoreRef.current ||
        !hasMore ||
        !payload ||
        (pageError && !retry)
      ) {
        return;
      }
      const sequence = requestSequence.current;
      const nextPage = pageRef.current + 1;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      setPageError('');
      try {
        const response =
          await circuitConnectivityService.getCircuitsWithDetails({
            ...payload,
            page: nextPage,
          });
        if (sequence !== requestSequence.current) {
          return;
        }
        if (!response.success) {
          setPageError(response.message || 'Could not load more circuits.');
          return;
        }
        const previousCount = loadedCircuitsRef.current.length;
        const merged = new Map(
          loadedCircuitsRef.current.map((item, index) => [
            circuitIdOf(item) || `loaded-${index}`,
            item,
          ]),
        );
        response.data
          .map(normalizeCircuit)
          .forEach((item, index) =>
            merged.set(circuitIdOf(item) || `page-${nextPage}-${index}`, item),
          );
        const list = [...merged.values()];
        loadedCircuitsRef.current = list;
        pageRef.current = nextPage;
        setCircuits(list);
        setHasMore(
          response.data.length === PAGE_SIZE &&
            list.length > previousCount &&
            list.length < response.recordsFiltered,
        );
      } catch (e: any) {
        if (sequence === requestSequence.current) {
          setPageError(e?.message || 'Could not load more circuits.');
        }
      } finally {
        if (sequence === requestSequence.current) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [selectedCircuit, loading, refreshing, hasMore, pageError],
  );

  const selectCircuit = (circuit: any) => {
    setSelectedCircuit(circuit);
    setError('');
    setInfraItems(asList(circuit?.details));
    setFocusedNode(null);
    setSplitterStep(0);
    setCustomerConnectionIndex(0);
    scrollRef.current?.scrollToOffset({offset: 0, animated: false});
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
  const customerCards = useMemo(
    () => customerCardsOf(allItems, selectedCircuit),
    [allItems, selectedCircuit],
  );
  const customerView = useMemo(() => {
    const base = customerSplitterView(
      customerCards,
      customerConnectionIndex,
      0,
    );
    const customerData = base.cards.find(
      card => card.kind === 'customer',
    )?.data;
    const connectedCode = customerField(customerData, 'splitterCode');
    const connectedId = customerField(customerData, 'splitterId');
    // Preserve the circuit response record's code and parentId. The local
    // topology may merge this record with a physical splitter further upstream.
    const first =
      customerCards.find(
        card =>
          card.kind === 'splitter' &&
          (connectedCode !== ''
            ? String(customerField(card.data, 'splitterCode')) ===
              String(connectedCode)
            : connectedId !== '' &&
              String(customerField(card.data, 'splitterId')) ===
                String(connectedId)),
      ) || base.path[0];
    const splitterId = customerField(first?.data, 'splitterId');
    const rawDetails = asList(
      selectedCircuit?.fullDetails?.details ?? selectedCircuit?.details,
    );
    const rawConnections = asList(
      selectedCircuit?.fullDetails?.splitterDetails ??
        selectedCircuit?.splitterDetails,
    );
    const sameSplitter = (record: any) =>
      Number(splitterId) > 0 &&
      String(customerField(record, 'splitterId', 'deviceId')) ===
        String(splitterId);
    const recordId = (record: any) =>
      customerField(record, 'splitterDetailId', 'id');
    // Customer output legs can contain a display code. Their parent record,
    // when it belongs to the same physical splitter, holds its actual API code.
    const rawSplitter =
      rawConnections.find(
        record =>
          sameSplitter(record) &&
          String(recordId(record)) ===
            String(customerField(customerData, 'parentId')),
      ) ||
      rawConnections.find(
        record =>
          sameSplitter(record) &&
          String(recordId(record)) === String(recordId(first?.data)),
      ) ||
      rawDetails.find(
        record =>
          sameSplitter(record) && customerField(record, 'splitterCode') !== '',
      );
    const initial = first
      ? {
          ...first,
          data: {
            ...first.data,
            ...rawSplitter,
            requestSplitterCode: customerField(rawSplitter, 'splitterCode'),
          },
        }
      : undefined;
    const path = [...(initial ? [initial] : []), ...previousSplitters];
    const step = Math.min(splitterStep, Math.max(0, path.length - 1));
    const current = path[step]?.data;
    const parentId = customerField(current, 'parentId');
    const hasPrevious =
      Number(parentId) > 0 &&
      Number(customerField(current, 'splitterId')) > 0 &&
      customerField(
        current,
        step === 0 ? 'requestSplitterCode' : 'splitterCode',
      ) !== '' &&
      !path
        .slice(0, step + 1)
        .some(
          card =>
            String(customerField(card.data, 'splitterDetailId', 'id')) ===
            String(parentId),
        );
    return {
      ...base,
      path,
      step,
      hasPrevious,
      missingDetails: false,
      cards: [
        ...path.slice(0, step + 1).reverse(),
        ...base.cards.filter(card => card.kind === 'customer'),
      ],
    };
  }, [
    customerCards,
    customerConnectionIndex,
    splitterStep,
    previousSplitters,
    selectedCircuit,
  ]);
  useEffect(() => {
    const requestRef = splitterRequest;
    requestRef.current++;
    splitterLoadingRef.current = false;
    setPreviousSplitters([]);
    setSplitterStep(0);
    setSplitterLoading(false);
    setSplitterError('');
    return () => {
      requestRef.current++;
    };
  }, [customerCards, customerConnectionIndex]);
  const visibleItems = useMemo(() => {
    if (!focusedNode) {
      return allItems;
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
  }, [allItems, focusedNode]);
  const mapItems = useMemo(() => {
    if (customer) {
      const customerCard = customerView.cards.find(
        card => card.kind === 'customer',
      );
      return customerMapItemsOf(
        [
          ...customerView.path.slice(0, customerView.step + 1),
          ...(customerCard ? [customerCard] : []),
        ],
        allItems.filter(isRouteDetail),
      );
    }
    if (focusedNode) {
      return visibleItems;
    }
    return selectedCircuit ? [selectedCircuit] : [];
  }, [
    allItems,
    selectedCircuit,
    customer,
    customerView,
    focusedNode,
    visibleItems,
  ]);
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
  const viewPrevious = async () => {
    if (customer) {
      if (!customerView.hasPrevious || splitterLoadingRef.current) {
        return;
      }
      const current = customerView.path[customerView.step].data;
      const sequence = ++splitterRequest.current;
      splitterLoadingRef.current = true;
      setSplitterLoading(true);
      setSplitterError('');
      try {
        const response =
          await circuitConnectivityService.getPreviousSplitterDetails(
            Number(customerField(current, 'splitterId')),
            String(
              customerField(
                current,
                customerView.step === 0
                  ? 'requestSplitterCode'
                  : 'splitterCode',
              ),
            ),
            false,
          );
        if (sequence !== splitterRequest.current) {
          return;
        }
        const match = response.success
          ? previousSplitterMatch(
              response.data,
              customerField(current, 'parentId'),
            )
          : undefined;
        if (!match) {
          setSplitterError(
            response.success
              ? 'No previous splitter matched this splitter’s parent ID.'
              : response.message,
          );
          return;
        }
        setPreviousSplitters([
          ...previousSplitters.slice(0, customerView.step),
          {kind: 'splitter', data: match, previous: true},
        ]);
        setSplitterStep(customerView.step + 1);
        scrollRef.current?.scrollToOffset({offset: 0, animated: true});
      } catch (e: any) {
        if (sequence === splitterRequest.current) {
          setSplitterError(
            e?.message || 'Could not load previous splitter. Try again.',
          );
        }
      } finally {
        if (sequence === splitterRequest.current) {
          splitterLoadingRef.current = false;
          setSplitterLoading(false);
        }
      }
      return;
    }
    if (previousSplitter) {
      setFocusedNode(previousSplitter);
      scrollRef.current?.scrollToOffset({offset: 0, animated: true});
    }
  };
  const splitterActionDisabled = splitterLoading || !customerView.hasPrevious;
  const previousButton = customer && (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="View previous splitter"
      disabled={splitterActionDisabled}
      onPress={viewPrevious}
      style={[
        styles.previousButton,
        splitterActionDisabled && styles.mapButtonDisabled,
      ]}>
      <LinearGradient
        pointerEvents="none"
        colors={['#8A54FA', '#6031D0']}
        style={[StyleSheet.absoluteFill, styles.buttonGradient]}
      />
      {splitterLoading && <ActivityIndicator color="#FFF" />}
      <Text style={styles.retryText}>
        {splitterLoading ? 'Loading connectivity…' : 'View Previous Splitter'}
      </Text>
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
          onPress={goBack}
          style={styles.backButton}>
          <Image source={IMAGES.arrowBack} style={styles.backImage} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {customer ? 'Customer End Connectivity' : 'Infra Connectivity'}
        </Text>
        {selectedCircuit && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={mapVisible ? 'Close map' : 'View map'}
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
        )}
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
            items={mapItems}
            location={activeLocation}
            radius={activeRange ?? 0}
            customer={customer}
          />
        </View>
      ) : (
        <FlatList
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          data={selectedCircuit || loading || error ? [] : circuits}
          keyExtractor={(item, index) => circuitIdOf(item) || String(index)}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          onEndReached={() => loadMore()}
          onEndReachedThreshold={0.4}
          renderItem={({item, index}) => (
            <TouchableOpacity
              key={`${circuitIdOf(item)}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Select circuit ${circuitNameOf(item)}`}
              onPress={() => selectCircuit(item)}
              style={styles.circuitListCard}>
              <View style={styles.circuitListHeader}>
                <Image source={IMAGES.Circuit} style={styles.resultIcon} />
                <Text style={styles.circuitListName}>
                  {circuitNameOf(item)}
                </Text>
              </View>
              <Field
                wide
                label="Connectivity Type"
                value={
                  valueOf(item, 'connectivityType', 'ConnectivityType') ||
                  (customer ? 'Customer End' : 'Infra')
                }
              />
              <Field wide label="Circuit ID" value={circuitIdOf(item)} />
              <View pointerEvents="none" style={styles.circuitListArrow}>
                <Image source={IMAGES.rightarrow} style={styles.listChevron} />
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            !selectedCircuit && circuits.length > 0 && !loading && !error ? (
              <View style={styles.paginationFooter}>
                {loadingMore ? (
                  <>
                    <ActivityIndicator color={PURPLE} />
                    <Text style={styles.stateText}>Loading more circuits…</Text>
                  </>
                ) : pageError ? (
                  <>
                    <Text style={styles.stateText}>{pageError}</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading more circuits"
                      onPress={() => loadMore(true)}
                      style={styles.retryButton}>
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  </>
                ) : hasMore ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Load more circuits"
                    onPress={() => loadMore()}
                    style={styles.retryButton}>
                    <Text style={styles.retryText}>Load more</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.stateText}>All circuits loaded</Text>
                )}
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                if (filterMode === 'nearby') {
                  locate();
                } else {
                  load(true);
                }
              }}
              colors={[PURPLE]}
              tintColor={PURPLE}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.nameSearchBox}>
                <Image source={IMAGES.search} style={styles.searchIcon} />
                <TextInput
                  accessibilityLabel={
                    customer ? 'Search by customer name' : 'Search infra'
                  }
                  value={nameQuery}
                  onChangeText={searchByName}
                  placeholder={
                    customer ? 'Search by customer name' : 'Search infra'
                  }
                  placeholderTextColor="#777D8E"
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={styles.searchInput}
                />
                {!!nameQuery && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Clear name search"
                    onPress={showAll}
                    style={styles.clearSearch}>
                    <Text style={styles.rangeSymbol}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Show all connectivity"
                  accessibilityState={{selected: filterMode === 'all'}}
                  onPress={showAll}
                  style={[
                    styles.filterOption,
                    filterMode === 'all' && styles.activeFilter,
                  ]}>
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterMode === 'all' && styles.activeFilterText,
                    ]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Filter nearby connectivity"
                  accessibilityState={{selected: filterMode === 'nearby'}}
                  disabled={locating}
                  onPress={activateNearby}
                  style={[
                    styles.filterOption,
                    filterMode === 'nearby' && styles.activeFilter,
                  ]}>
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterMode === 'nearby' && styles.activeFilterText,
                    ]}>
                    Nearby
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailsHeading}>
                <Text style={styles.sectionTitle}>
                  {selectedCircuit ? 'Circuit Details' : 'Circuits'}
                </Text>
                <View style={styles.rangeControl}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Decrease location range by 100 metres"
                    disabled={radius <= 100 || locating}
                    onPress={() => changeRadius(-100)}
                    style={styles.rangeButton}>
                    <Text style={styles.rangeSymbol}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.rangeText}>
                    {filterMode === 'nearby' ? `${radius}m` : 'Range'}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Increase location range by 100 metres"
                    disabled={locating}
                    onPress={() => changeRadius(100)}
                    style={styles.rangeButton}>
                    <Text style={styles.rangeSymbol}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {selectedCircuit && (
                <>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Back to circuit list"
                    onPress={returnToCircuitList}
                    style={styles.backToList}>
                    <Image
                      source={IMAGES.arrowBack}
                      style={styles.backToListIcon}
                    />
                    <Text style={styles.backToListText}>
                      Back to circuit list
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.sectionRule} />
                  <Field
                    wide
                    label="Connectivity Type"
                    value={
                      valueOf(
                        selectedCircuit,
                        'connectivityType',
                        'ConnectivityType',
                      ) || (customer ? 'Customer End' : 'Infra')
                    }
                  />
                  <Field
                    wide
                    label="Circuit Name"
                    value={circuitNameOf(selectedCircuit)}
                  />
                  <Field
                    wide
                    label="Circuit ID"
                    value={circuitIdOf(selectedCircuit)}
                  />
                </>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                disabled={locating || filterMode !== 'nearby'}
                onPress={locate}>
                <Text style={styles.locationStatus}>
                  {filterMode === 'nearby'
                    ? locating
                      ? 'Finding current location…'
                      : locationError ||
                        `Within ${radius}m of current location · Refresh location`
                    : filterMode === 'name'
                    ? `Searching ${
                        customer ? 'customers' : 'infra'
                      } across all locations`
                    : 'Showing all company connectivity'}
                </Text>
              </TouchableOpacity>
              {!!error && !!selectedCircuit && (
                <Text style={styles.locationStatus}>{error}</Text>
              )}
              {(focusedNode || (customer && splitterStep > 0)) && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Return to customer connection"
                  onPress={() => {
                    splitterRequest.current++;
                    splitterLoadingRef.current = false;
                    setSplitterLoading(false);
                    setSplitterError('');
                    setFocusedNode(null);
                    setSplitterStep(0);
                  }}>
                  <Text style={styles.locationStatus}>
                    Return to customer connection
                  </Text>
                </TouchableOpacity>
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
                  <Text style={styles.errorTitle}>
                    Circuit details unavailable
                  </Text>
                  <Text style={styles.stateText}>{error}</Text>
                  <TouchableOpacity
                    onPress={() => load()}
                    style={styles.retryButton}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : !selectedCircuit && circuits.length ? null : customer &&
                selectedCircuit ? (
                <View>
                  {customerView.customers.length > 1 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.customerChoices}>
                      {customerView.customers.map((card, index) => (
                        <TouchableOpacity
                          key={index}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose customer connection ${
                            index + 1
                          }`}
                          accessibilityState={{
                            selected: index === customerConnectionIndex,
                          }}
                          onPress={() => {
                            setCustomerConnectionIndex(index);
                            setSplitterStep(0);
                          }}
                          style={[
                            styles.filterOption,
                            index === customerConnectionIndex &&
                              styles.activeFilter,
                          ]}>
                          <Text
                            style={[
                              styles.filterOptionText,
                              index === customerConnectionIndex &&
                                styles.activeFilterText,
                            ]}>
                            {card.data.customerName || `Customer ${index + 1}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  <CustomerConnectivityCards
                    items={allItems}
                    circuit={selectedCircuit}
                    cards={customerView.cards}
                  />
                  {!!splitterError && (
                    <Text style={styles.stateText}>{splitterError}</Text>
                  )}
                  {customerView.missingDetails && (
                    <Text style={styles.stateText}>
                      Only the upstream splitter ID was returned by the API. Its
                      other details are unavailable.
                    </Text>
                  )}
                </View>
              ) : selectedCircuit && visibleItems.length ? (
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
                  <Text style={styles.errorTitle}>
                    No connectivity data found
                  </Text>
                  <Text style={styles.stateText}>
                    {error ||
                      (filterMode === 'nearby'
                        ? locationError ||
                          (locating
                            ? 'Waiting for current location.'
                            : `No data within ${radius}m. Search by ${
                                customer ? 'customer name' : 'infra'
                              } above or increase the range.`)
                        : filterMode === 'name'
                        ? `No matching ${
                            customer ? 'customer' : 'infra'
                          } found. Try a different search.`
                        : `No ${
                            customer ? 'customer end' : 'infra'
                          } connectivity records were returned for this company.`)}
                  </Text>
                </View>
              )}
            </>
          }
        />
      )}
      {customer && selectedCircuit && (
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
  paginationFooter: {alignItems: 'center', paddingVertical: 18, gap: 6},
  circuitList: {paddingTop: 4},
  circuitListCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8EAF0',
    borderRadius: 8,
    padding: 12,
    paddingRight: 38,
    marginBottom: 10,
  },
  circuitListArrow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 12,
    justifyContent: 'center',
  },
  circuitListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  circuitListName: {
    flex: 1,
    fontFamily: FONTS.MEDIUM,
    fontSize: 13,
    color: '#343842',
  },
  listChevron: {
    width: 14,
    height: 14,
    tintColor: PURPLE,
    resizeMode: 'contain',
  },
  backToList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  backToListIcon: {
    width: 18,
    height: 18,
    tintColor: PURPLE,
    resizeMode: 'contain',
  },
  backToListText: {color: PURPLE, fontSize: 12, fontFamily: FONTS.MEDIUM},
  customerChoices: {marginBottom: 10},
  nameSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#E9EAF0',
  },
  clearSearch: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptions: {flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4},
  filterOption: {
    paddingHorizontal: 16,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E4DFEF',
  },
  activeFilter: {backgroundColor: PURPLE, borderColor: PURPLE},
  filterOptionText: {fontSize: 12, color: '#515663'},
  activeFilterText: {color: '#FFF'},
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
    maxHeight: 240,
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
  masterCell: {width: SIZE.MS(170)},
  masterDetailsCell: {
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MVS(7),
    gap: SIZE.MVS(4),
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: '#D9E0EB',
  },
  masterDetailLabel: {
    fontFamily: FONTS.MEDIUM,
    color: '#656B78',
  },
  masterDetailValue: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(10),
    lineHeight: SIZE.MVS(14),
    color: '#343842',
  },
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
