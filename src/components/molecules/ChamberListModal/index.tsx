import {Buttons} from '@atoms';
import {COLORS, CONSTANT, FONTS, IMAGES, SIZE} from '@res';
import {DataType} from '@types';
import {
  Padding,
  Gap,
  FontFamily,
  FontSize,
  Border,
  LineHeight,
} from '../../../res/globalStyle';
import React, {FC, memo, useEffect, useState} from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {NotFoundView} from '../../atoms/list-view/not-found';
import ModalSheet from '../modal-sheet';
import {Common} from '@utils';

interface ChamberListModalProps {
  show: boolean;
  enableSearch?: boolean;
  type: 'single' | 'multiple';
  rowType: DataType.SheetRowType;
  rowUniqueKey: string;
  searchKeys?: string[];
  title: string;
  data: any[];
  value: null | any;
  onDone: (value: any) => void;
  onClose: () => void;
}

export type SearchBarProps = {
  value: string;
  placeholder: string;
  onChangeText: (txt: string) => void;
  onClear: () => void;
};

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  placeholder,
  onChangeText,
  onClear,
}) => {
  return (
    <View style={styles.inputOuterView}>
      <Image source={IMAGES.search} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
        style={styles.inputView}
        placeholder={placeholder}
      />
      {value !== '' && (
        <TouchableOpacity
          activeOpacity={0.65}
          onPress={onClear}
          style={styles.closeButtonView}>
          <Image style={styles.closeIcon} source={IMAGES.close} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Utility function for formatting distance
const formatKmToMeters = (kmInput: number | string | null | undefined) => {
  const km = typeof kmInput === 'string' ? parseFloat(kmInput) : kmInput ?? 0;

  if (!isFinite(km)) return '0m';

  const m = km * 1000;

  let str: string;
  if (m < 1) str = m.toFixed(3);
  else if (m < 10) str = m.toFixed(2);
  else if (m < 100) str = m.toFixed(1);
  else str = Math.round(m).toString();

  str = str.replace(/\.?0+$/, '');
  return `${str}m`;
};

const PatrollerLisItem = memo(({item}: {item: DataType.TodayBehalfOf}) => {
  return (
    <View style={styles.patItemView}>
      <View style={styles.nameCodeView}>
        <Text style={styles.patEmpCodeText}>{`${item.employeeCode} - `}</Text>
        <Text style={styles.patNameText}>{item.name}</Text>
      </View>
      <View style={styles.shiftIconView}>
        <Image
          source={
            item.isDay
              ? IMAGES.dayShift
              : item.isEvening
              ? IMAGES.eveningShift
              : IMAGES.nightShift
          }
          style={[
            styles.shiftIcon,
            item.isDay && styles.dayShiftIcon,
            item.isEvening && styles.eveningShiftIcon,
            item.isNight && styles.nightShiftIcon,
          ]}
        />
        <Text
          style={[
            styles.patShiftNameText,
            item.isDay && styles.patShiftNameTextDay,
            item.isEvening && styles.patShiftNameTextEvening,
          ]}>
          {item.shiftName}
        </Text>
      </View>
    </View>
  );
});

const DefaultLisItem = memo(({item}: {item: any}) => (
  <View style={styles.patItemView}>
    <Text style={styles.defaultNameText}>{item.name}</Text>
  </View>
));

const LabelValueLisItem = memo(({item}: {item: any}) => (
  <View style={styles.patItemView}>
    <Text style={styles.defaultNameText}>{item.label}</Text>
  </View>
));

const ChamberTaskLisItem = memo(
  ({item, isSelected}: {item: DataType.Chamber; isSelected?: boolean}) => {
    // Get status badge colors
    const getStatusColors = (status: string | undefined) => {
      if (!status) return null;

      const statusLower = status.toLowerCase();
      if (statusLower === 'visited') {
        return {
          backgroundColor: '#1F9D00',
          textColor: COLORS.colorWhite,
        };
      } else if (statusLower === 'pending') {
        return {
          backgroundColor: '#E5AC00',
          textColor: COLORS.colorWhite,
        };
      }
      return {
        backgroundColor: '#E5AC00',
        textColor: COLORS.colorWhite,
      };
    };

    const statusColors = getStatusColors(item.status);

    return (
      <View style={styles.itemSpaceBlock}>
        <View
          style={[
            styles.card,
            styles.cardBorder,
            isSelected && styles.cardBorderSelected, // 👈 Orange border when selected
          ]}>
          <View style={[styles.cardbody, styles.labelFlexBox]}>
            <View style={[styles.label, styles.labelFlexBox]}>
              <View style={[styles.row, styles.rowFlexBox]}>
                <Text style={[styles.name, styles.mTypo]}>Name:</Text>
                <Text style={[styles.gigsify17180003, styles.nameTypo]}>
                  {item.chamberIdStr || 'N/A'}
                </Text>
              </View>
              <View style={[styles.row, styles.rowFlexBox]}>
                <Text style={[styles.name, styles.mTypo]}>Address:</Text>
                <Text style={styles.sifyBstnB458safdarjung} numberOfLines={1}>
                  {item.chamberAddress || 'N/A'}
                </Text>
              </View>
            </View>
            <View style={styles.ftFlexBox}>
              <Text style={[styles.distance460m, styles.visitedLayout]}>
                <Text style={styles.distance}>
                  <Text style={styles.distance2}>Distance:</Text>{' '}
                </Text>
                <Text
                  style={[
                    styles.mTypo,
                    {
                      color: 'red',
                      fontSize: SIZE.MVS(12),
                      fontFamily: FONTS.MEDIUM,
                    },
                  ]}>
                  {formatKmToMeters(item?.distance ?? 0)}
                </Text>
              </Text>
              {statusColors && (
                <View
                  style={[
                    styles.badge,
                    styles.badgeBorder,
                    {backgroundColor: statusColors.backgroundColor},
                  ]}>
                  <Text
                    style={[
                      styles.visited,
                      styles.visitedTypo,
                      {color: statusColors.textColor},
                    ]}>
                    {item.status}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={CONSTANT.BUTTON_OPACITY}
            onPress={() => {
              Common.openMaps(
                parseFloat(item?.chamberLat ?? '0'),
                parseFloat(item?.chamberLong ?? '0'),
              );
            }}>
            <Image
              source={IMAGES.mapNew}
              style={styles.cardfooterIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

const NearestChamberLisItem = memo(
  ({item}: {item: DataType.NearestChamber}) => (
    <View style={styles.chamberItemView}>
      <Text style={styles.chamberNameText}>
        {`${item?.chamber_id ?? ''} - `}
        <Text
          style={[styles.chamberNameText, {color: COLORS.CARD_DESCRIPTION}]}>
          {`${item?.chamber_name ?? ''}`}
        </Text>
      </Text>
      <Text style={styles.chamberDistanceText}>
        {`${item?.chamber_address ?? ''}`}
      </Text>
    </View>
  ),
);

const CustomerLisItem = memo(({item}: {item: any}) => (
  <View style={styles.customerItemView}>
    <Image
      source={IMAGES.Customer}
      style={{
        width: SIZE.MS(25),
        height: SIZE.MS(25),
        marginRight: SIZE.MS(10),
      }}
    />
    <Text style={styles.chamberDistanceText}>
      {`${item?.CustomerName ?? ''}`}
    </Text>
  </View>
));

const CircuitLisItem = memo(({item}: {item: any}) => (
  <View style={styles.customerItemView}>
    <Image
      source={IMAGES.Circuit}
      style={{
        width: SIZE.MS(25),
        height: SIZE.MS(25),
        marginRight: SIZE.MS(10),
        tintColor: COLORS.PRIMARY,
      }}
    />
    <Text style={styles.chamberDistanceText}>
      {`${item?.CircuitName ?? ''} (${item?.EndAddress ?? ''})`}
    </Text>
  </View>
));

const ChamberListModal: FC<ChamberListModalProps> = ({
  show,
  enableSearch = true,
  rowUniqueKey = 'id',
  rowType = 'default',
  searchKeys,
  type,
  data,
  value,
  title,
  onClose,
  onDone,
}) => {
  const [selectedData, setSelectedData] = useState<any>([]);
  const [searchData, setSearchData] = useState<any>([]);
  const [searchText, setSearchText] = useState<string>('');
  const listRef = React.useRef<FlatList>(null);

  useEffect(() => {
    if (value && show && value.length > 0) {
      setSelectedData(value);
    }
    return () => {
      setSearchText('');
      setSearchData([]);
    };
  }, [data, rowUniqueKey, show, type, value]);

  return React.useMemo(() => {
    const onChangeText = (txt: string) => {
      if (!searchKeys) return;
      const filteredData = data.filter((item: any) =>
        searchKeys.some(key =>
          item[key]?.toString().toLowerCase().includes(txt.toLowerCase()),
        ),
      );
      setSearchData(filteredData);
      setSearchText(txt);
    };

    const onDonePress = () => {
      if (selectedData?.length <= 0) {
        setSelectedData([]);
        onClose();
      } else {
        onDone(selectedData);
        setSelectedData([]);
      }
    };

    const onItemPress = (item: any, isAdded: boolean) => {
      let allData = [...selectedData];
      if (type === 'single') {
        setSelectedData([item]);
      } else {
        allData = isAdded
          ? allData.filter(e => e[rowUniqueKey] !== item[rowUniqueKey])
          : [...allData, item];
        setSelectedData(allData);
      }
    };
    const showListData = searchText === '' ? data : searchData;
    return (
      <ModalSheet
        show={show}
        title={title}
        primaryTitle={'Done'}
        closeTitle={'Close'}
        onClose={onClose}
        onClosePress={onClose}
        onPrimaryPress={onDonePress}>
        {enableSearch && (
          <SearchBar
            value={searchText}
            placeholder={'Search here...'}
            onChangeText={onChangeText}
            onClear={() => setSearchText('')}
          />
        )}
        <FlatList
          ref={listRef}
          data={showListData}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listC}
          ListEmptyComponent={NotFoundView}
          keyExtractor={(item, index) => item[rowUniqueKey] + index + title}
          renderItem={({item}) => {
            const active = selectedData?.some(
              e => e[rowUniqueKey] === item[rowUniqueKey],
            );
            return (
              <TouchableOpacity
                key={item[rowUniqueKey]}
                onPress={() => onItemPress(item, active)}
                activeOpacity={0.9}>
                {rowType === 'behalfOf' ? (
                  <PatrollerLisItem item={item} />
                ) : rowType === 'chamber' ? (
                  <ChamberTaskLisItem item={item} isSelected={active} />
                ) : rowType === 'nearestChamber' ? (
                  <NearestChamberLisItem item={item} />
                ) : rowType === 'customer' ? (
                  <CustomerLisItem item={item} />
                ) : rowType === 'circuit' ? (
                  <CircuitLisItem item={item} />
                ) : rowType === 'labelValue' ? (
                  <LabelValueLisItem item={item} />
                ) : (
                  <DefaultLisItem item={item} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </ModalSheet>
    );
  }, [
    searchText,
    data,
    searchData,
    show,
    title,
    enableSearch,
    searchKeys,
    selectedData,
    onDone,
    onClose,
    type,
    rowUniqueKey,
    rowType,
  ]);
};

export default memo(ChamberListModal);

const styles = StyleSheet.create({
  customerItemView: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chamberItemView: {
    flex: 1,
    paddingRight: SIZE.MS(10),
  },
  chamberNameText: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY_DARK,
    flex: 1,
  },
  chamberDistanceText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.ACCENT_ORANGE,
  },
  listC: {paddingBottom: 100},
  shiftIconView: {
    flexDirection: 'row',
  },
  nightShiftIcon: {
    tintColor: COLORS.TEXT_DARKER,
  },
  eveningShiftIcon: {
    tintColor: COLORS.PRIMARY,
  },
  dayShiftIcon: {
    tintColor: COLORS.ACCENT_ORANGE,
  },
  shiftIcon: {
    height: SIZE.MS(18),
    width: SIZE.MS(18),
    marginRight: SIZE.MS(10),
  },
  nameCodeView: {
    flexDirection: 'row',
    marginBottom: SIZE.MVS(10),
    alignItems: 'center',
  },
  patEmpCodeText: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_DARKER,
  },
  patShiftNameTextEvening: {color: COLORS.PRIMARY},
  patShiftNameTextDay: {color: COLORS.ACCENT_ORANGE},
  patShiftNameText: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_DARKER,
    flex: 1,
  },
  patNameText: {
    fontSize: SIZE.MS(17),
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY_DARK,
    flex: 1,
  },
  defaultNameText: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.TEXT_DARK,
    flex: 1,
  },
  patItemView: {
    flex: 1,
    marginLeft: SIZE.MS(10),
  },

  // Search Bar
  closeButtonView: {
    width: 35,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    height: 16,
    width: 16,
    tintColor: COLORS.TEXT_DARK,
  },
  searchIcon: {
    height: 20,
    width: 20,
    tintColor: COLORS.TEXT_PLACEHOLDER,
  },
  inputView: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#222222',
    paddingHorizontal: 15,
  },
  inputOuterView: {
    height: 48,
    borderWidth: 1,
    borderRadius: 6,
    borderColor: COLORS.TEXT_PLACEHOLDER,
    margin: 15,
    marginHorizontal: 10,
    paddingLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Chamber Card Styles
  itemSpaceBlock: {
    paddingVertical: Padding.padding_6,
    paddingHorizontal: Padding.padding_12,
    flex: 1,
  },
  card: {
    backgroundColor: '#E5AC000C',
    borderColor: '#E5AC004C', // Default light orange border
  },
  cardBorderSelected: {
    borderColor: '#E5AC00', // 👈 Dark orange border when selected
    borderWidth: 2, // Thicker border for selected state
  },
  cardbody: {
    flex: 1,
  },
  label: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: Gap.gap_2,
  },
  row: {
    gap: Gap.gap_3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    fontSize: FontSize.fs_14,
  },
  gigsify17180003: {
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    flex: 1,
  },
  sifyBstnB458safdarjung: {
    fontSize: FontSize.fs_13,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    flex: 1,
  },
  distance460m: {
    textAlign: 'left',
  },
  distance: {
    fontFamily: FontFamily.switzer,
  },
  distance2: {
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  cardBorder: {
    padding: Padding.padding_12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: Border.br_16,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  labelFlexBox: {
    gap: Gap.gap_2,
    alignItems: 'center',
  },
  rowFlexBox: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  mTypo: {
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
  },
  nameTypo: {
    fontSize: FontSize.fs_14,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    // color: COLORS.colorDarkslategray,
  },
  visitedLayout: {
    lineHeight: LineHeight.lh_18,
    fontSize: FontSize.fs_12,
  },
  badgeBorder: {
    paddingVertical: Padding.padding_1,
    paddingHorizontal: Padding.padding_5,
    borderRadius: Border.br_5,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  visitedTypo: {
    fontWeight: '600',
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  ftFlexBox: {
    gap: Gap.gap_8,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  m: {
    fontFamily: FontFamily.switzer,
    color: '#E5AC00',
  },
  badge: {
    paddingVertical: Padding.padding_1,
    paddingHorizontal: Padding.padding_5,
    borderRadius: Border.br_5,
  },
  visited: {
    color: COLORS.colorWhite,
    lineHeight: LineHeight.lh_18,
    fontSize: FontSize.fs_12,
  },
  cardfooterIcon: {
    height: 30,
    width: 24,
  },
});
