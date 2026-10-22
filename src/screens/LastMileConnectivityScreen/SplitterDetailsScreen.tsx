import React from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {TouchableOpacity} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Path} from 'react-native-svg';
import {Screen} from '@organisms';
import {FONTS, IMAGES} from '@res';
import type {RootStackParamList} from '@navigation/navigator';
import SplitterIcon from './SplitterIcon';

const CUSTOMERS = [
  {
    tube: '1',
    core: '2',
    mobile: '9926066378',
    name: 'Apex Enterprises',
    address: 'Fabric Station, 29, Kalkaji Main Rd, Krishna Market',
    latLng: '28.54123085, 77.25460640',
    online: true,
  },
  {
    tube: '1',
    core: '3',
    mobile: '6565656565',
    name: 'Apex Enterprises',
    address: 'G48, 11, Kalkaji, Block G, Kalkaji, New Delhi',
    latLng: '28.54123085, 77.25460640',
    online: true,
  },
  {
    tube: '1',
    core: '4',
    mobile: '9999999999',
    name: 'Apex Enterprises',
    address: 'B-141, Third Floor, Block E, Kalkaji, New Delhi',
    latLng: '28.54123085, 77.25460640',
    online: false,
  },
  {
    tube: '1',
    core: '5',
    mobile: '9926066378',
    name: 'Apex Enterprises',
    address: 'Near City Park, Kalkaji, Block E, New Delhi',
    latLng: '28.54123085, 77.25460640',
    online: false,
  },
];
const COLUMNS = [
  {key: 'tube', label: 'Tube', width: 30},
  {key: 'core', label: 'Core', width: 30},
  {key: 'mobile', label: 'Mobile No.', width: 78},
  {key: 'name', label: 'Customer Name', width: 105},
  {key: 'address', label: 'Customer Address', width: 180},
  {key: 'latLng', label: 'Customer Lat/Long', width: 164},
  {key: 'status', label: 'Status', width: 60},
] as const;
const ROW_HEIGHT = 34;

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
  const title = `${splitter.name} (${splitter.id})`;
  const occupiedLegs = 8 - splitter.free;
  // Static rows follow the selected splitter's available leg count.
  const customers = Array.from(
    {length: occupiedLegs},
    (_, index) => CUSTOMERS[index % CUSTOMERS.length],
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
          colors={['#8858F9', '#6036C4']}
          style={[styles.header, {paddingTop: insets.top + 8}]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}>
            <Image source={IMAGES.back} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </LinearGradient>
        <ScrollView
          contentContainerStyle={{paddingBottom: Math.max(insets.bottom, 16)}}
          showsVerticalScrollIndicator={false}>
          <View style={styles.summary}>
            <View style={styles.summaryTop}>
              <LinearGradient
                colors={['#8858F9', '#6036C4']}
                style={styles.splitterIcon}>
                <SplitterIcon size={17} />
              </LinearGradient>
              <Text style={styles.splitterName}>{title}</Text>
              <Text style={styles.summaryText}>
                <Text style={styles.bold}>Type:</Text> 1:8 | {splitter.free}{' '}
                Free
              </Text>
            </View>
            <Text style={styles.summaryText}>
              <Text style={styles.bold}>Optical Power :</Text> In = -10 dbm |
              Out = -14 dbm
            </Text>
            <Text style={styles.summaryText}>
              <Text style={styles.bold}>Address :</Text> Fabric Station, 29,
              Kalkaji Main Rd, Krishna Market, Block G, Kalkaji, New Delhi,
              Delhi, 110019, India
            </Text>
            <View style={styles.summaryBottom}>
              <Text style={[styles.summaryText, styles.coordinates]}>
                <Text style={styles.bold}>Lat/Lng :</Text> {splitter.latitude},{' '}
                {splitter.longitude}
              </Text>
              <Text style={styles.summaryText}>
                <Text style={styles.bold}>Distance: </Text>
                <Text style={styles.distance}>{splitter.distance}m</Text>
              </Text>
            </View>
          </View>
          <View style={styles.table}>
            <View style={styles.legsColumn}>
              <Text style={styles.columnHeading}>Legs</Text>
              <View style={styles.legLine} />
              {Array.from({length: 8}, (_, index) => (
                <View key={index} style={styles.row}>
                  <View style={[styles.cell, styles.legCell]}>
                    <Text style={styles.cellText}>{index + 1}</Text>
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
                      style={[styles.columnHeading, {width: column.width}]}>
                      {column.label}
                    </Text>
                  ))}
                </View>
                {Array.from({length: 8}, (_, index) => {
                  const customer = customers[index];
                  return (
                    <View key={index} style={styles.fieldRow}>
                      {customer
                        ? COLUMNS.map(column => (
                            <View
                              key={column.key}
                              style={[styles.fieldSlot, {width: column.width}]}>
                              <View
                                style={[
                                  styles.cell,
                                  column.key === 'status' && styles.statusCell,
                                ]}>
                                {column.key === 'status' ? (
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
                                ) : (
                                  <Text
                                    numberOfLines={1}
                                    style={styles.cellText}>
                                    {customer[column.key]}
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
              {Array.from({length: 8}, (_, index) => (
                <View key={index} style={styles.row}>
                  {customers[index] && (
                    <View
                      style={styles.editButton}
                      accessibilityLabel={`Edit customer on leg ${index + 1}`}>
                      <EditIcon />
                    </View>
                  )}
                </View>
              ))}
            </View>
            {Array.from({length: splitter.free}, (_, index) => (
              <View
                key={`empty-${index}`}
                style={[
                  styles.emptySlot,
                  {top: 28 + (occupiedLegs + index) * ROW_HEIGHT},
                ]}>
                <View style={styles.addButton}>
                  <Text style={styles.addText}>Add Customer</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F4F7FA'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  backButton: {width: 30, minHeight: 44, justifyContent: 'center'},
  backIcon: {
    width: 19,
    height: 19,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: FONTS.MEDIUM,
    fontSize: 16,
  },
  summary: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E5EB',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 2,
  },
  splitterIcon: {
    width: 21,
    height: 21,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitterName: {
    flexGrow: 1,
    fontFamily: FONTS.BOLD,
    fontSize: 10,
    color: '#393D45',
  },
  summaryText: {
    fontFamily: FONTS.REGULAR,
    color: '#393D45',
    fontSize: 10,
    lineHeight: 18,
  },
  bold: {fontFamily: FONTS.BOLD},
  summaryBottom: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 8},
  coordinates: {flexGrow: 1},
  distance: {color: '#0085FF'},
  table: {flexDirection: 'row', marginHorizontal: 14, marginTop: 12},
  legsColumn: {width: 32},
  columnHeading: {
    height: 28,
    textAlignVertical: 'center',
    paddingTop: 6,
    fontSize: 9,
    fontFamily: FONTS.BOLD,
    color: '#777D85',
  },
  legLine: {
    position: 'absolute',
    width: 1,
    left: 12,
    top: 40,
    bottom: 16,
    backgroundColor: '#E1E5EB',
  },
  row: {height: ROW_HEIGHT, justifyContent: 'center'},
  fieldRow: {height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center'},
  tableHeader: {height: 28},
  fieldsScroll: {flex: 1},
  fieldSlot: {paddingRight: 6},
  cell: {
    minHeight: 26,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E5EB',
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  legCell: {width: 26, alignItems: 'center', paddingHorizontal: 0},
  cellText: {fontFamily: FONTS.REGULAR, fontSize: 10, color: '#414651'},
  statusCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
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
  statusDot: {width: 9, height: 9, borderRadius: 5},
  onlineDot: {backgroundColor: '#2BC860'},
  offlineDot: {backgroundColor: '#FF443C'},
  statusText: {fontFamily: FONTS.MEDIUM, fontSize: 10},
  onlineText: {color: '#24BD58'},
  offlineText: {color: '#FF443C'},
  emptySlot: {
    position: 'absolute',
    left: 32,
    height: ROW_HEIGHT,
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#0085FF',
    minHeight: 28,
    borderRadius: 5,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  addText: {fontFamily: FONTS.REGULAR, fontSize: 10, color: '#FFFFFF'},
  editColumn: {width: 30, paddingLeft: 4},
  editButton: {
    width: 26,
    height: 26,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0085FF',
  },
});
