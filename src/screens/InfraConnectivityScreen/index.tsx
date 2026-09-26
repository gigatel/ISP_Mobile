import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
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

const PURPLE = '#7B4AEE';

const SAMPLE_CIRCUITS = [
  {
    circuitId: 'CIR/Infra/26-27/5',
    circuitName: 'F-15 to 48EOK',
    connectivityType: 'Infra',
  },
];

const SAMPLE_ROUTES = [1, 2, 3].map(index => ({
  id: String(index),
  infraType: 'Route',
  routeName: '(OGIG-5U) In front of D70 to AAGN & Associates LLP',
  fromMaster: '(Enclosure) D-70A',
  toMaster: '(Enclosure) AAGN',
}));

const SAMPLE_INFRA = [
  {
    id: 'switch-1',
    infraType: 'Switch',
    area: 'Kalkaji',
    popName: '(Pop) Kalkaji 2nd Floor',
    switchName: '(87) kalkaji-2ndf-mpls',
    port: 'GigabitEthernet0/0/14',
    rackName: 'Kalkaji metro 2nd Floor',
    rackPosition: '05',
    connectionType: 'LAN',
    remarks: 'This is a testing remarks',
    latitude: 28.5409,
    longitude: 77.2593,
    routeList: SAMPLE_ROUTES,
  },
  {
    id: 'switch-2',
    infraType: 'Switch',
    area: 'Kalkaji',
    popName: '(Pop) Kalkaji 2nd Floor',
    switchName: '(87) kalkaji-2ndf-mpls',
    port: 'GigabitEthernet0/0/14',
    rackName: 'Kalkaji metro 2nd Floor',
    rackPosition: '05',
    connectionType: 'LAN',
    remarks: 'This is a testing remarks',
    latitude: 28.5409,
    longitude: 77.2593,
    routeList: SAMPLE_ROUTES,
  },
];

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
  String(valueOf(item, 'circuitId', 'CircuitId', 'circuitID', 'id', 'Id'));

