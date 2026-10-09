import React, {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ConnectivityIcon} from './ConnectivityIcons';
import MapView, {Circle, Marker, Polyline} from 'react-native-maps';
import {
  Coordinate,
  coordinateOf,
  pathOf,
  typeOf,
  valueOf,
} from './connectivity';

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
  const ref = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const paths = useMemo(
    () => items.map(pathOf).filter(path => path.length > 1),
    [items],
  );
  const nodes = useMemo(() => {
    const result: {coordinate: Coordinate; type: string; title: string}[] = [];
    const add = (
      coordinate: Coordinate | null,
      type: string,
      title: string,
    ) => {
      if (
        coordinate &&
        !result.some(
          node =>
            node.coordinate.latitude === coordinate.latitude &&
            node.coordinate.longitude === coordinate.longitude,
        )
      ) {
        result.push({coordinate, type, title});
      }
    };
    items.forEach(item => {
      const type = typeOf(item);
      add(
        coordinateOf(item) ||
          coordinateOf(item.location) ||
          coordinateOf(item.deviceMaster),
        type,
        String(
          valueOf(
            item,
            'switchName',
            'splitterName',
            'customerName',
            'masterName',
            'name',
          ) || type,
        ),
      );
      const path = pathOf(item);
      if (path.length) {
        add(
          path[0],
          String(
            valueOf(item, 'fromMasterType', 'FromMasterType') || 'route',
          ).toLowerCase(),
          String(
            valueOf(item, 'fromMasterName', 'FromMasterName') || 'Route start',
          ),
        );
        add(
          path[path.length - 1],
          String(
            valueOf(item, 'toMasterType', 'ToMasterType') || 'route',
          ).toLowerCase(),
          String(valueOf(item, 'toMasterName', 'ToMasterName') || 'Route end'),
        );
      }
    });
    return result;
  }, [items]);
  const coordinates = useMemo(() => {
    const points = [...nodes.map(node => node.coordinate), ...paths.flat()];
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
        <Text>No map coordinates available for this connectivity.</Text>
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
            key={index}
            coordinates={path}
            strokeColor={
              customer ? '#3869FF' : index % 2 ? '#C94BCD' : '#5278FF'
            }
            strokeWidth={3}
          />
        ))}
        {nodes.map((node, index) => (
          <Marker
            key={`${index}-${node.title}`}
            coordinate={node.coordinate}
            title={node.title}
            description={node.type}>
            <View
              style={[
                styles.pin,
                customer || node.type.includes('customer')
                  ? styles.customerPin
                  : node.type.includes('switch')
                  ? styles.switchPin
                  : styles.masterPin,
              ]}>
              <ConnectivityIcon type={node.type} size={17} />
            </View>
          </Marker>
        ))}
      </MapView>
      {!nodes.length && (
        <View style={styles.notice}>
          <Text>No coordinates returned for the nearby records.</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
