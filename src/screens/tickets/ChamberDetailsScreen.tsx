/* FULLY UPDATED ChamberDetailsScreen with API-Driven Table */
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Image,
  StatusBar,
  Linking,
} from 'react-native';
import React, {FC, useEffect, useState} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {BackHeader} from '@molecules';
import {ticketService} from '../../services/ticketService';
import {NativeModules} from 'react-native';
import Tts from 'react-native-tts';
import {
  FontFamily,
  BoxShadow,
  FontSize,
  Width,
  Padding,
  Border,
  Gap,
  Height,
} from '../../res/globalStyle';
const {MLHindiTranslate} = NativeModules;

/* ---------------------------
   MLKIT → TRANSLATE TEXT
--------------------------- */
const toHindi = async (text: string) => {
  try {
    if (!text) return text;
    const response = await MLHindiTranslate.translate(text);
    return response || text;
  } catch (e) {
    console.log('Hindi Translation Error', e);
    return text;
  }
};

const ChamberDetailsScreen: FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const incomingCustomerName: string = route.params?.customerName ?? '';
  const incomingcircuitName: string = route.params?.circuitName ?? '';

  const [customerList, setCustomerList] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [circuitList, setCircuitList] = useState<any[]>([]);
  const [selectedCircuit, setSelectedCircuit] = useState<string>('');
  const [chamberList, setChamberList] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  /* -----------------------------
       PICKER BOX
------------------------------ */
  const renderPickerBox = (
    label: string,
    value: string,
    list: any[],
    setValue: (v: string) => void,
  ) => {
    const selected = list.find(i => i.value === value);
    return (
      <Pressable
        style={styles.box}
        onPress={() =>
          navigation.navigate('CustomerPickerScreen', {
            data: list,
            selectedValue: value || '',
            title: label,
            onSelect: (item: any) => {
              if (label === 'Select Customer') {
                setSelectedCustomer(item.value);
                setCircuitList([]);
                setSelectedCircuit('');
                setChamberList([]);
                setSelectedDetails(null);
                setSelectedIndex(null);
              } else if (label === 'Select Circuit') {
                setSelectedCircuit(item.value);
                setValue(item.value);
              }
            },
          })
        }>
        {selected?.icon && (
          <Image source={selected.icon} style={styles.leftIcon} />
        )}
        <Text style={styles.boxLabel}>{selected?.label || label}</Text>
        <Image source={IMAGES.down} style={styles.rightArrow} />
      </Pressable>
    );
  };

  const handleOpenMap = () => {
    if (!selectedDetails) return;
    const lat = selectedDetails.chamber_lat;
    const lng = selectedDetails.chamber_lng;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  };

  /* -----------------------------
       LOAD CUSTOMER LIST
  ------------------------------ */
  const loadCustomerList = async () => {
    try {
      setLoading(true);
      const response = await ticketService.getCustomerListAPI();
      if (response.success) {
        const formatted = response.data.map((item: any) => ({
          label: item.customerName,
          value: String(item.customerId),
          icon: IMAGES.Customer,
        }));
        setCustomerList(formatted);

        if (incomingCustomerName) {
          const match = formatted.find(
            c =>
              c.label.trim().toLowerCase() ===
              incomingCustomerName.trim().toLowerCase(),
          );
          setSelectedCustomer(match?.value || '');
        } else {
          setSelectedCustomer('');
        }
      }
    } catch (error) {
      console.error('Error loading customer list:', error);
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------
       LOAD CIRCUIT LIST
  ------------------------------ */
  const loadCircuitList = async (customerId: string) => {
    try {
      setLoading(true);
      const response = await ticketService.getCircuitListAPI(
        Number(customerId),
      );

      if (response.success) {
        const formatted = response.data.map((item: any) => ({
          label: item.circuitName,
          value: String(item.circuitId),
          icon: IMAGES.FiberEnclosur,
          extra: {
            startAddress: item.startAddress || '',
            endAddress: item.endAddress || '',
          },
        }));
        setCircuitList(formatted);

        if (incomingcircuitName) {
          const matchedCircuit = formatted.find(
            c =>
              c.label.trim().toLowerCase() ===
              incomingcircuitName.trim().toLowerCase(),
          );
          if (matchedCircuit) {
            setSelectedCircuit(matchedCircuit.value);
          } else {
            setSelectedCircuit('');
          }
        } else {
          setSelectedCircuit('');
        }
      } else {
        setCircuitList([]);
        setSelectedCircuit('');
      }
    } catch (error) {
      console.error('Error loading circuit list:', error);
      setCircuitList([]);
      setSelectedCircuit('');
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------
       LOAD CHAMBERS FROM API
  ------------------------------ */
  const loadChambers = async (circuitId: string) => {
    try {
      if (!circuitId) return;

      setLoading(true);
      const res = await ticketService.getNearestChamberList(circuitId);

      if (res.success && Array.isArray(res.data)) {
        let formatted: any[] = [];

        if (lang === 'hi') {
          // Translate addresses to Hindi
          formatted = await Promise.all(
            res.data.map(async (item: any, index: number) => {
              const hindiAddr = await toHindi(item.chamber_name);
              return {
                ...item,
                sno: index + 1,
                chamberId: item.chamber_id,
                chamberName: item.chamber_id_str,
                address: hindiAddr,
                encl: item.is_enclosure ? true : false,
                totalDist: index === 0 ? 0 : item.total_distance || 0,
                diff: '',
                isNegative: false,
              };
            }),
          );
        } else {
          // English addresses
          formatted = res.data.map((item: any, index: number) => ({
            ...item,
            sno: index + 1,
            chamberId: item.chamber_id,
            chamberName: item.chamber_id_str,
            address: item.chamber_name,
            encl: item.is_enclosure ? true : false,
            totalDist: index === 0 ? 0 : item.total_distance || 0,
            diff: '',
            isNegative: false,
          }));
        }

        setChamberList(formatted);
      } else {
        setChamberList([]);
      }
    } catch (error) {
      console.error('Error loading chambers:', error);
      setChamberList([]);
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------
       EFFECTS
  ------------------------------ */
  useEffect(() => {
    loadCustomerList();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadCircuitList(selectedCustomer);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedCircuit) {
      loadChambers(selectedCircuit);
      // Reset selection when circuit changes
      setSelectedDetails(null);
      setSelectedIndex(null);
    }
  }, [selectedCircuit]);

  // Reload chambers when language changes
  useEffect(() => {
    if (selectedCircuit) {
      loadChambers(selectedCircuit);
    }
  }, [lang]);

  /* -----------------------------
       HANDLE CHAMBER DETAILS CLICK
  ------------------------------ */
  const handleChamberDetailsClick = (index: number) => {
    const selectedRow = chamberList[index];

    // Toggle selection
    if (selectedIndex === index && selectedDetails) {
      setSelectedDetails(null);
      setSelectedIndex(null);
      try {
        Tts.stop();
      } catch (e) {}
      return;
    }

    setSelectedDetails(selectedRow);
    setSelectedIndex(index);

    // Speak the address
    try {
      Tts.stop();
      Tts.speak(selectedRow.address);
    } catch (e) {
      console.error('TTS Error:', e);
    }
  };

  /* -----------------------------
       HANDLE DIFF CALCULATION
  ------------------------------ */
  const handleDiffClick = (index: number) => {
    const selectedRow = chamberList[index];
    const baseDist = selectedRow.totalDist;

    const updated = chamberList.map((item, i) => {
      if (i === index) {
        return {...item, diff: 0, isNegative: false};
      }

      const rawDiff = baseDist - item.totalDist;

      return {
        ...item,
        diff: Math.round(Math.abs(rawDiff)), // 👈 decimals removed
        isNegative: rawDiff < 0,
      };
    });

    setChamberList(updated);
  };

  /* -----------------------------
       ROW RENDER
  ------------------------------ */
  const renderRow = ({item, index}: any) => {
    const isSelected = selectedIndex === index;
    const rowBg = isSelected
      ? COLORS.colorLavender
      : index % 2 === 0
      ? COLORS.colorWhitesmoke
      : COLORS.colorWhite;

    return (
      <View>
        <View style={[styles.row, {backgroundColor: rowBg}]}>
          <Pressable
            style={styles.cellSno}
            onPress={() => handleChamberDetailsClick(index)}>
            <View style={styles.sno2}>
              <Image
                source={IMAGES.speakIcon}
                style={styles.spee1Icon}
                resizeMode="cover"
              />
              <Text style={[styles.text, styles.gig28alakTypo]}>
                {item.sno}
              </Text>
            </View>
          </Pressable>

          {/* Chamber Column */}
          <Pressable
            style={styles.cellChamber}
            onPress={() => handleChamberDetailsClick(index)}>
            <View style={styles.chamberContent}>
              {/* TEXT AREA */}
              <View style={styles.gig28alakBatra249AlaknandaParent}>
                <Text
                  style={[
                    styles.gig28alakBatra249Alaknanda,
                    styles.gig28alakTypo,
                  ]}>
                  {item.chamberName}
                </Text>
                <Text
                  style={[
                    styles.gig28alakBatra249Alaknanda,
                    styles.gig28alakTypo,
                    {fontSize: 11, fontWeight: '400', marginTop: 2},
                  ]}>
                  {item.address}
                </Text>

                {item.encl && (
                  <View style={styles.encl1Wrapper}>
                    <Image
                      source={IMAGES.enclosureIcon}
                      style={styles.encl1Icon}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </View>
            </View>
          </Pressable>

          {/* Total Distance Column */}
          <View style={styles.cellDist}>
            <Text
              style={[styles.gigatelSolutionsPrivate, styles.gig28alakTypo]}>
              {item.totalDist}
            </Text>
          </View>

          {/* Diff Column */}
          <Pressable
            style={styles.cellDiff}
            onPress={() => handleDiffClick(index)}>
            {item.diff !== '' && (
              <View style={styles.diffRow}>
                <Image
                  source={item.isNegative ? IMAGES.downarrow : IMAGES.uparrow}
                  style={styles.diffArrow}
                  resizeMode="contain"
                />
                <Text style={[styles.diffText, {color: '#393d45'}]}>
                  {Number(item.diff)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* EXPANDED DETAILS */}
        {selectedDetails && selectedIndex === index && (
          <View style={[styles.frameWrapper2, styles.frameBorder]}>
            <View style={[styles.frameParent7, styles.frameBorder]}>
              {/* Header with Chamber Name and Map Icon */}
              <View style={styles.inner}>
                <View style={[styles.frameParent8, styles.frameParent8FlexBox]}>
                  <View
                    style={[
                      styles.chamberGig28alakBatra249Wrapper,
                      styles.globe2ParentFlexBox,
                    ]}>
                    <Text
                      style={[
                        styles.chamberGig28alakBatra249,
                        styles.gig28alakTypo,
                      ]}>
                      Chamber: {selectedDetails.chamberName}
                    </Text>
                  </View>
                  <Pressable onPress={handleOpenMap}>
                    <Image
                      source={IMAGES.GoogleMapsIcon}
                      style={styles.frameItem}
                      resizeMode="cover"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Details Content */}
              <View style={[styles.frameParent9, styles.frameParentFlexBox]}>
                {/* Route Info */}
                <View style={styles.frameParent10}>
                  <View
                    style={[
                      styles.routeGig25Wrapper,
                      styles.wrapperParentFlexBox,
                    ]}>
                    <Text style={[styles.routeGig25, styles.text10Typo]}>
                      Route: {selectedDetails.route_id || ''}{' '}
                      {selectedDetails.route_name || ''}
                    </Text>
                  </View>
                  {(selectedDetails.start_address ||
                    selectedDetails.end_address) && (
                    <View
                      style={[styles.frameParent11, styles.frameParentFlexBox]}>
                      <View
                        style={[
                          styles.alaknandaPoliceBoothWrapper,
                          styles.wrapperParentFlexBox,
                        ]}>
                        <Text style={[styles.routeGig25, styles.text10Typo]}>
                          {selectedDetails.start_address || 'Start Point'}
                        </Text>
                      </View>
                      <Image
                        source={IMAGES.rightArrowNew}
                        style={styles.frameInner}
                        resizeMode="cover"
                      />
                      <View
                        style={[
                          styles.alaknandaPoliceBoothWrapper,
                          styles.wrapperParentFlexBox,
                        ]}>
                        <Text style={[styles.routeGig25, styles.text10Typo]}>
                          {selectedDetails.end_address || 'End Point'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Technical Details */}
                <View style={styles.inner}>
                  {/* Tube, Core 1, Core 2 */}
                  <View style={[styles.dn1Parent, styles.wrapperParentFlexBox]}>
                    <View style={styles.dn1}>
                      <Text style={[styles.routeGig25, styles.text10Typo]}>
                        Tube
                      </Text>
                      <View
                        style={[styles.wrapper5, styles.wrapperFrameBorder]}>
                        <Text style={[styles.text10, styles.text10Typo]}>
                          {selectedDetails.tube_no || '-'}
                        </Text>
                      </View>
                    </View>
                    <Image
                      source={IMAGES.verticalLine}
                      style={styles.frameChild2}
                      resizeMode="cover"
                    />
                    <View style={styles.dn1}>
                      <Text style={[styles.routeGig25, styles.text10Typo]}>
                        Core 1
                      </Text>
                      <View
                        style={[styles.wrapper5, styles.wrapperFrameBorder]}>
                        <Text style={[styles.text10, styles.text10Typo]}>
                          {selectedDetails.core_no_one || '-'}
                        </Text>
                      </View>
                    </View>
                    <Image
                      source={IMAGES.verticalLine}
                      style={styles.frameChild2}
                      resizeMode="cover"
                    />
                    <View style={styles.dn1}>
                      <Text style={[styles.routeGig25, styles.text10Typo]}>
                        Core 2
                      </Text>
                      <View
                        style={[styles.wrapper5, styles.wrapperFrameBorder]}>
                        <Text style={[styles.text10, styles.text10Typo]}>
                          {selectedDetails.core_no_two}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Fiber Type and Cable Status */}
                  <View style={[styles.dn1Parent, styles.wrapperParentFlexBox]}>
                    <View style={styles.dn1}>
                      <Text style={[styles.routeGig25, styles.text10Typo]}>
                        Fiber Type
                      </Text>
                      <View
                        style={[styles.wrapper5, styles.wrapperFrameBorder]}>
                        <Text style={[styles.text10, styles.text10Typo]}>
                          {selectedDetails.fiber_type || '-'}
                        </Text>
                      </View>
                    </View>
                    <Image
                      source={IMAGES.verticalLine}
                      style={styles.frameChild2}
                      resizeMode="cover"
                    />
                    <View style={styles.dn1}>
                      <Text style={[styles.routeGig25, styles.text10Typo]}>
                        Cable
                      </Text>
                      <View
                        style={[styles.wrapper5, styles.wrapperFrameBorder]}>
                        <Text style={[styles.text10, styles.text10Typo]}>
                          {selectedDetails.cable_status || '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Dismiss Button */}
                <View
                  style={[styles.frameWrapper4, styles.wrapperParentFlexBox]}>
                  <Pressable
                    onPress={() => {
                      setSelectedDetails(null);
                      setSelectedIndex(null);
                      try {
                        Tts.stop();
                      } catch (e) {}
                    }}
                    style={[
                      styles.dismissWrapper,
                      styles.frameParent8FlexBox2,
                    ]}>
                    <Text style={[styles.dismiss, styles.snoTypo]}>
                      dismiss
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen loading={loading} loaderMessage={'Please wait...\n\nLoading data'}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
      <View style={styles.headerWrapper}>
        <BackHeader
          headerTitle="Chamber Distance Info"
          onBackPress={navigation.goBack}
          showLanguageSelector={true}
          selectedLang={lang}
          onLangChange={setLang}
        />
        <View style={styles.floatingCard}>
          {renderPickerBox(
            'Select Customer',
            selectedCustomer,
            customerList,
            setSelectedCustomer,
          )}
        </View>
      </View>
      <View style={{paddingHorizontal: SIZE.MS(10), marginTop: SIZE.MS(30)}}>
        {renderPickerBox(
          'Select Circuit',
          selectedCircuit,
          circuitList,
          setSelectedCircuit,
        )}
      </View>
      {chamberList.length > 0 && (
        <View style={styles.tableContainer}>
          <View style={[styles.frameGroup, styles.frameGroupBorder]}>
            <View style={[styles.snoWrapper, styles.wrapperBorder]}>
              <Text style={[styles.sno, styles.snoTypo]}>S.no</Text>
            </View>
            <View style={[styles.chamberWrapper, styles.wrapperBorder]}>
              <Text style={[styles.chamber, styles.snoTypo]}>Chamber</Text>
            </View>
            <View style={[styles.totalDistWrapper, styles.wrapperLayout]}>
              <Text style={[styles.sno, styles.snoTypo]}>Total Dist.</Text>
            </View>
            <View style={[styles.diffrWrapper, styles.containerFlexBox1]}>
              <Text style={[styles.diffr, styles.snoTypo]}>Diffr.</Text>
            </View>
          </View>

          {/* TABLE ROWS */}
          <FlatList
            data={chamberList}
            renderItem={renderRow}
            keyExtractor={(item, index) => `chamber-${item.chamberId}-${index}`}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.WHITE,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    borderColor: '#DFE3E8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIcon: {width: 20, height: 20, marginRight: 12},
  boxLabel: {fontSize: 12, color: '#111', flex: 1},
  rightArrow: {width: 18, height: 18, tintColor: '#999'},
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
    paddingBottom: SIZE.MVS(28),
  },
  chamberContent: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },

  floatingCard: {
    position: 'absolute',
    bottom: -SIZE.MVS(22),
    width: '94%',
    alignSelf: 'center',
    borderRadius: SIZE.MS(12),
    zIndex: 1000,
  },
  tableContainer: {
    flex: 1,
    marginTop: SIZE.MS(16),
    // backgroundColor: 'red',
    paddingHorizontal: SIZE.MS(12),
  },
  containerFlexBox1: {
    width: Width.width_49,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  diffArrow: {
    width: 10,
    height: 18,
  },
  frameGroupBorder: {
    borderColor: '#8EAACD',
    borderStyle: 'solid',
    borderWidth: 0.5,
  },
  frameGroup: {
    height: 37,
    borderTopLeftRadius: Border.br_6,
    borderTopRightRadius: Border.br_6,
    borderWidth: 0.5,
    flexDirection: 'row',
    borderColor: '#8EAACD',
    borderStyle: 'solid',
    alignSelf: 'stretch',
    backgroundColor: COLORS.PRIMARY,
  },
  snoWrapper: {
    borderRightWidth: 0.5,
    width: Width.width_44,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  sno: {
    textAlign: 'center',
    fontWeight: '500',
  },

  chamberWrapper: {
    paddingLeft: Padding.padding_6,
    borderRightWidth: 0.5,
    alignSelf: 'stretch',
    flex: 1,
  },
  chamber: {
    textAlign: 'left',
  },
  totalDistWrapper: {
    borderColor: COLORS.colorGray,
    borderStyle: 'solid',
    alignItems: 'center',
    flexDirection: 'row',
    borderRightWidth: 0.5,
  },
  diffrWrapper: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  diffr: {
    textAlign: 'left',
    fontWeight: '500',
  },
  wrapperBorder: {
    borderColor: COLORS.colorGray,
    borderStyle: 'solid',
    alignItems: 'center',
    flexDirection: 'row',
  },
  snoTypo: {
    fontSize: FontSize.fs_13,
    color: COLORS.colorWhite,
    fontFamily: FONTS.REGULAR,
  },
  wrapperLayout: {
    width: Width.width_80,
    borderRightWidth: 0.5,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    minHeight: SIZE.MS(70),
    alignItems: 'stretch',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.colorLightsteelblue,
  },
  cellSno: {
    width: Width.width_44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: COLORS.colorLightsteelblue,
  },
  diffText: {
    fontSize: SIZE.MS(13),
    fontWeight: '700',
    fontFamily: FONTS.REGULAR,
  },
  sno2: {
    paddingLeft: Padding.padding_4,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  spee1Icon: {
    width: Width.width_14,
    height: Height.height_13,
  },
  text: {
    textAlign: 'center',
  },
  cellChamber: {
    flex: 1,
    padding: Padding.padding_6,
    borderRightWidth: 0.5,
    borderRightColor: COLORS.colorLightsteelblue,
    justifyContent: 'center',
  },
  gig28alakBatra249AlaknandaParent: {
    flex: 1,
  },
  gig28alakBatra249Alaknanda: {
    textAlign: 'left',
    fontWeight: '500',
  },
  encl1Wrapper: {
    alignItems: 'flex-end',
    paddingRight: Padding.padding_8,
    marginTop: 4,
  },
  encl1Icon: {
    height: Height.height_11,
    width: Width.width_33,
  },
  cellDist: {
    width: Width.width_80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: COLORS.colorLightsteelblue,
  },
  cellDiff: {
    width: Width.width_49,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameChild: {
    width: 2,
    borderRadius: Border.br_10,
    backgroundColor: COLORS.colorLightsteelblue,
    height: Height.height_15,
  },
  gig28alakTypo: {
    color: COLORS.colorDarkslategray100,
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.REGULAR,
  },
  gigatelSolutionsPrivate: {
    textAlign: 'center',
    fontWeight: '600',
  },
  frameWrapper2: {
    backgroundColor: COLORS.colorWhite,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  frameBorder: {
    padding: Padding.padding_8,
    borderColor: COLORS.colorLightsteelblue,
    borderWidth: 0.5,
    borderStyle: 'solid',
  },
  frameParent7: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.colorLavender,
    flex: 1,
  },
  inner: {
    alignSelf: 'stretch',
  },
  frameParent8: {
    borderColor: COLORS.colorLightsteelblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    borderWidth: 0.5,
    alignSelf: 'stretch',
  },
  frameParent8FlexBox: {
    borderRadius: Border.br_8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  chamberGig28alakBatra249Wrapper: {
    paddingLeft: Padding.padding_8,
    flex: 1,
  },
  chamberGig28alakBatra249: {
    textAlign: 'left',
    flex: 1,
  },
  globe2ParentFlexBox: {
    paddingBottom: 7,
    paddingTop: 7,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  frameItem: {
    paddingVertical: Padding.padding_6,
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    resizeMode: 'cover',
    alignSelf: 'stretch',
  },
  frameParent9: {
    paddingTop: Padding.padding_12,
  },
  frameParentFlexBox: {
    gap: Gap.gap_4,
    alignSelf: 'stretch',
  },
  frameParent10: {
    paddingBottom: Padding.padding_6,
    gap: 5,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  routeGig25Wrapper: {
    alignSelf: 'stretch',
  },
  wrapperParentFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  routeGig25: {
    textAlign: 'left',
  },
  text10Typo: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray100,
    fontFamily: FONTS.MEDIUM,
  },
  frameParent11: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  alaknandaPoliceBoothWrapper: {
    justifyContent: 'center',
  },
  frameInner: {
    height: 8,
    width: 18,
    marginHorizontal: 8,
  },
  dn1Parent: {
    gap: Gap.gap_14,
    alignSelf: 'stretch',
  },
  dn1: {
    paddingVertical: Padding.padding_6,
    paddingHorizontal: Padding.padding_4,
    borderRadius: Border.br_6,
    gap: Gap.gap_8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  wrapper5: {
    paddingVertical: Padding.padding_4,
    paddingHorizontal: Padding.padding_8,
    backgroundColor: COLORS.WHITE,
    borderRadius: Border.br_6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 26,
  },
  wrapperFrameBorder: {
    borderColor: COLORS.colorLightsteelblue,
    borderStyle: 'solid',
  },
  text10: {
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  frameChild2: {
    height: 20,
    width: 1,
    backgroundColor: '#C4C4C4',
    marginHorizontal: 6,
  },
  frameWrapper4: {
    paddingTop: Padding.padding_6,
    alignSelf: 'stretch',
  },
  dismissWrapper: {
    paddingHorizontal: Padding.padding_20,
    paddingVertical: Padding.padding_8,
    borderRadius: Border.br_8,
    justifyContent: 'center',
    flex: 1,
  },
  frameParent8FlexBox2: {
    borderRadius: Border.br_8,
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: '#535455',
  },
  dismiss: {
    textTransform: 'uppercase',
    textAlign: 'left',
    fontWeight: '500',
  },
});

export default ChamberDetailsScreen;
