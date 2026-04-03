import React, {useState, useMemo, FC} from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import {BackHeader} from '@molecules';
import {Screen} from '@organisms';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '@navigation/navigator';
import {COLORS, IMAGES, SIZE} from '@res';
import {Padding, FontFamily} from '../../res/globalStyle';
type Props = NativeStackScreenProps<RootStackParamList, 'CustomerPickerScreen'>;
const CustomerPickerScreen: FC<Props> = ({navigation, route}) => {
  const {data = [], selectedValue, onSelect, title} = route.params;
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.filter(item =>
      (item?.label || '').toLowerCase().includes((search || '').toLowerCase()),
    );
  }, [data, search]);
  return (
    <Screen preset="fixed">
      <BackHeader
        headerTitle={title || 'Select'}
        onBackPress={() => navigation.goBack()}
      />
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Image source={IMAGES.search} style={styles.searchIcon} />
          <TextInput
            placeholder="Search"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#999"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>
      {/* List Results */}
      <FlatList
        data={filtered}
        contentContainerStyle={styles.listContent}
        keyExtractor={item => String(item.value)}
        showsVerticalScrollIndicator={false}
        renderItem={({item}) => {
          const isSelected = item.value === selectedValue;
          return (
            <Pressable
              onPress={() => {
                onSelect({
                  value: item.value,
                  label: item.label,
                  icon: item.icon,
                  extra: item.extra || {},
                  fullData: item.fullData || {},
                });
                navigation.goBack();
              }}
              style={[
                styles.itemContainer,
                isSelected && styles.itemContainerSelected,
              ]}>
              <View style={styles.itemContent}>
                {item?.icon && (
                  <Image source={item.icon} style={styles.itemIcon} />
                )}
                <View style={styles.textContainer}>
                  <Text
                    style={[
                      styles.itemLabel,
                      isSelected && styles.itemLabelSelected,
                    ]}
                    numberOfLines={1}>
                    {item.label || 'N/A'}
                  </Text>
                  {item?.extra?.chamberName && (
                    <Text
                      style={[
                        styles.itemSubtext,
                        isSelected && styles.itemSubtextSelected,
                      ]}>
                      {item.extra.chamberName}
                    </Text>
                  )}
                  {(item?.extra?.startAddress || item?.extra?.endAddress) && (
                    <Text style={styles.itemSubtext}>
                      {item.extra.startAddress || ''}
                      {item.extra.startAddress && item.extra.endAddress
                        ? ' - '
                        : ''}
                      {item.extra.endAddress || ''}
                    </Text>
                  )}
                </View>
              </View>
              {/* Checkmark for selected */}
              {isSelected && (
                <View style={styles.checkmarkContainer}>
                  <Text style={styles.checkmark}>✓</Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View>
            <Image
              source={IMAGES.noImage}
              style={styles.Iconnew}
              resizeMode="cover"
            />
            <View
              style={[styles.nodatafounddivnew, styles.ticketsParentFlexBox]}>
              <Text style={styles.noDataFound2}>No Data Found</Text>
            </View>
          </View>
        }
        scrollEnabled={true}
      />
    </Screen>
  );
};
const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.WHITE,
  },
  searchBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: '#999',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 12,
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  itemContainer: {
    backgroundColor: COLORS.WHITE,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  itemContainerSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#4B90FF',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 20,
    height: 20,
    tintColor: '#4B90FF',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  itemLabelSelected: {
    color: '#1565C0',
  },
  itemSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  itemSubtextSelected: {
    color: '#1565C0',
  },
  checkmarkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4B90FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  checkmark: {
    fontSize: 16,
    color: COLORS.WHITE,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  Iconnew: {
    width: SIZE.MS(125),
    height: SIZE.MS(125),
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  nodatafound: {
    width: 406,
    height: 185,
    paddingVertical: Padding.padding_20,
    justifyContent: 'center',
  },
  nodatafounddivnew: {
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  noDataFound2: {
    fontSize: 15,
    color: COLORS.colorDarkslategray300,
    opacity: 0.6,

    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  ticketsParentFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});

export default CustomerPickerScreen;