const circuitNameOf = (item: any) =>
  display(valueOf(item, 'circuitName', 'CircuitName', 'name', 'Name'));

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
              {display(
                valueOf(
                  row,
                  'routeName',
                  'RouteName',
                  'routeId',
                  'RouteId',
                  'routeID',
                ),
              )}
            </Text>
            <Text style={[styles.bodyCell, styles.masterCell]}>
              {display(
                valueOf(
                  row,
                  'fromMaster',
                  'FromMaster',
                  'startChamber',
                  'StartChamber',
                ),
              )}
            </Text>
            <Text style={[styles.bodyCell, styles.masterCell]}>
              {display(
                valueOf(
                  row,
                  'toMaster',
                  'ToMaster',
                  'endChamber',
                  'EndChamber',
                ),
              )}
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
        value={valueOf(item, 'area', 'Area', 'location', 'Location')}
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
      label="Switch Name"
      value={valueOf(item, 'switchName', 'SwitchName', 'deviceName')}
    />
    <Field
      wide
      label="Port"
      value={valueOf(item, 'port', 'Port', 'portName', 'PortName')}
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
        value={valueOf(item, 'connectionType', 'ConnectionType', 'lanType')}
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
  const initialCircuit = route?.params?.initialCircuit;
  const [circuits, setCircuits] = useState<any[]>(
    initialCircuit ? [initialCircuit, ...SAMPLE_CIRCUITS] : SAMPLE_CIRCUITS,
  );
  const [selectedCircuit, setSelectedCircuit] = useState<any>(
    initialCircuit ?? SAMPLE_CIRCUITS[0],
  );
  const [infraItems, setInfraItems] = useState<any[]>(SAMPLE_INFRA);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadInfra = useCallback((_circuit: any) => {
    setInfraItems(SAMPLE_INFRA);
  }, []);

  const load = useCallback(
    (refresh = false) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError('');
      const list = initialCircuit
        ? [initialCircuit, ...SAMPLE_CIRCUITS]
        : SAMPLE_CIRCUITS;
      setCircuits(list);
      const next = selectedCircuit ?? initialCircuit ?? list[0];
      setSelectedCircuit(next);
      loadInfra(next);
      requestAnimationFrame(() => {
        setLoading(false);
        setRefreshing(false);
      });
    },
    [initialCircuit, loadInfra, selectedCircuit],
  );

  useEffect(() => {
    load();
    // This screen intentionally loads once for the customer passed by navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchingCircuits = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return [];
    }
    return circuits.filter(item =>
      `${circuitNameOf(item)} ${circuitIdOf(item)}`
        .toLowerCase()
        .includes(search),
    );
  }, [circuits, query]);

  const selectCircuit = (circuit: any) => {
    setSelectedCircuit(circuit);
    setQuery('');
    setLoading(true);
    setError('');
    loadInfra(circuit);
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

  const openMap = () => {
    const mapItem = infraItems[0] ?? selectedCircuit ?? {};
    const latitude = Number(
      valueOf(mapItem, 'latitude', 'Latitude', 'lat', 'Lat'),
    );
    const longitude = Number(
      valueOf(mapItem, 'longitude', 'Longitude', 'lng', 'Lng', 'long'),
    );
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      navigation.navigate('MapViewScreen', {
        latitude,
        longitude,
        title: circuitNameOf(selectedCircuit),
      });
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#814CF3', '#5B25D6']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={[styles.header, {paddingTop: insets.top}]}>
        <TouchableOpacity onPress={navigation.goBack} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Infra Connectivity</Text>
      </LinearGradient>

      <ScrollView
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
          <TouchableOpacity
            disabled={!infraItems.length}
            onPress={openMap}
            style={[
              styles.mapButton,
              !infraItems.length && styles.mapButtonDisabled,
            ]}>
            <Text style={styles.mapButtonText}>Map View</Text>
          </TouchableOpacity>
        </View>

        {!!query.trim() && (
          <View style={styles.searchResults}>
            {matchingCircuits.map(item => (
              <TouchableOpacity
                key={circuitIdOf(item)}
                onPress={() => selectCircuit(item)}
                style={styles.circuitResult}>
                <Image source={IMAGES.Circuit} style={styles.resultIcon} />
                <View style={styles.resultCopy}>
                  <Text style={styles.resultTitle}>{circuitNameOf(item)}</Text>
                  <Text style={styles.resultSubtitle}>{circuitIdOf(item)}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {!matchingCircuits.length && (
              <Text style={styles.noMatch}>No matching circuit found.</Text>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Circuit Details</Text>
        <View style={styles.sectionRule} />
        <Field
          wide
          label="Connectivity Type"
          value={valueOf(
            selectedCircuit,
            'connectivityType',
            'ConnectivityType',
            'type',
          )}
        />
        <Field
          wide
          label="Circuit Name"
          value={circuitNameOf(selectedCircuit)}
        />
        <Field wide label="Circuit ID" value={circuitIdOf(selectedCircuit)} />

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={PURPLE} />
            <Text style={styles.stateText}>Loading circuit connectivity…</Text>
          </View>
        ) : error && !selectedCircuit ? (
          <View style={styles.loadingState}>
            <Text style={styles.errorTitle}>Circuit details unavailable</Text>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : infraItems.length ? (
          infraItems.map((item, index) => (
            <View
              key={`${index}-${display(
                valueOf(item, 'id', 'Id', 'chamberId'),
              )}`}>
              <RouteTable rows={routeRowsFor(item)} />
              <View style={styles.connector} />
              <InfraCard item={item} />
            </View>
          ))
        ) : defaultRows.length ? (
          <RouteTable rows={defaultRows} />
        ) : (
          <View style={styles.emptyState}>
            <Image source={IMAGES.Circuit} style={styles.emptyIcon} />
            <Text style={styles.errorTitle}>No connectivity data found</Text>
            <Text style={styles.stateText}>
              {error || 'There are no infrastructure records for this circuit.'}
            </Text>
          </View>
        )}
      </ScrollView>
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
  screen: {flex: 1, backgroundColor: '#F3F5F9'},
  header: {
    minHeight: SIZE.MVS(98),
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SIZE.MS(12),
    paddingBottom: SIZE.MVS(18),
  },
  backButton: {
    width: SIZE.MS(34),
    height: SIZE.MS(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {fontSize: SIZE.MS(34), lineHeight: SIZE.MS(34), color: '#FFF'},
  headerTitle: {
    color: '#FFF',
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(18),
    marginBottom: 4,
  },
  scroll: {flex: 1},
  content: {padding: SIZE.MS(16), paddingBottom: SIZE.MVS(36)},
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
    ...shadow,
    minHeight: SIZE.MVS(48),
    justifyContent: 'center',
    backgroundColor: PURPLE,
    borderRadius: SIZE.MS(9),
    paddingHorizontal: SIZE.MS(15),
  },
  mapButtonDisabled: {opacity: 0.5},
  mapButtonText: {
    color: '#FFF',
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(12),
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
    marginTop: SIZE.MVS(16),
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
    marginTop: SIZE.MVS(10),
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
  serialCell: {width: SIZE.MS(43), textAlign: 'center'},
  typeCell: {width: SIZE.MS(78)},
  routeCell: {width: SIZE.MS(165)},
  masterCell: {width: SIZE.MS(150)},
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
