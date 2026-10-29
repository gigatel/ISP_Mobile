import React, {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  getPreviewConnections,
  mergeApiCustomerConnections,
} from './customerPreview';
import {getSplitterCustomerDetails} from '../../services/lastMileSplitterCustomers';
import type {SplitterCustomer, SplitterLeg} from './types';
import {
  splitterTitle,
  splitterRatio,
  powerLabel,
  distanceLabel,
  hasSplitterCoordinate,
} from '../../services/lastMileConnectivityService';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {TouchableOpacity} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Path} from 'react-native-svg';
import {Screen} from '@organisms';
import {FONTS, IMAGES} from '@res';
import type {RootStackParamList} from '@navigation/navigator';
import SplitterIcon from './SplitterIcon';

const COLUMNS = [
  {key: 'tube', label: 'Tube', width: 28},
  {key: 'core', label: 'Core', width: 28},
  {key: 'mobile', label: 'Mobile No.', width: 76},
  {key: 'name', label: 'Customer Name', width: 96},
  {key: 'address', label: 'Customer Address', width: 160},
  {key: 'latLng', label: 'Customer Lat/Long', width: 194},
  {key: 'status', label: 'Status', width: 82},
] as const;
const ROW_HEIGHT = 48;
const TABLE_HEADER_HEIGHT = 32;

function EditIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 3l5 5M10 14l-1 4 4-1L22 8a2 2 0 0 0 0-3l-2-2a2 2 0 0 0-3 0l-7 11Z"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function LastMileSplitterDetailsScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'LastMileSplitterDetails'>) {
  const {splitter} = route.params;
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const columnScale = Math.min(1, Math.max(0.7, (width - 84) / 292));
  const title = splitterTitle(splitter);
  const [customers, setCustomers] = useState<(SplitterCustomer | null)[]>(() =>
    splitter.source === 'api' ? [] : getPreviewConnections(splitter),
  );
  const [loading, setLoading] = useState(splitter.source === 'api');
  const [error, setError] = useState('');
  const [legs, setLegs] = useState<SplitterLeg[]>([]);
  const requestId = useRef(0);
  const loadCustomers = useCallback(async () => {
    const id = ++requestId.current;
    if (splitter.source !== 'api') {
      setCustomers(getPreviewConnections(splitter));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getSplitterCustomerDetails(splitter);
      if (id !== requestId.current) {
        return;
      }
      setLegs(result.legs);
      setCustomers(mergeApiCustomerConnections(splitter, result.customers));
    } catch (failure: any) {
      if (id === requestId.current) {
        setError(
          failure?.message ||
            'Could not load splitter customers. Please retry.',
        );
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [splitter]);
  useFocusEffect(
    useCallback(() => {
      loadCustomers();
      return () => {
        requestId.current += 1;
      };
    }, [loadCustomers]),
  );
  const occupiedLegs = customers.filter(Boolean).length;
  const totalLegs = customers.length;
  const freeLegs = totalLegs - occupiedLegs;
  const onlineCount = customers.filter(
    customer => customer?.online === true,
  ).length;
  const offlineCount = customers.filter(
    customer => customer?.online === false,
  ).length;
  const displaySplitter = {
    ...splitter,
    totalPorts: totalLegs || splitter.totalPorts,
    free: loading || error ? splitter.free : freeLegs,
  };
  const openCustomer = (index: number) =>
    navigation.navigate('LastMileCustomerForm', {
      splitter: displaySplitter,
      leg: index + 1,
      customer: customers[index] ?? undefined,
      connectionLeg: legs.find(item => item.leg === index + 1),
    });

  return (
    <Screen
      preset="fixed"
      isSafeArea={false}
      isNavSafeArea={false}
      keyboardAvoidingEnabled={false}
      statusBgColor="#8858F9"
      statusBarStyle="light">
      <View style={styles.screen}>
        <ImageBackground
          source={IMAGES.HeaderBkg}
          resizeMode="stretch"
          style={[styles.header, {paddingTop: insets.top + 8}]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}>
            <Image source={IMAGES.back} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </ImageBackground>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.summary}>
            <View style={styles.summaryTop}>
              <LinearGradient
                colors={['#8858F9', '#6036C4']}
                style={styles.splitterIcon}>
                <SplitterIcon size={17} />
              </LinearGradient>
              <View style={styles.summaryCopy}>
                <Text style={styles.splitterName}>{title}</Text>
              </View>
              <Text style={styles.summaryText}>
                <Text style={styles.fieldLabel}>Type:</Text>{' '}
                {splitterRatio(displaySplitter)} | {displaySplitter.free} Free
              </Text>
            </View>
            <Text style={styles.summaryText}>
              <Text style={styles.fieldLabel}>Optical Power: </Text>In{' '}
              {splitter.source === 'api'
                ? powerLabel(splitter.opticalPowerIn)
                : '−10 dBm'}{' '}
              | Out{' '}
              {splitter.source === 'api'
                ? powerLabel(splitter.opticalPowerOut)
                : '−14 dBm'}
            </Text>
            <Text style={styles.summaryText}>
              <Text style={styles.fieldLabel}>Address: </Text>
              {splitter.address ||
                (splitter.source === 'api'
                  ? '—'
                  : 'Fabric Station, 29, Kalkaji Main Rd, Krishna Market, Block G, Kalkaji, New Delhi, Delhi, 110019, India')}
            </Text>
            <View style={styles.summaryBottom}>
              <Text selectable style={styles.coordinateText}>
                <Text style={styles.fieldLabel}>Lat/Lng: </Text>
                {hasSplitterCoordinate(splitter)
                  ? `${splitter.latitude}, ${splitter.longitude}`
                  : '—'}
              </Text>
              <Text style={styles.distanceBadge}>
                <Text style={styles.distanceLabel}>Distance: </Text>
                <Text style={styles.distance}>
                  {distanceLabel(splitter.distance)}
                </Text>
              </Text>
            </View>
          </View>
          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color="#8858F9" />
              <Text style={styles.stateText}>Loading connected customers…</Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>{error}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={loadCustomers}
                style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {totalLegs === 0 && (
                <View style={styles.stateCard}>
                  <Text style={styles.stateText}>
                    No customer connections or available legs were returned for
                    this splitter.
                  </Text>
                </View>
              )}
              <View style={styles.tableCard}>
                <View style={styles.table}>
                  <View style={styles.legsColumn}>
                    <Text style={styles.columnHeading}>Legs</Text>
                    <View style={styles.legLine} />
                    {Array.from({length: totalLegs}, (_, index) => (
                      <View key={index} style={styles.row}>
                        <View style={[styles.cell, styles.legCell]}>
                          <Text style={styles.legText}>{index + 1}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    style={styles.fieldsScroll}
                    accessibilityLabel="Customer connection details. Swipe horizontally for customer coordinates and status.">
                    <View>
                      <View style={[styles.fieldRow, styles.tableHeader]}>
                        {COLUMNS.map(column => (
                          <Text
                            key={column.key}
                            style={[
                              styles.columnHeading,
                              {width: column.width * columnScale},
                            ]}>
                            {column.label}
                          </Text>
                        ))}
                      </View>
                      {Array.from({length: totalLegs}, (_, index) => {
                        const customer = customers[index];
                        return (
                          <View key={index} style={styles.fieldRow}>
                            {customer
                              ? COLUMNS.map(column => (
                                  <View
                                    key={column.key}
                                    style={[
                                      styles.fieldSlot,
                                      {width: column.width * columnScale},
                                    ]}>
                                    <View
                                      style={[
                                        styles.cell,
                                        column.key === 'status' &&
                                          styles.statusCell,
                                      ]}>
                                      {column.key === 'status' ? (
                                        customer.online === null ? (
                                          <Text style={styles.cellText}>—</Text>
                                        ) : (
                                          <>
                                            <View
                                              style={[
                                                styles.statusHalo,
                                                customer.online
                                                  ? styles.onlineHalo
                                                  : styles.offlineHalo,
                                              ]}>
                                              <View
                                                style={[
                                                  styles.statusDot,
                                                  customer.online
                                                    ? styles.onlineDot
                                                    : styles.offlineDot,
                                                ]}
                                              />
                                            </View>
                                            <Text
                                              style={[
                                                styles.statusText,
                                                customer.online
                                                  ? styles.onlineText
                                                  : styles.offlineText,
                                              ]}>
                                              {customer.online ? 'ON' : 'OFF'}
                                            </Text>
                                          </>
                                        )
                                      ) : (
                                        <Text
                                          numberOfLines={1}
                                          style={styles.cellText}>
                                          {customer[column.key] || '—'}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                ))
                              : null}
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <View style={styles.editColumn}>
                    <View style={styles.columnHeading} />
                    {Array.from({length: totalLegs}, (_, index) => (
                      <View key={index} style={styles.row}>
                        {customers[index] && (
                          <TouchableOpacity
                            onPress={() => openCustomer(index)}
                            accessibilityRole="button"
                            style={styles.editButton}
                            accessibilityLabel={`Edit customer on leg ${
                              index + 1
                            }`}>
                            <LinearGradient
                              pointerEvents="none"
                              colors={['#8858F9', '#6036C4']}
                              style={StyleSheet.absoluteFill}
                            />
                            <EditIcon />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                  {customers.map((customer, index) =>
                    customer ? null : (
                      <View
                        key={`empty-${index}`}
                        style={[
                          styles.emptySlot,
                          {
                            top: TABLE_HEADER_HEIGHT + index * ROW_HEIGHT,
                          },
                        ]}>
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={() => openCustomer(index)}
                          accessibilityRole="button"
                          accessibilityLabel={`Add customer to leg ${
                            index + 1
                          }`}>
                          <LinearGradient
                            pointerEvents="none"
                            colors={['#8858F9', '#6036C4']}
                            style={StyleSheet.absoluteFill}
                          />
                          <Text style={styles.addText}>Add Customer</Text>
                        </TouchableOpacity>
                      </View>
                    ),
                  )}
                </View>
              </View>
            </>
          )}
        </ScrollView>
        {!loading && !error && (
          <View
            style={[
              styles.footer,
              {paddingBottom: Math.max(insets.bottom, 10)},
            ]}>
            <View style={styles.connectionSummary}>
              <View style={styles.summaryHeadingRow}>
                <Text style={styles.connectionSummaryTitle}>
                  Connection Summary
                </Text>
                <Text style={styles.utilizationText}>
                  {occupiedLegs}/{totalLegs} legs used
                </Text>
              </View>
              {totalLegs > 0 && (
                <View
                  style={styles.capacityBar}
                  accessible
                  accessibilityLabel={`${occupiedLegs} connected legs and ${freeLegs} free legs`}>
                  {Array.from({length: totalLegs}, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.capacitySegment,
                        customers[index] && styles.usedSegment,
                      ]}
                    />
                  ))}
                </View>
              )}
              <View style={styles.capacityLabels}>
                <Text style={styles.capacityText}>
                  {totalLegs
                    ? `${Math.round(
                        (occupiedLegs / totalLegs) * 100,
                      )}% occupied`
                    : 'No ports returned'}
                </Text>
                <Text style={styles.freeLegsText}>{freeLegs} free legs</Text>
              </View>
              {totalLegs > 0 && (
                <View style={styles.statusSummaryRow}>
                  <View
                    style={[styles.statusSummaryItem, styles.onlineSummary]}>
                    <View style={[styles.statusDot, styles.onlineDot]} />
                    <Text style={styles.statusSummaryLabel}>Online</Text>
                    <Text style={styles.statusSummaryValue}>{onlineCount}</Text>
                  </View>
                  <View
                    style={[styles.statusSummaryItem, styles.offlineSummary]}>
                    <View style={[styles.statusDot, styles.offlineDot]} />
                    <Text style={styles.statusSummaryLabel}>Offline</Text>
                    <Text style={styles.statusSummaryValue}>
                      {offlineCount}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F4F7FA'},
  stateCard: {
    margin: 14,
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
  retryText: {fontFamily: FONTS.MEDIUM, fontSize: 12, color: '#FFFFFF'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: '#7946E5',
  },
  backButton: {width: 28, minHeight: 38, justifyContent: 'center'},
  backIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.MEDIUM,
    fontSize: 16,
    color: '#FFFFFF',
  },
  scroll: {flex: 1, minHeight: 0},
  content: {flexGrow: 1, paddingBottom: 12},
  summary: {
    paddingHorizontal: 7,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 2,
  },
  splitterIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCopy: {flex: 1},
  splitterName: {
    fontFamily: FONTS.BOLD,
    fontSize: 11,
    lineHeight: 18,
    color: '#393D45',
  },
  fieldLabel: {fontFamily: FONTS.BOLD, fontSize: 11, color: '#393D45'},
  summaryText: {
    fontFamily: FONTS.REGULAR,
    color: '#393D45',
    fontSize: 11,
    lineHeight: 18,
  },
  summaryBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  coordinateText: {
    fontFamily: FONTS.REGULAR,
    color: '#393D45',
    fontSize: 11,
    lineHeight: 18,
  },
  distanceBadge: {fontFamily: FONTS.REGULAR, fontSize: 11},
  distanceLabel: {fontFamily: FONTS.BOLD, fontSize: 11, color: '#393D45'},
  distance: {fontFamily: FONTS.BOLD, fontSize: 13, color: '#0075E6'},
  tableCard: {marginTop: 10, marginHorizontal: 14},
  table: {flexDirection: 'row'},
  legsColumn: {width: 30},
  columnHeading: {
    height: TABLE_HEADER_HEIGHT,
    textAlignVertical: 'center',
    paddingTop: 7,
    fontSize: 9.5,
    fontFamily: FONTS.BOLD,
    color: '#777D85',
  },
  legLine: {
    position: 'absolute',
    width: 1,
    left: 11,
    top: TABLE_HEADER_HEIGHT + ROW_HEIGHT / 2,
    bottom: ROW_HEIGHT / 2,
    backgroundColor: '#E1E5EB',
  },
  row: {height: ROW_HEIGHT, justifyContent: 'center'},
  fieldRow: {height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center'},
  tableHeader: {height: TABLE_HEADER_HEIGHT},
  fieldsScroll: {flex: 1},
  fieldSlot: {paddingRight: 5},
  cell: {
    minHeight: 27,
    paddingHorizontal: 5,
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E1E5EB',
    backgroundColor: '#FFFFFF',
  },
  legCell: {width: 23, alignItems: 'center', paddingHorizontal: 0},
  legText: {fontFamily: FONTS.REGULAR, fontSize: 11, color: '#414651'},
  cellText: {fontFamily: FONTS.MEDIUM, fontSize: 11, color: '#414651'},
  statusCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  statusHalo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineHalo: {backgroundColor: '#D0F5DE'},
  offlineHalo: {backgroundColor: '#FFD9D5'},
  statusDot: {width: 8, height: 8, borderRadius: 4},
  onlineDot: {backgroundColor: '#2BC860'},
  offlineDot: {backgroundColor: '#FF443C'},
  statusText: {fontFamily: FONTS.MEDIUM, fontSize: 11},
  onlineText: {color: '#24BD58'},
  offlineText: {color: '#FF443C'},
  emptySlot: {
    position: 'absolute',
    left: 30,
    height: ROW_HEIGHT,
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#8858F9',
    overflow: 'hidden',
    minHeight: 27,
    borderRadius: 5,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  addText: {fontFamily: FONTS.REGULAR, fontSize: 11, color: '#FFFFFF'},
  editColumn: {width: 29, paddingLeft: 2},
  editButton: {
    width: 27,
    height: 27,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8858F9',
    overflow: 'hidden',
  },
  footer: {
    flexShrink: 0,
    paddingTop: 8,
    backgroundColor: '#F4F7FA',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4DFEC',
  },
  connectionSummary: {
    marginHorizontal: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  summaryHeadingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  connectionSummaryTitle: {
    fontFamily: FONTS.BOLD,
    fontSize: 12,
    color: '#393D45',
  },
  utilizationText: {fontFamily: FONTS.MEDIUM, fontSize: 10, color: '#7952C9'},
  capacityBar: {flexDirection: 'row', gap: 4, marginTop: 12},
  capacitySegment: {
    flex: 1,
    height: 7,
    borderRadius: 3,
    backgroundColor: '#ECE7F7',
  },
  usedSegment: {backgroundColor: '#8858F9'},
  capacityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  capacityText: {fontFamily: FONTS.REGULAR, fontSize: 10, color: '#85808E'},
  freeLegsText: {fontFamily: FONTS.BOLD, fontSize: 10, color: '#7952C9'},
  statusSummaryRow: {flexDirection: 'row', gap: 8, marginTop: 12},
  statusSummaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 9,
    borderRadius: 8,
  },
  onlineSummary: {backgroundColor: '#EFF9F2'},
  offlineSummary: {backgroundColor: '#FFF3F1'},
  statusSummaryLabel: {
    flex: 1,
    fontFamily: FONTS.MEDIUM,
    fontSize: 11,
    color: '#666370',
  },
  statusSummaryValue: {fontFamily: FONTS.BOLD, fontSize: 14, color: '#393D45'},
});
