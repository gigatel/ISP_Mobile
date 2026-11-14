import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE, Region} from 'react-native-maps';
import {useSelector} from 'react-redux';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigations/navigator';
import type {RootState} from '../store/reducers';
import BackHeader from '../components/molecules/back-header';
import {COLORS, FONTS} from '@res';
import {
  OnuCustomer,
  parseLatLng,
  selectOffline,
} from '../features/onuOffline/model';
import {
  groupOnuMarkers,
  onuMapLocations,
} from '../features/onuOffline/mapMarkers';
import {
  ONU_EVENT,
  ONU_HUB_URL,
  retryOnuConnection,
} from '../services/onuOfflineSignalR';
import {logOnuDebug} from '../services/onuOfflineDiagnostics';
import CustomerListCard from '../features/onuOffline/CustomerListCard';

export function formatOnuDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return 'Not available';
  }
  return `${new Date(value).toLocaleString()} (local time)`;
}
const Field = ({label, value}: {label: string; value?: string}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Text selectable style={styles.value}>
      {value || '—'}
    </Text>
  </View>
);
const CustomerFields = ({
  customer,
  full = false,
}: {
  customer: OnuCustomer;
  full?: boolean;
}) => {
  const coordinates = parseLatLng(customer.LatLng);
  return (
    <>
      <Field label="Customer ID" value={customer.CustomerId} />
      <Field label="Mobile" value={customer.MobNo} />
      <Field label="Address" value={customer.Address} />
      <Field label="MAC address" value={customer.MACAddress} />
      <Field label="GenieACS device ID" value={customer.GenieAcsDeviceId} />
      <Field
        label="Last inform"
        value={formatOnuDate(customer.LastInformUtc)}
      />
      {full && (
        <>
          <Field label="Last inform UTC" value={customer.LastInformUtc} />
          <Field
            label="Latitude"
            value={coordinates ? String(coordinates.latitude) : undefined}
          />
          <Field
            label="Longitude"
            value={coordinates ? String(coordinates.longitude) : undefined}
          />
          <Field label="Organization ID" value={customer.OrganizationId} />
          <Field label="Server ID" value={customer.ServerId} />
        </>
      )}
    </>
  );
};
const Button = ({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{disabled}}
    disabled={disabled}
    onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{title}</Text>
  </TouchableOpacity>
);
export default function OnuOfflineCustomersScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'OnuOfflineCustomers'>) {
  const state = useSelector((root: RootState) => root.onuOffline);
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [ready, setReady] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const map = useRef<MapView>(null);
  const fitted = useRef(false);
  const explored = useRef(false);
  const region = useRef<Region | null>(null);
  const all = useMemo(() => selectOffline(state.records), [state.records]);
  const screenDiagnostics = useRef<Record<string, unknown>>({});
  screenDiagnostics.current = {
    hubUrl: ONU_HUB_URL,
    event: ONU_EVENT,
    connectionStatus: state.status,
    knownOfflineCustomers: all.length,
    lastUpdateReceivedAt: state.receivedAt,
    waitingForLiveData: !state.receivedAt,
    error: state.error,
    note: 'This is a shared session connection. Opening this screen does not issue a new HTTP request. Live responses are logged when the hub broadcasts an update.',
  };
  useFocusEffect(
    useCallback(() => {
      logOnuDebug('Screen opened', screenDiagnostics.current);
    }, []),
  );

  const filtered = useMemo(
    () => selectOffline(state.records, query),
    [state.records, query],
  );
  const locations = useMemo(() => onuMapLocations(filtered), [filtered]);
  const [deltas, setDeltas] = useState({latitudeDelta: 30, longitudeDelta: 30});
  const [clusterKeys, setClusterKeys] = useState<string[]>([]);
  const markers = useMemo(
    () =>
      groupOnuMarkers(locations, deltas.latitudeDelta, deltas.longitudeDelta),
    [locations, deltas],
  );
  const clusterCustomers = clusterKeys
    .map(key => state.records[key])
    .filter(customer => customer && !customer.IsOnline);
  const selected = selectedKey ? state.records[selectedKey] : undefined;
  const fitAll = () => {
    if (!locations.length || !map.current) {
      return;
    }
    map.current.fitToCoordinates(
      locations.map(item => item.coordinate),
      {
        edgePadding: {top: 60, bottom: 160, left: 45, right: 45},
        animated: true,
      },
    );
    fitted.current = true;
  };
  useEffect(() => {
    if (
      ready &&
      locations.length &&
      !fitted.current &&
      !explored.current &&
      !focusKey
    ) {
      fitAll();
    }
    // Live updates must never interrupt a user who is exploring the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, locations]);
  useEffect(() => {
    const coordinate = focusKey
      ? parseLatLng(state.records[focusKey]?.LatLng)
      : null;
    if (ready && view === 'map' && coordinate) {
      map.current?.animateToRegion(
        {...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008},
        400,
      );
      fitted.current = true;
      setFocusKey(null);
    }
  }, [ready, view, focusKey, state.records]);
  const focus = (customer: OnuCustomer) => {
    setClusterKeys([]);
    setSelectedKey(customer.key);
    setDetails(false);
    setQuery('');
    setFocusKey(customer.key);
    setView('map');
  };
  const zoom = (factor: number) => {
    if (!region.current) {
      return;
    }
    explored.current = true;
    map.current?.animateToRegion(
      {
        ...region.current,
        latitudeDelta: Math.min(
          170,
          Math.max(0.0005, region.current.latitudeDelta * factor),
        ),
        longitudeDelta: Math.min(
          350,
          Math.max(0.0005, region.current.longitudeDelta * factor),
        ),
      },
      250,
    );
  };
  const waiting = !state.receivedAt;
  const emptyMessage = query
    ? 'No customers match your search.'
    : 'No known offline customers.';

  return (
    <View style={[styles.screen, {paddingBottom: insets.bottom}]}>
      <BackHeader
        title="ONU Offline Customers"
        onBackPress={() => navigation.goBack()}
        showGps={false}
      />
      <View style={styles.toolbar}>
        <View style={styles.row}>
          <Text style={styles.title}>
            {waiting
              ? 'Offline customers'
              : `${all.length} offline ${
                  all.length === 1 ? 'customer' : 'customers'
                }`}
          </Text>
          <Text style={styles.connection}>● {state.status}</Text>
        </View>
        <Text style={styles.hint}>
          {state.receivedAt
            ? `Last update: ${formatOnuDate(state.receivedAt)}`
            : 'Waiting for the first live update'}
        </Text>
        {/* <Text style={styles.hint}>
          Records are retained until the backend explicitly reports a status
          change.
        </Text> */}
        {state.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {state.error}
          </Text>
        )}
        {!waiting && ['connecting', 'reconnecting'].includes(state.status) && (
          <ActivityIndicator color={COLORS.PRIMARY} />
        )}
        <TextInput
          accessibilityLabel="Search offline customers"
          placeholder="Search name, ID, mobile or MAC"
          placeholderTextColor={COLORS.TEXT_MEDIUM}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.row}>
          {(['list', 'map'] as const).map(option => (
            <TouchableOpacity
              key={option}
              accessibilityRole="tab"
              accessibilityState={{selected: view === option}}
              style={[styles.tab, view === option && styles.activeTab]}
              onPress={() => {
                if (option === 'list') {
                  setReady(false);
                }
                setView(option);
              }}>
              <Text
                style={view === option ? styles.activeText : styles.tabText}>
                {option === 'list' ? 'List View' : 'Map View'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {state.status !== 'connected' && (
          <Button title="Retry connection" onPress={retryOnuConnection} />
        )}
      </View>
      {waiting ? (
        <View style={styles.loadingState} accessibilityLiveRegion="polite">
          <ActivityIndicator
            size="large"
            color={COLORS.PRIMARY}
            accessibilityRole="progressbar"
            accessibilityLabel="Loading offline customers"
          />
          <Text style={styles.loadingTitle}>Loading offline customers…</Text>
          <Text style={styles.loadingHint}>
            Waiting for live customer data. This screen will update
            automatically.
          </Text>
        </View>
      ) : view === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
          ListHeaderComponent={
            filtered.length > 0 ? (
              <View style={styles.listSummary}>
                <Text style={styles.listSummaryTitle}>
                  {filtered.length}{' '}
                  {filtered.length === 1 ? 'customer' : 'customers'}
                  {query.trim() ? ` of ${all.length}` : ''}
                </Text>
                <Text style={styles.hint}>Sorted by last inform</Text>
              </View>
            ) : null
          }
          renderItem={({item}) => (
            <CustomerListCard
              customer={item}
              lastInform={formatOnuDate(item.LastInformUtc)}
              onOpen={() => {
                setSelectedKey(item.key);
                setDetails(true);
              }}
              onMap={() => focus(item)}
            />
          )}
        />
      ) : (
        <View style={styles.mapArea}>
          <MapView
            ref={map}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={
              region.current ?? {
                latitude: 22,
                longitude: 79,
                latitudeDelta: 30,
                longitudeDelta: 30,
              }
            }
            zoomControlEnabled={false}
            userInterfaceStyle="light"
            onMapReady={() => setReady(true)}
            onPanDrag={() => {
              explored.current = true;
            }}
            onRegionChangeComplete={(value, gesture) => {
              if (gesture?.isGesture) {
                explored.current = true;
              }
              region.current = value;
              setDeltas({
                latitudeDelta: value.latitudeDelta,
                longitudeDelta: value.longitudeDelta,
              });
            }}>
            {markers.map(group => (
              <Marker
                key={group.key}
                identifier={group.key}
                coordinate={group.coordinate}
                anchor={{x: 0.5, y: 0.5}}
                title={
                  group.items.length === 1
                    ? group.items[0].customer.CustomerName ||
                      `Customer ${group.items[0].customer.CustomerId}`
                    : `${group.items.length} offline customers`
                }
                onPress={() => {
                  if (group.items.length === 1) {
                    setSelectedKey(group.items[0].customer.key);
                    setClusterKeys([]);
                  } else {
                    setSelectedKey(null);
                    setClusterKeys(group.items.map(item => item.customer.key));
                    map.current?.animateToRegion(
                      {
                        ...group.coordinate,
                        latitudeDelta: Math.max(
                          deltas.latitudeDelta / 3,
                          0.0005,
                        ),
                        longitudeDelta: Math.max(
                          deltas.longitudeDelta / 3,
                          0.0005,
                        ),
                      },
                      350,
                    );
                  }
                }}>
                {group.items.length > 1 ? (
                  <View style={styles.cluster}>
                    <Text style={styles.activeText}>{group.items.length}</Text>
                  </View>
                ) : (
                  <View collapsable={false} style={styles.customerMarker}>
                    <View
                      style={styles.customerMarkerIcon}
                      pointerEvents="none">
                      <View style={styles.customerMarkerHead} />
                      <View style={styles.customerMarkerShoulders} />
                    </View>
                  </View>
                )}
              </Marker>
            ))}
          </MapView>
          <View style={styles.mapControls}>
            <Button
              title="Fit all"
              disabled={!locations.length}
              onPress={fitAll}
            />
            <Button title="Zoom +" onPress={() => zoom(0.5)} />
            <Button title="Zoom −" onPress={() => zoom(2)} />
          </View>
          <Text style={styles.mapHint}>
            {locations.length} mapped • {filtered.length - locations.length}{' '}
            without valid location
          </Text>
          {!locations.length && (
            <Text style={styles.emptyMap}>
              {filtered.length
                ? 'These customers have no valid locations.'
                : emptyMessage}
            </Text>
          )}
          {clusterCustomers.length > 0 && (
            <View style={[styles.preview, styles.clusterPreview]}>
              <View style={styles.row}>
                <Text style={styles.name}>
                  {clusterCustomers.length} offline customers
                </Text>
                <Button title="Close" onPress={() => setClusterKeys([])} />
              </View>
              <ScrollView>
                {clusterCustomers.map(customer => (
                  <TouchableOpacity
                    key={customer.key}
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedKey(customer.key);
                      setClusterKeys([]);
                    }}
                    style={styles.field}>
                    <Text style={styles.link}>
                      {customer.CustomerName ||
                        `Customer ${customer.CustomerId}`}{' '}
                      • {customer.CustomerId} ›
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {selected && !selected.IsOnline && (
            <View style={[styles.preview, styles.customerPreview]}>
              <View style={styles.row}>
                <Text style={styles.name}>
                  {selected.CustomerName || `Customer ${selected.CustomerId}`}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close selected customer"
                  onPress={() => setSelectedKey(null)}>
                  <Text style={styles.link}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.offline}>
                ● OFFLINE • ID {selected.CustomerId}
              </Text>
              <ScrollView>
                <CustomerFields customer={selected} />
              </ScrollView>
              <Button
                title="Full customer details ›"
                onPress={() => setDetails(true)}
              />
            </View>
          )}
        </View>
      )}
      <Modal
        visible={details && !!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setDetails(false)}>
        <View style={styles.overlay}>
          <View
            style={[styles.sheet, {paddingBottom: Math.max(insets.bottom, 16)}]}
            accessibilityViewIsModal>
            <View style={styles.row}>
              <Text style={styles.title}>Customer details</Text>
              <Button title="Close" onPress={() => setDetails(false)} />
            </View>
            <ScrollView>
              {selected && (
                <>
                  <Text style={styles.name}>
                    {selected.CustomerName || 'Unnamed customer'}
                  </Text>
                  <Text
                    style={selected.IsOnline ? styles.link : styles.offline}>
                    {selected.Status}
                  </Text>
                  <CustomerFields customer={selected} full />
                  <Button
                    title="View Location on Map"
                    disabled={
                      !parseLatLng(selected.LatLng) || selected.IsOnline
                    }
                    onPress={() => focus(selected)}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY},
  toolbar: {padding: 16, gap: 8, backgroundColor: COLORS.WHITE},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_DARKER,
    fontSize: 18,
    flexShrink: 1,
  },
  connection: {
    fontSize: 12,
    color: COLORS.PRIMARY_MEDIUM,
    textTransform: 'capitalize',
  },
  hint: {fontSize: 12, color: COLORS.TEXT_MEDIUM, lineHeight: 18},
  error: {color: COLORS.ERROR, fontSize: 13},
  search: {
    borderWidth: 1,
    borderColor: COLORS.BORDER_DEFAULT,
    borderRadius: 12,
    padding: 12,
    color: COLORS.TEXT_DARKER,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    alignItems: 'center',
  },
  activeTab: {backgroundColor: COLORS.PRIMARY},
  activeText: {color: COLORS.WHITE, fontFamily: FONTS.SEMI_BOLD},
  tabText: {color: COLORS.PRIMARY_MEDIUM},
  list: {padding: 16, flexGrow: 1},
  listSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  listSummaryTitle: {
    flexShrink: 1,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 13,
    color: COLORS.TEXT_DARK,
  },
  name: {
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_DARKER,
    fontSize: 16,
    flexShrink: 1,
  },
  offline: {color: COLORS.ERROR, fontSize: 12, fontFamily: FONTS.SEMI_BOLD},
  field: {marginTop: 9},
  label: {fontSize: 11, color: COLORS.TEXT_MEDIUM},
  value: {fontSize: 14, color: COLORS.TEXT_DARKER, marginTop: 2},
  link: {
    color: COLORS.PRIMARY_MEDIUM,
    marginTop: 8,
    fontFamily: FONTS.SEMI_BOLD,
  },
  button: {
    backgroundColor: '#F0E8FF',
    padding: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {color: COLORS.PRIMARY_MEDIUM, fontFamily: FONTS.SEMI_BOLD},
  disabled: {opacity: 0.45},
  empty: {padding: 32, color: COLORS.TEXT_MEDIUM, textAlign: 'center'},
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  loadingTitle: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 16,
    color: COLORS.TEXT_DARKER,
    textAlign: 'center',
  },
  loadingHint: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.TEXT_MEDIUM,
    textAlign: 'center',
  },
  customerMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.ERROR,
    borderWidth: 3,
    borderColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Native shapes render in the marker's first snapshot without waiting for an image.
  customerMarkerIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  customerMarkerHead: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.WHITE,
  },
  customerMarkerShoulders: {
    width: 20,
    height: 11,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: COLORS.WHITE,
  },
  cluster: {
    backgroundColor: COLORS.ERROR,
    borderColor: COLORS.WHITE,
    borderWidth: 2,
    borderRadius: 24,
    minWidth: 42,
    height: 42,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapArea: {flex: 1},
  mapControls: {position: 'absolute', top: 12, right: 12, gap: 8},
  mapHint: {
    position: 'absolute',
    top: 12,
    left: 10,
    backgroundColor: COLORS.WHITE,
    padding: 8,
    borderRadius: 8,
    fontSize: 11,
    maxWidth: '65%',
    color: COLORS.TEXT_DARK,
  },
  emptyMap: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: COLORS.WHITE,
    padding: 14,
    marginHorizontal: 20,
    borderRadius: 12,
    color: COLORS.TEXT_MEDIUM,
  },
  clusterPreview: {maxHeight: '45%'},
  customerPreview: {maxHeight: '55%'},
  preview: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    padding: 16,
    gap: 8,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
  },
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066'},
  sheet: {
    backgroundColor: COLORS.WHITE,
    maxHeight: '85%',
    padding: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 12,
  },
});
