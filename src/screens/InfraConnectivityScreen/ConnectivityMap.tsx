import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {circuitConnectivityService} from '../../services/circuitConnectivityService';
import {
  buildConnectivityMapData,
  routeFiberIdsOf,
  RouteMasters,
  MapNode,
} from './mapData';
import {MasterMapIcon} from './ConnectivityIcons';
import {MARKER_META, markerKindOf, markerDetailRows} from './markerDetails';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MapView, {Circle, Marker, Polyline} from 'react-native-maps';
import {Coordinate} from './connectivity';

export default function ConnectivityMap({
  items,
  location,
  radius,
  customer,
}: {
  items: any[];
  location: Coordinate | null;
  radius: number;
  customer: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const dismissDetails = () => {
    setSelectedKey(null);
    setSelectedKeys([]);
  };
  const ref = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [routeMasters, setRouteMasters] = useState<RouteMasters[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [masterError, setMasterError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const ids = routeFiberIdsOf(items);
    setRouteMasters([]);
    setMasterError('');
    setLoadingMasters(ids.length > 0);
    const loadMasters = async () => {
      const groups: RouteMasters[] = [];
      let failed = 0;
      // Limit concurrent calls when multiple nearby circuits share many routes.
      for (let index = 0; index < ids.length; index += 4) {
        if (cancelled) {
          return;
        }
        const batch = await Promise.all(
          ids.slice(index, index + 4).map(async routeFiberId => ({
            routeFiberId,
            response:
              await circuitConnectivityService.getMasterDetailsByRouteFiberId(
                routeFiberId,
              ),
          })),
        );
        if (cancelled) {
          return;
        }
        batch.forEach(({routeFiberId, response}) => {
          if (response.success) {
            groups.push({routeFiberId, masters: response.data});
          } else {
            failed++;
          }
        });
        setRouteMasters([...groups]);
      }
      if (!cancelled) {
        setLoadingMasters(false);
        setMasterError(
          failed
            ? `Could not load masters for ${failed} route${
                failed === 1 ? '' : 's'
              }.`
            : '',
        );
      }
    };
    loadMasters();
    return () => {
      cancelled = true;
    };
  }, [items, retry]);
  const {nodes, paths} = useMemo(
    () => buildConnectivityMapData(items, routeMasters),
    [items, routeMasters],
  );
  const selectedNode = nodes.find(node => node.key === selectedKey);
  const selectedCluster = nodes.filter(node => selectedKeys.includes(node.key));
  const markerGroups = useMemo(() => {
    const groups = new Map<string, MapNode[]>();
    nodes.forEach(node => {
      const key = `${node.coordinate.latitude},${node.coordinate.longitude}`;
      groups.set(key, [...(groups.get(key) || []), node]);
    });
    return [...groups.values()];
  }, [nodes]);
  const legendKinds = [...new Set(nodes.map(node => markerKindOf(node.type)))];
  const coordinates = useMemo(() => {
    const points = [
      ...nodes.map(node => node.coordinate),
      ...paths.flatMap(path => path.coordinates),
    ];
    if (location && !customer) {
      const latitudeOffset = radius / 111320;
      const longitudeOffset =
        radius /
        (111320 *
          Math.max(0.01, Math.cos((location.latitude * Math.PI) / 180)));
      points.push(
        location,
        {
          latitude: location.latitude + latitudeOffset,
          longitude: location.longitude + longitudeOffset,
        },
        {
          latitude: location.latitude - latitudeOffset,
          longitude: location.longitude - longitudeOffset,
        },
      );
    }
    return points;
  }, [nodes, paths, location, customer, radius]);
  useEffect(() => {
    if (ready && coordinates.length) {
      ref.current?.fitToCoordinates(coordinates, {
        edgePadding: {top: 50, right: 40, bottom: 50, left: 40},
        animated: true,
      });
    }
  }, [coordinates, ready, radius]);
  const center = coordinates[0];
  if (!center) {
    return (
      <View style={styles.empty}>
        {loadingMasters ? (
          <>
            <ActivityIndicator color="#8051EE" />
            <Text>Loading route masters…</Text>
          </>
        ) : (
          <Text>No map coordinates available for this connectivity.</Text>
        )}
        {!!masterError && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setRetry(value => value + 1)}>
            <Text>{masterError} Tap to retry.</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return (
    <View style={styles.frame}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        onMapReady={() => setReady(true)}
        showsUserLocation={!!location}
        initialRegion={{
          ...center,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}>
        {location && !customer && (
          <Circle
            center={location}
            radius={radius}
            strokeColor="#8752F180"
            fillColor="#8752F108"
          />
        )}
        {paths.map((path, index) => (
          <Polyline
            key={path.key}
            coordinates={path.coordinates}
            strokeColor={
              customer ? '#3869FF' : index % 2 ? '#C94BCD' : '#5278FF'
            }
            strokeWidth={3}
          />
        ))}
        {markerGroups.map(group => (
          <Marker
            key={group.map(node => node.key).join('|')}
            coordinate={group[0].coordinate}
            anchor={{x: 0.5, y: 0.5}}
            accessibilityLabel={group
              .map(
                node =>
                  `${MARKER_META[markerKindOf(node.type)].label}: ${
                    node.title
                  }`,
              )
              .join('; ')}
            onPress={event => {
              event.stopPropagation();
              if (group.length === 1) {
                setSelectedKeys([]);
                setSelectedKey(group[0].key);
              } else {
                setSelectedKey(null);
                setSelectedKeys(group.map(node => node.key));
              }
            }}
            zIndex={
              group.some(node => node.key === selectedKey)
                ? 10
                : group.every(node => markerKindOf(node.type) === 'point')
                ? 1
                : 2
            }>
            <View collapsable={false} style={styles.markerGroup}>
              {group.slice(0, 3).map(node => (
                <View
                  key={node.key}
                  style={[
                    styles.pin,
                    {
                      backgroundColor:
                        MARKER_META[markerKindOf(node.type)].color,
                    },
                    selectedKey === node.key && styles.selectedPin,
                  ]}>
                  <MasterMapIcon type={node.type} />
                </View>
              ))}
              {group.length > 3 && (
                <View style={styles.morePin}>
                  <Text style={styles.morePinText}>+{group.length - 3}</Text>
                </View>
              )}
            </View>
          </Marker>
        ))}
      </MapView>
      <View style={styles.topOverlay}>
        {!!legendKinds.length && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.legend}
            contentContainerStyle={styles.legendContent}>
            {legendKinds.map(kind => (
              <View key={kind} style={styles.legendItem}>
                <MasterMapIcon
                  type={kind}
                  size={18}
                  color={MARKER_META[kind].color}
                />
                <Text style={styles.legendText}>{MARKER_META[kind].label}</Text>
              </View>
            ))}
          </ScrollView>
        )}
        {loadingMasters && (
          <View style={styles.loadingNotice}>
            <ActivityIndicator color="#8051EE" />
            <Text>Loading route masters…</Text>
          </View>
        )}
      </View>
      <Modal
        visible={!!selectedNode || selectedCluster.length > 0}
        transparent
        animationType="slide"
        onRequestClose={dismissDetails}>
        <View style={styles.modalRoot}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Dismiss master details"
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={dismissDetails}
          />
          {!selectedNode && selectedCluster.length > 0 && (
            <View
              style={[
                styles.detailsSheet,
                {paddingBottom: Math.max(insets.bottom, 16)},
              ]}>
              <View style={styles.detailsHeader}>
                <View style={styles.detailTitleCopy}>
                  <Text style={styles.detailTitle}>
                    Masters at this location
                  </Text>
                  <Text style={styles.detailKind}>
                    Select a master to view its details
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close master details"
                  style={styles.closeDetails}
                  onPress={dismissDetails}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.detailRows}>
                {selectedCluster.map(node => (
                  <TouchableOpacity
                    key={node.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Show details for ${node.title}`}
                    style={styles.clusterOption}
                    onPress={() => {
                      setSelectedKeys([]);
                      setSelectedKey(node.key);
                    }}>
                    <View
                      style={[
                        styles.detailIcon,
                        {
                          backgroundColor:
                            MARKER_META[markerKindOf(node.type)].color,
                        },
                      ]}>
                      <MasterMapIcon type={node.type} />
                    </View>
                    <View style={styles.detailTitleCopy}>
                      <Text style={styles.detailKind}>
                        {MARKER_META[markerKindOf(node.type)].label}
                      </Text>
                      <Text style={styles.detailTitle}>{node.title}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {selectedNode && (
            <View
              style={[
                styles.detailsSheet,
                {paddingBottom: Math.max(insets.bottom, 16)},
              ]}>
              <View style={styles.detailsHeader}>
                <View
                  style={[
                    styles.detailIcon,
                    {
                      backgroundColor:
                        MARKER_META[markerKindOf(selectedNode.type)].color,
                    },
                  ]}>
                  <MasterMapIcon type={selectedNode.type} />
                </View>
                <View style={styles.detailTitleCopy}>
                  <Text style={styles.detailKind}>
                    {MARKER_META[markerKindOf(selectedNode.type)].label} details
                  </Text>
                  <Text style={styles.detailTitle}>{selectedNode.title}</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close master details"
                  style={styles.closeDetails}
                  onPress={dismissDetails}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator
                contentContainerStyle={styles.detailRows}>
                {markerDetailRows(selectedNode).map(row => (
                  <View key={row.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    <Text selectable style={styles.detailValue}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
      {!!masterError && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setRetry(value => value + 1)}
          style={styles.notice}>
          <Text>{masterError} Tap to retry.</Text>
        </TouchableOpacity>
      )}
      {!nodes.length && !loadingMasters && !masterError && (
        <View style={styles.notice}>
          <Text>No coordinates returned for the nearby records.</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  markerGroup: {flexDirection: 'row', alignItems: 'center', gap: 3},
  morePin: {
    height: 32,
    minWidth: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePinText: {fontSize: 11, fontWeight: '600', color: '#343842'},
  clusterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECEEF3',
  },
  topOverlay: {position: 'absolute', top: 12, left: 12, right: 12, gap: 6},
  legend: {backgroundColor: '#FFF', borderRadius: 6},
  legendContent: {paddingHorizontal: 10, paddingVertical: 8, gap: 14},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  legendText: {fontSize: 11, color: '#343842'},
  selectedPin: {borderColor: '#211148', borderWidth: 3},
  modalRoot: {flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006'},
  detailsSheet: {
    maxHeight: '70%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 16,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF3',
    gap: 10,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitleCopy: {flex: 1},
  detailKind: {fontSize: 11, color: '#7A7189', marginBottom: 3},
  detailTitle: {fontSize: 15, fontWeight: '600', color: '#303342'},
  closeDetails: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {fontSize: 28, color: '#575D6A'},
  detailRows: {paddingHorizontal: 16},
  detailRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECEEF3',
    paddingVertical: 10,
    gap: 12,
  },
  detailLabel: {width: '35%', fontSize: 12, color: '#707585'},
  detailValue: {flex: 1, fontSize: 12, lineHeight: 18, color: '#303342'},
  loadingNotice: {
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  frame: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerPin: {backgroundColor: '#8051EE'},
  switchPin: {backgroundColor: '#547BFA'},
  masterPin: {backgroundColor: '#65962C'},
  icon: {color: '#FFF', fontSize: 18, fontWeight: '700'},
  notice: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 6,
  },
});
