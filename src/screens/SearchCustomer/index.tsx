import React, {FC, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Linking,
  Pressable,
  FlatList,
  ScrollView,
  StatusBar,
} from 'react-native';
import {Screen} from '@organisms';
import {BackHeader} from '@molecules';
import {ticketService} from '../../services/ticketService';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {ScreenProps} from '@types';
import {
  Padding,
  FontSize,
  Gap,
  FontFamily,
  BoxShadow,
  Height,
  Width,
  Border,
  MinHeight,
} from '../../res/globalStyle';
import LinearGradient from 'react-native-linear-gradient';
let typingTimeout: any = null;
type PickerItem = {
  label: string;
  value: string;
  icon?: any;
  fullData?: any;
};
const SearchCustomer: FC<ScreenProps.SearchCustomer> = ({navigation}) => {
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [circuitList, setCircuitList] = useState<PickerItem[]>([]);
  const [selectedCircuit, setSelectedCircuit] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  /* ------------------------------------
      SEARCH CUSTOMER (DEBOUNCE)
  -------------------------------------- */
  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (typingTimeout) clearTimeout(typingTimeout);

    if (text.length < 3) {
      setCustomers([]);
      setSelectedCustomer(null);
      setCircuitList([]);
      setSelectedCircuit('');
      setShowReport(false);
      return;
    }
    typingTimeout = setTimeout(async () => {
      setLoading(true);
      const res = await ticketService.getCustomerName(text);
      setCustomers(res?.success ? res.data : []);
      setLoading(false);
    }, 400);
  }, []);
  /* ------------------------------------
      LOAD CIRCUIT LIST
  -------------------------------------- */
  const loadCircuitList = async (customerCompanyId: string) => {
    setLoading(true);
    try {
      const response = await ticketService.getCircuitListAPI(
        Number(customerCompanyId),
      );
      if (response.success) {
        const formatted = response.data.map((item: any) => ({
          label: item.circuitName,
          value: String(item.circuitId),
          icon: IMAGES.ChamberNew,
          fullData: item,
        }));
        setCircuitList(formatted);
        setSelectedCircuit('');
        setShowReport(false);
      } else {
        setCircuitList([]);
      }
    } catch (e) {
      console.log(e);
      setCircuitList([]);
    } finally {
      setLoading(false);
    }
  };
  /* ------------------------------------
      DROPDOWN PICKER BOX
  -------------------------------------- */
  const renderPickerBox = (
    label: string,
    value: string,
    list: PickerItem[],
    setValue: (v: string) => void,
  ) => {
    const selected = list.find(i => i.value === value);
    return (
      <View style={styles.alignRow}>
        <Pressable
          style={styles.box}
          onPress={() =>
            navigation.navigate('CustomerPickerScreen', {
              data: list.map(i => ({
                ...i,
                extra: {
                  startAddress: i.fullData?.startAddress,
                  endAddress: i.fullData?.endAddress,
                  fibreType: i.fullData?.fibreType,
                  poNumber: i.fullData?.poNumber,
                  status: i.fullData?.status,
                },
              })),
              selectedValue: value,
              title: 'Select Circuit',
              onSelect: async (item: any) => {
                setValue(item.value);
                setSelectedCircuit(item.value);
                console.log('Selected Circuit:', item.label);
                setShowReport(false);
                setLoading(true);
                const apiResponse = await ticketService.getCircuitInfoList(
                  item.value,
                );
                if (apiResponse.success) {
                  setReportData(apiResponse.data);
                } else {
                  setReportData([]);
                }
                setShowReport(true);
                setLoading(false);
              },
            })
          }>
          {selected?.icon && (
            <Image source={selected.icon} style={styles.leftIcon} />
          )}
          <Text style={styles.boxLabel}>{selected?.label || label}</Text>
          <Image source={IMAGES.down} style={styles.rightArrow} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (
              reportData &&
              Array.isArray(reportData) &&
              reportData.length > 0
            ) {
              const url = reportData[0]?.installationReportUrl;
              if (url) {
                Linking.openURL(url);
              } else {
                console.log('No installationReportUrl found');
              }
            }
          }}>
          <Image style={styles.installIcon} source={IMAGES.InstallationIcon} />
        </Pressable>
      </View>
    );
  };
  const renderInstallationReport = () => {
    if (!showReport || !reportData || !Array.isArray(reportData)) return;
    null;
    return (
      <ScrollView
        style={styles.routecardbody}
        nestedScrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.routeCardBodyContainerContent}>
        {reportData.map((item, index) => (
          <View key={index} style={[styles.cartroute, styles.cardBodyFlexBox]}>
            <LinearGradient
              style={styles.cardHeader}
              locations={[0, 1]}
              colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0)']}
              useAngle={true}
              angle={180}>
              <Text style={[styles.routeId, styles.pass2Typo]}>
                Route ID : {item.routeID} - {item.routeName || '-'}
              </Text>
            </LinearGradient>

            <View style={[styles.cardBody, styles.spanBorder1]}>
              {/* Start Chamber */}
              <View style={[styles.li, styles.liBorder]}>
                <View style={[styles.span, styles.spanSpaceBlock]}>
                  <Text
                    style={[
                      styles.triplePlayBroadband,
                      styles.searchByCustomer2Typo,
                    ]}>
                    Start Chamber
                  </Text>
                </View>
                <View style={[styles.span2, styles.spanSpaceBlock]}>
                  <Text
                    style={[
                      styles.near220kvSubstation,
                      styles.searchByCustomer2Typo,
                    ]}>
                    {item.startChamber || '-'}
                  </Text>
                </View>
              </View>

              {/* Enclosure ID */}
              <View style={[styles.li, styles.liBorder]}>
                <View style={[styles.span, styles.spanSpaceBlock]}>
                  <Text
                    style={[
                      styles.triplePlayBroadband,
                      styles.searchByCustomer2Typo,
                    ]}>
                    Enclosure ID
                  </Text>
                </View>
                <View style={[styles.span2, styles.spanSpaceBlock]}>
                  <Text
                    style={[
                      styles.near220kvSubstation,
                      styles.searchByCustomer2Typo,
                    ]}>
                    {item.enclosureID || '-'}
                  </Text>
                </View>
              </View>

              {/* In/Out/Bypass and Fiber Type */}
              <View style={styles.liBorder}>
                <View style={styles.l}>
                  <View style={[styles.span, styles.spanSpaceBlock]}>
                    <Text
                      style={[
                        styles.triplePlayBroadband,
                        styles.searchByCustomer2Typo,
                      ]}>
                      In/Out/Bypass
                    </Text>
                  </View>
                  <View style={[styles.span6, styles.spanSpaceBlock]}>
                    <View style={styles.pass} />
                    <Text style={[styles.pass2, styles.pass2Typo]}>
                      {item.inOutBypass || '-'}
                    </Text>
                  </View>
                </View>
                <View style={styles.l}>
                  <View style={[styles.span7, styles.spanSpaceBlock]}>
                    <Text
                      style={[
                        styles.triplePlayBroadband,
                        styles.searchByCustomer2Typo,
                      ]}>
                      Fiber Type
                    </Text>
                  </View>
                  <View style={styles.spanSpaceBlock}>
                    <Text style={[styles.pass2, styles.pass2Typo]}>
                      {item.fiberType || '-'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Length and Total Length */}
              <View style={styles.liBorder}>
                <View style={styles.l}>
                  <View style={[styles.span, styles.spanSpaceBlock]}>
                    <Text
                      style={[
                        styles.triplePlayBroadband,
                        styles.searchByCustomer2Typo,
                      ]}>
                      Length
                    </Text>
                  </View>
                  <View style={[styles.span10, styles.spanSpaceBlock]}>
                    <Text style={[styles.pass2, styles.pass2Typo]}>
                      {item.length || '-'}
                    </Text>
                  </View>
                </View>
                <View style={styles.l}>
                  <View style={[styles.span11, styles.spanSpaceBlock]}>
                    <Text
                      style={[
                        styles.triplePlayBroadband,
                        styles.searchByCustomer2Typo,
                      ]}>
                      Total Length
                    </Text>
                  </View>
                  <View style={styles.spanSpaceBlock}>
                    <Text style={[styles.pass2, styles.pass2Typo]}>
                      {item.totalLength || '-'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Tube No. and Core No. */}
              <View style={styles.liBorder}>
                <View style={styles.l}>
                  <View style={[styles.span, styles.spanSpaceBlock]}>
                    <Text
                      style={[
                        styles.triplePlayBroadband,
                        styles.searchByCustomer2Typo,
                      ]}>
                      Tube No.
                    </Text>
                  </View>
                  <View style={[styles.span10, styles.spanSpaceBlock]}>
                    <View style={[styles.tube, styles.spanBorder1]}>
                      <Text style={[styles.text2, styles.text2Typo]}>
                        {item.tubeNo || '-'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.l}>
                  <View style={[styles.span11, styles.spanSpaceBlock]}>
                    <Text
                      style={[
                        styles.triplePlayBroadband,
                        styles.searchByCustomer2Typo,
                      ]}>
                      Core No.
                    </Text>
                  </View>
                  <View style={styles.spanSpaceBlock}>
                    <Text
                      style={[
                        styles.pass2,
                        styles.pass2Typo,
                        {flexWrap: 'wrap'}, // 👈 IMPORTANT
                      ]}>
                      {item.coreNameOne || '-'}
                      {item.coreNameTwo || ''}
                    </Text>
                  </View>
                </View>
              </View>

              {/* End Chamber */}
              <View style={[styles.li, styles.liBorder]}>
                <View style={[styles.span, styles.spanSpaceBlock]}>
                  <Text
                    style={[
                      styles.triplePlayBroadband,
                      styles.searchByCustomer2Typo,
                    ]}>
                    End Chamber
                  </Text>
                </View>
                <View style={[styles.span18, styles.spanSpaceBlock]}>
                  <Text
                    style={[
                      styles.near220kvSubstation,
                      styles.searchByCustomer2Typo,
                    ]}>
                    {item.endChamber || '-'}
                  </Text>
                </View>
              </View>

              {/* Remark */}
              <View style={[styles.li, styles.liBorder]}>
                <View style={[styles.span, styles.spanSpaceBlock]}>
                  <Text
                    style={[
                      styles.triplePlayBroadband,
                      styles.searchByCustomer2Typo,
                    ]}>
                    Remark
                  </Text>
                </View>
                <View style={[styles.span2, styles.spanSpaceBlock]}>
                  <Text
                    style={[
                      styles.near220kvSubstation,
                      styles.searchByCustomer2Typo,
                    ]}>
                    {item.remarks || '-'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  /* ------------------------------------
      CUSTOMER LIST ITEM
  -------------------------------------- */
  const renderCustomerItem = ({item}: any) => {
    const isSelected =
      selectedCustomer?.customerCompanyId === item.customerCompanyId;

    return (
      <View>
        <TouchableOpacity
          style={[
            styles.searchResultBox,
            isSelected && styles.selectedCustomerBox,
          ]}
          onPress={() => {
            setSelectedCustomer(item);
            setCircuitList([]);
            setSelectedCircuit('');
            setShowReport(false);
            loadCircuitList(item.customerCompanyId);
          }}>
          <Image source={IMAGES.Building} style={styles.customerIcon} />
          <Text style={styles.searchResultText}>{item.companyName}</Text>
        </TouchableOpacity>

        {isSelected && circuitList.length > 0 && (
          <View style={styles.circuitPickerInline}>
            {renderPickerBox(
              'Select Circuit',
              selectedCircuit,
              circuitList,
              setSelectedCircuit,
            )}

            {renderInstallationReport()}
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
          headerTitle="Search By Customer"
          onBackPress={navigation.goBack}
        />

        <View style={styles.floatingCard}>
          <View style={styles.searchBox}>
            <TextInput
              placeholder="Search by customer name (company name)"
              placeholderTextColor="#999"
              style={styles.input}
              value={searchText}
              onChangeText={handleSearch}
            />
          </View>
        </View>
      </View>
      <View style={styles.container}>
        {customers.length > 0 && (
          <FlatList
            data={customers}
            keyExtractor={(item, index) =>
              item.customerCompanyId?.toString() || `customer-${index}`
            }
            renderItem={renderCustomerItem}
            contentContainerStyle={styles.listContent}
            scrollEnabled={false}
          />
        )}
      </View>
    </Screen>
  );
};

export default SearchCustomer;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: SIZE.MS(18),
  },
  searchBox: {
    width: '92%',
    marginVertical: 8,
    alignSelf: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(8),
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  input: {fontSize: 14, color: '#000'},
  listContent: {paddingHorizontal: 16, paddingBottom: 20},
  searchResultBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    paddingVertical: SIZE.MS(6),
    paddingHorizontal: SIZE.MS(12),
    borderRadius: SIZE.MS(6),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedCustomerBox: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: '#F0F9FF',
  },
  customerIcon: {width: 22, height: 22},
  searchResultText: {
    marginLeft: SIZE.MS(10),
    fontSize: SIZE.MS(14),
    fontWeight: '600',
    flex: 1,
    fontFamily: FONTS.REGULAR,
  },
  circuitPickerInline: {
    marginBottom: SIZE.MS(8),
  },
  alignRow: {
    flexDirection: 'row',
    marginTop: SIZE.MS(8),
  },
  box: {
    backgroundColor: COLORS.WHITE,
    paddingVertical: SIZE.MS(6),
    paddingHorizontal: SIZE.MS(12),
    borderWidth: 1,
    width: '88%',
    borderRadius: SIZE.MS(6),
    borderColor: '#DFE3E8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  boxLabel: {
    fontSize: SIZE.MS(14),
    color: '#111',
    flex: 1,
    marginLeft: SIZE.MS(8),
    fontFamily: FONTS.REGULAR,
  },
  installIcon: {
    height: SIZE.MS(40),
    width: SIZE.MS(40),
  },
  rightArrow: {
    width: SIZE.MS(18),
    height: SIZE.MS(18),
    tintColor: '#999',
  },
  floatingCard: {
    position: 'absolute',
    bottom: -SIZE.MVS(22),
    width: '100%',
    alignSelf: 'center',
    zIndex: 1000,
  },
  leftIcon: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    tintColor: COLORS.colorDarkslategray,
  },
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
    paddingBottom: SIZE.MVS(28),
  },
  routeCardBodyContainerContent: {
    gap: Gap.gap_10,
  },
  text2Typo: {
    textAlign: 'center',
    fontFamily: FONTS.MEDIUM,
  },
  searchByCustomer2Typo: {
    textAlign: 'left',
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.REGULAR,
  },
  cardBodyFlexBox: {
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  pass2Typo: {
    fontWeight: '600',
    textAlign: 'left',
    fontSize: 10,
    fontFamily: FONTS.MEDIUM,
  },
  spanBorder1: {
    borderWidth: 0.5,
    borderStyle: 'solid',
  },
  liBorder: {
    borderBottomWidth: 0.5,
    borderColor: COLORS.colorLightsteelblue200,
    borderStyle: 'solid',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  spanSpaceBlock: {
    minHeight: 28,
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignItems: 'flex-start', // 👈 center ❌
    justifyContent: 'center',
    flexDirection: 'row',
  },

  view: {
    width: '100%',
    height: '100%',
    paddingBottom: 20,
    gap: 16,
    paddingHorizontal: Padding.padding_12,
    flex: 1,
  },
  inner: {
    alignSelf: 'stretch',
  },
  triplePlayBroadband: {
    color: COLORS.colorDarkslategray,
  },
  routecardbody: {
    maxHeight: SIZE.MS(560), // 👈 IMPORTANT
    marginVertical: SIZE.MS(10),
  },
  cartroute: {
    backgroundColor: COLORS.colorWhite,
    overflow: 'hidden',
    borderRadius: Border.br_6,
  },
  cardHeader: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: Padding.padding_11,
    paddingVertical: Padding.padding_12,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  routeId: {
    color: COLORS.colorWhite,
  },
  cardBody: {
    borderBottomRightRadius: Border.br_6,
    borderBottomLeftRadius: Border.br_6,
    borderColor: COLORS.colorLightsteelblue200,
    borderWidth: 0.5,
    borderStyle: 'solid',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  li: {
    alignItems: 'center',
  },

  span2: {
    flex: 1,
  },
  near220kvSubstation: {
    color: COLORS.colorDarkslategray,
    flex: 1,
    flexWrap: 'wrap', // 👈 IMPORTANT
    fontSize: 11,
  },
  l: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  span6: {
    width: 80,
    borderRightWidth: 0.5,
    minHeight: MinHeight.min_h_32,
    paddingVertical: Padding.padding_3,
    paddingHorizontal: Padding.padding_6,
    borderColor: COLORS.colorLightsteelblue200,
    borderStyle: 'solid',
    gap: Gap.gap_6,
  },
  pass: {
    height: 17,
    width: 17,
    borderRadius: Border.br_4,
    backgroundColor: COLORS.colorLimegreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pass2: {
    color: COLORS.colorDarkslategray,
  },
  tube: {
    width: Width.width_26,
    backgroundColor: COLORS.colorLavender,
    borderColor: COLORS.colorLightsteelblue100,
    paddingHorizontal: 0,
    paddingVertical: Padding.padding_4,
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderRadius: Border.br_6,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  text2: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
  },
  span18: {
    flex: 1, // ✅ width remove
  },
  span: {
    width: 95,
    borderRightWidth: 0.5,
    minHeight: 26,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderColor: COLORS.colorLightsteelblue200,
  },

  span7: {
    width: 70, // Fiber Type label
    borderRightWidth: 0.5,
    minHeight: 26,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  span10: {
    width: 70,
    borderWidth: 0.5,
    borderColor: COLORS.colorLightsteelblue200,
  },
  span11: {
    width: 80,
    borderWidth: 0.5,
    borderColor: COLORS.colorLightsteelblue200,
    justifyContent: 'center',
  },
});
