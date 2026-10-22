// ChamberDetailsScreen.tsx
import React, {FC, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Image,
  StatusBar,
} from 'react-native';
import {useRoute, RouteProp, useNavigation} from '@react-navigation/native';
import MapView, {Marker, UrlTile, Polyline, Callout} from 'react-native-maps';
import {BackHeader} from '@molecules';
import {Screen} from '@organisms';
import {COLORS, SIZE} from '@res';
import {getOlaMapApiKey} from '../../utils/olaMapKey';
import {FONTS, IMAGES} from '@res';

/* ================= TYPES ================= */
type RouteRow = {
  route_id: string;
  route_name: string;
  route_chambers: any[];
};

type RootStackParamList = {
  ChamberDetails: {
    routeRows: RouteRow[];
    routeAddressMap?: Record<string, string>;
  };
};

type MapPoint = {
  latitude: number;
  longitude: number;
  chamberId: string;
  chamberName: string;
};

const ChamberDetailsScreen: FC = () => {
  const navigation = useNavigation();
  const olaMapApiKey = getOlaMapApiKey();
  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  /* ROUTE */
  const route = useRoute<RouteProp<RootStackParamList, 'ChamberDetails'>>();
  const {routeRows, routeAddressMap} = route.params;

  /* ================= ROUTE CARD LIST ================= */
  const routeCards = useMemo(() => {
    return routeRows.map(r => {
      const sorted = [...r.route_chambers].sort(
        (a, b) => a.order_no - b.order_no,
      );
      return {
        routeId: r.route_id,
        routeName: r.route_name,
        start: sorted[0],
        end: sorted[sorted.length - 1],
      };
    });
  }, [routeRows]);

  /* ================= MAP POINTS (WITH CHAMBER INFO) ================= */
  const connectedPoints: MapPoint[] = useMemo(() => {
    const pts: MapPoint[] = [];
    routeRows.forEach((r, i) => {
      const sorted = [...r.route_chambers].sort(
        (a, b) => a.order_no - b.order_no,
      );
      const start = sorted[0];
      const end = sorted[sorted.length - 1];
      // ✅ start chamber
      pts.push({
        latitude: parseFloat(start.chamber_latitude),
        longitude: parseFloat(start.chamber_longitude),
        chamberId: start.chamber_id,
        chamberName: start.chamber_name,
      });
      // ✅ last end chamber only once
      if (i === routeRows.length - 1) {
        pts.push({
          latitude: parseFloat(end.chamber_latitude),
          longitude: parseFloat(end.chamber_longitude),
          chamberId: end.chamber_id,
          chamberName: end.chamber_name,
        });
      }
    });
    return pts;
  }, [routeRows]);

  const region = {
    latitude: connectedPoints[0]?.latitude || 28.6,
    longitude: connectedPoints[0]?.longitude || 77.2,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  /* ================= OPEN SINGLE POINT ================= */
  const openMap = (lat: number, lng: number) => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    );
  };

  /* ================= OPEN FULL ROUTE ================= */
  const openFullRouteInGoogleMaps = () => {
    if (!connectedPoints.length) return;

    const origin = connectedPoints[0];
    const destination = connectedPoints[connectedPoints.length - 1];

    const waypoints =
      connectedPoints.length > 2
        ? connectedPoints
            .slice(1, connectedPoints.length - 1)
            .map(p => `${p.latitude},${p.longitude}`)
            .join('|')
        : '';

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}` +
      (waypoints ? `&waypoints=${waypoints}` : '');

    Linking.openURL(url);
  };

  return (
    <Screen statusBgColor={COLORS.PRIMARY}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
      <View style={styles.headerWrapper}>
        <BackHeader
          headerTitle="CHAMBER DETAILS"
          onBackPress={handleBackPress}
        />
        <View style={styles.floatingCard}>
          {/* MAP CONTAINER - Non-scrollable, fixed in header */}
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={region}
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={true}
              rotateEnabled={true}>
              {olaMapApiKey ? (
                <UrlTile
                  urlTemplate={`https://api.olamaps.io/tiles/v1/{z}/{x}/{y}.png?key=${encodeURIComponent(olaMapApiKey)}`}
                />
              ) : null}
              <Polyline
                coordinates={connectedPoints}
                strokeColor="#4A90E2"
                strokeWidth={4}
              />
              {/* ✅ MARKERS WITH CHAMBER INFO */}
              {connectedPoints.map((p, i) => (
                <Marker key={i} coordinate={p} pinColor="red">
                  <Callout>
                    <View style={{padding: 6, maxWidth: 220}}>
                      <Text style={{fontWeight: '700'}}>
                        {p.chamberId} ({p.chamberName})
                      </Text>
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>
          </View>
        </View>
      </View>
      {/* ================= SCROLLABLE ROUTE CARDS ================= */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContent}>
        {/* Add spacer to push content below floating map */}
        <View style={styles.spacer} />

        {routeCards.map((item, idx) => (
          <View key={idx} style={styles.card}>
            <Text style={styles.routeText}>
              {item.routeId}
              {item.routeName ? ` (${item.routeName})` : ''} (
              {item.start.chamber_id} ({item.start.chamber_name}))
              {'  '}To{'  '}
              {item.end.chamber_id} ({item.end.chamber_name})
            </Text>

            <Text style={styles.address}>
              {routeAddressMap?.[item.routeId] ||
                item.start.chamber_address ||
                'Address not available'}
            </Text>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() =>
                  openMap(
                    parseFloat(item.start.chamber_latitude),
                    parseFloat(item.start.chamber_longitude),
                  )
                }>
                <Text style={styles.btnText}>START POINT</Text>
              </TouchableOpacity>

              {item.start.chamber_id !== item.end.chamber_id && (
                <TouchableOpacity
                  style={styles.endBtn}
                  onPress={() =>
                    openMap(
                      parseFloat(item.end.chamber_latitude),
                      parseFloat(item.end.chamber_longitude),
                    )
                  }>
                  <Text style={styles.btnText}>END POINT</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        <View style={{height: SIZE.MS(100)}} />
      </ScrollView>

      {/* ================= VIEW ON GOOGLE MAP BUTTON ================= */}
      <TouchableOpacity
        style={styles.googleMapBtn}
        onPress={openFullRouteInGoogleMaps}
        activeOpacity={0.8}>
        <View style={styles.googleBtnContent}>
          <Text style={styles.googleText}>VIEW ON</Text>
          <Image
            source={IMAGES.Google_Maps_icon}
            style={styles.googleLogo}
            resizeMode="contain"
          />
          <Text style={styles.googleText}>MAP</Text>
        </View>
      </TouchableOpacity>
    </Screen>
  );
};

export default ChamberDetailsScreen;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
  },
  mapContainer: {
    height: SIZE.MVS(280),
    paddingVertical: SIZE.MVS(10),
    paddingHorizontal: SIZE.MS(10),
    width: '100%',
    borderRadius: SIZE.MS(12),
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  spacer: {
    height: SIZE.MVS(265),
  },
  card: {
    backgroundColor: '#fff',
    margin: SIZE.MS(12),
    padding: SIZE.MS(12),
    borderRadius: SIZE.MS(8),
    elevation: 2,
  },
  floatingCard: {
    position: 'absolute',
    width: '94%',
    alignSelf: 'center',
    borderRadius: SIZE.MS(12),
    zIndex: 1000,
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginTop: SIZE.MVS(45),
  },
  routeText: {
    fontSize: SIZE.MS(13),
    marginBottom: SIZE.MS(6),
    color: '#333',
    fontFamily: FONTS.SEMI_BOLD,
  },
  address: {
    color: '#4A90E2',
    fontSize: SIZE.MS(11),
    marginBottom: SIZE.MS(12),
    fontFamily: FONTS.LIGHT,
  },
  btnRow: {
    flexDirection: 'row',
    gap: SIZE.MS(8),
  },

  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  googleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  googleLogo: {
    width: SIZE.MS(60),
    height: SIZE.MS(18),
  },
  startBtn: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    padding: SIZE.MS(10),
    borderRadius: SIZE.MS(6),
    alignItems: 'center',
  },
  endBtn: {
    flex: 1,
    backgroundColor: COLORS.ERROR,
    padding: SIZE.MS(10),
    borderRadius: SIZE.MS(6),
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.BOLD,
  },
  googleMapBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SIZE.MS(16),
    width: '94%',
    borderRadius: SIZE.MS(12),
    bottom: 10,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMapBtnText: {
    color: '#fff',
    fontSize: SIZE.MS(14),
    fontWeight: '700',
  },
});
