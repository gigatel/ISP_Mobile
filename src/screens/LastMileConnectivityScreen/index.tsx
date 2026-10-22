import React, {useRef, useState} from 'react';
import {
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
import Svg, {Path} from 'react-native-svg';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {Screen} from '@organisms';
import {FONTS, IMAGES} from '@res';
import type {RootStackParamList} from '@navigation/navigator';
import PointerSvg from '../../res/images/pointer.svg';
import SplitterIcon from './SplitterIcon';

// Preview data only. No location permissions or connectivity APIs are required.
const DEMO_LOCATION = {latitude: 28.6011693, longitude: 77.30364906};
const SPLITTERS = [
  {
    id: 'SPL-11',
    name: 'SPL-11- L3 - N1',
    free: 4,
    distance: 50,
    latitude: 28.60215,
    longitude: 77.30275,
  },
  {
    id: 'SPL-12',
    name: 'SPL-12- L3 - N1',
    free: 3,
    distance: 100,
    latitude: 28.60165,
    longitude: 77.30155,
  },
  {
    id: 'SPL-13',
    name: 'SPL-13- L3 - N1',
    free: 6,
    distance: 150,
    latitude: 28.6009,
    longitude: 77.3021,
  },
  {
    id: 'SPL-14',
    name: 'SPL-14- L3 - N1',
    free: 2,
    distance: 200,
    latitude: 28.60265,
    longitude: 77.30355,
  },
  {
    id: 'SPL-15',
    name: 'SPL-15- L3 - N1',
    free: 5,
    distance: 250,
    latitude: 28.60035,
    longitude: 77.3042,
  },
];
const INITIAL_REGION = {
  ...DEMO_LOCATION,
  latitudeDelta: 0.006,
  longitudeDelta: 0.006,
};
const ROUTE = [
  SPLITTERS[0],
  {latitude: 28.60195, longitude: 77.3041},
  {latitude: 28.60085, longitude: 77.30365},
  DEMO_LOCATION,
];
const GRADIENT = ['#8858F9', '#6036C4'];

export default function LastMileConnectivityScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'LastMileConnectivity'>) {
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const expandedMapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [range, setRange] = useState(200);
  const [expanded, setExpanded] = useState(false);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const visibleSplitters = SPLITTERS.slice(0, 4);
  const listHeight = visibleSplitters.every(
    splitter => cardHeights[splitter.id],
  )
    ? visibleSplitters.reduce(
        (total, splitter) => total + cardHeights[splitter.id] + 8,
        0,
      )
    : 500;
  const compact = width < 380;

  const recenter = () => {
    (expanded ? expandedMapRef : mapRef).current?.animateToRegion(
      INITIAL_REGION,
      450,
    );
    if (!expanded) {
      scrollRef.current?.scrollToEnd({animated: true});
    }
  };

  const renderMap = (fullScreen: boolean) => (
    <View
      style={
        fullScreen
          ? styles.expandedMap
          : [
              styles.mapCard,
              {height: Math.max(280, Math.min(width * 0.85, height * 0.48))},
            ]
      }>
      <MapView
        ref={fullScreen ? expandedMapRef : mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={INITIAL_REGION}
        toolbarEnabled={false}
        showsMyLocationButton={false}>
        <Polyline coordinates={ROUTE} strokeColor="#536DFF" strokeWidth={3} />
        {SPLITTERS.map(splitter => (
          <Marker
            key={splitter.id}
            coordinate={splitter}
            title={splitter.name}
            description={`Type: 1:8 | ${splitter.free} Free • ${splitter.distance}m`}>
            <View style={styles.mapPin}>
              <SplitterIcon size={19} />
            </View>
          </Marker>
        ))}
        <Marker
          coordinate={DEMO_LOCATION}
          title="You are here (sample location)">
          <PointerSvg width={36} height={36} />
        </Marker>
      </MapView>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={fullScreen ? 'Collapse map' : 'Expand map'}
        onPress={() => setExpanded(!fullScreen)}
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
        accessibilityLabel="Where I am? Center map on sample location"
        onPress={recenter}>
        <LinearGradient
          colors={GRADIENT}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.whereButton}>
          <Text style={styles.whereText}>Where I am?</Text>
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
                onPress={() => setRange(value => Math.max(100, value - 100))}
                style={[styles.rangeButton, range <= 100 && styles.disabled]}>
                <Text style={styles.rangeSign}>−</Text>
              </TouchableOpacity>
              <Text style={styles.rangeText}>{range}m</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Increase range"
                accessibilityState={{disabled: range >= 1000}}
                disabled={range >= 1000}
                onPress={() => setRange(value => Math.min(1000, value + 100))}
                style={[styles.rangeButton, range >= 1000 && styles.disabled]}>
                <Text style={styles.rangeSign}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Near by Splitters :</Text>
          <View>
            <View style={styles.timeline} />
            <View
              style={styles.locationBadge}
              accessible
              accessibilityLabel="Person with location pin">
              <PointerSvg width={28} height={28} />
            </View>
            <ScrollView
              nestedScrollEnabled
              accessibilityLabel="Nearby splitters"
              style={[styles.splitterList, {height: listHeight}]}
              showsVerticalScrollIndicator
              contentContainerStyle={styles.list}>
              {SPLITTERS.map((splitter, index) => (
                <TouchableOpacity
                  key={splitter.id}
                  style={styles.card}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${splitter.name} details`}
                  onPress={() =>
                    navigation.navigate('LastMileSplitterDetails', {splitter})
                  }
                  onLayout={event => {
                    if (index >= 4) {
                      return;
                    }
                    const cardHeight = event.nativeEvent.layout.height;
                    setCardHeights(previous =>
                      previous[splitter.id] === cardHeight
                        ? previous
                        : {...previous, [splitter.id]: cardHeight},
                    );
                  }}>
                  <View style={styles.cardTop}>
                    <LinearGradient
                      colors={GRADIENT}
                      style={styles.splitterIcon}>
                      <SplitterIcon size={17} />
                    </LinearGradient>
                    <Text style={styles.splitterName}>
                      {splitter.name} ({splitter.id})
                    </Text>
                    <Text style={styles.type}>
                      <Text style={styles.bold}>Type:</Text> 1:8 |{' '}
                      {splitter.free} Free
                    </Text>
                  </View>
                  <Text style={styles.details}>
                    <Text style={styles.bold}>Optical Power :</Text> In = -10
                    dbm | Out = -14 dbm
                  </Text>
                  <Text style={styles.details}>
                    <Text style={styles.bold}>Address :</Text> Fabric Station,
                    29, Kalkaji Main Rd, Krishna Market, Block G, Kalkaji, New
                    Delhi, Delhi, 110019, India
                  </Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.details}>
                      <Text style={styles.bold}>Lat/Lng :</Text>{' '}
                      {splitter.latitude}, {splitter.longitude}
                    </Text>
                    <Text style={styles.distanceRow}>
                      <Text style={styles.bold}>Distance: </Text>
                      <Text style={styles.distance}>{splitter.distance}m</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {renderMap(false)}
        </ScrollView>
        {renderFooter()}
        <Modal
          visible={expanded}
          animationType="slide"
          onRequestClose={() => setExpanded(false)}>
          <View style={[styles.screen, {paddingTop: insets.top}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nearby Splitters</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close expanded map"
                onPress={() => setExpanded(false)}
                style={styles.closeButton}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            {expanded && renderMap(true)}
            {renderFooter()}
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F4F7FA'},
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
  mapPin: {
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7951EF',
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
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
