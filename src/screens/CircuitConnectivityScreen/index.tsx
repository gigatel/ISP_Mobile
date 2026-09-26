import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {FONTS, IMAGES, SIZE} from '@res';

const SAMPLE_CUSTOMERS = [
  {
    customerId: '3',
    customerName: 'SIFY TECHNOLOGIES PRIVATE LIMITED',
  },
  {
    customerId: '20',
    customerName: 'GTPL BROADBAND PRIVATE LIMITED',
  },
  {
    customerId: '81',
    customerName: 'TATA COMMUNICATIONS LIMITED',
  },
];

const valueOf = (item: any, ...keys: string[]) => {
  for (const key of keys) {
    if (item?.[key] != null) {
      return item[key];
    }
  }
  return '';
};

const CircuitConnectivityScreen = ({navigation}: any) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<any[]>(SAMPLE_CUSTOMERS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadCustomers = useCallback((refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    setCustomers(SAMPLE_CUSTOMERS);
    requestAnimationFrame(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, []);

  const filteredCustomers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return customers;
    }
    return customers.filter(item =>
      [
        valueOf(item, 'companyName', 'customerName', 'name', 'CompanyName'),
        valueOf(item, 'circuitName', 'CircuitName'),
        valueOf(item, 'circuitId', 'CircuitId'),
      ]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }, [customers, query]);

  const renderCustomer = ({item}: {item: any}) => {
    const companyName = String(
      valueOf(item, 'companyName', 'customerName', 'name', 'CompanyName') ||
        'Unnamed customer',
    );
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Open circuits for ${companyName}`}
        onPress={() =>
          navigation.navigate('InfraConnectivity', {customer: item})
        }
        style={styles.customerCard}>
        <View style={styles.customerIconWrap}>
          <Image source={IMAGES.Building} style={styles.customerIcon} />
        </View>
        <Text numberOfLines={2} style={styles.customerName}>
          {companyName}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#814CF3', '#5B25D6']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={[styles.header, {paddingTop: insets.top}]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
          style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Circuit</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.searchBox}>
          <Image source={IMAGES.search} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by Circuit / Customer"
            placeholderTextColor="#777D8E"
            returnKeyType="search"
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#7440E8" size="large" />
            <Text style={styles.stateText}>Loading customers…</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCustomers}
            renderItem={renderCustomer}
            keyExtractor={(item, index) =>
              String(
                valueOf(
                  item,
                  'customerCompanyId',
                  'customerId',
                  'id',
                  'CustomerId',
                ) || index,
              )
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              filteredCustomers.length ? styles.list : styles.emptyList
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadCustomers(true)}
                colors={['#7440E8']}
                tintColor="#7440E8"
              />
            }
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Image source={IMAGES.Circuit} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>
                  {error ? 'Could not load circuits' : 'No customer found'}
                </Text>
                <Text style={styles.stateText}>
                  {error || 'Try a different customer or circuit name.'}
                </Text>
                {!!error && (
                  <TouchableOpacity
                    onPress={() => loadCustomers()}
                    style={styles.retryButton}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
    </View>
  );
};

export default CircuitConnectivityScreen;

const shadow = {
  shadowColor: '#261449',
  shadowOffset: {width: 0, height: 3},
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F3F5F9'},
  header: {
    minHeight: SIZE.MVS(96),
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SIZE.MS(12),
    paddingBottom: SIZE.MVS(18),
  },
  backButton: {
    width: SIZE.MS(34),
    height: SIZE.MS(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {fontSize: SIZE.MS(34), lineHeight: SIZE.MS(34), color: '#FFF'},
  headerTitle: {
    color: '#FFF',
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(18),
    marginBottom: 4,
  },
  body: {flex: 1, paddingHorizontal: SIZE.MS(16), paddingTop: SIZE.MVS(14)},
  searchBox: {
    ...shadow,
    minHeight: SIZE.MVS(48),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(12),
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  searchIcon: {
    width: SIZE.MS(18),
    height: SIZE.MS(18),
    tintColor: '#697080',
    resizeMode: 'contain',
  },
  searchInput: {
    flex: 1,
    paddingVertical: SIZE.MVS(10),
    paddingHorizontal: SIZE.MS(10),
    color: '#272A35',
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(13),
  },
  list: {paddingTop: SIZE.MVS(10), paddingBottom: SIZE.MVS(24)},
  emptyList: {flexGrow: 1},
  customerCard: {
    ...shadow,
    minHeight: SIZE.MVS(50),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(9),
    marginBottom: SIZE.MVS(8),
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  customerIconWrap: {
    width: SIZE.MS(28),
    height: SIZE.MS(28),
    borderRadius: SIZE.MS(7),
    backgroundColor: '#EEE9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerIcon: {
    width: SIZE.MS(17),
    height: SIZE.MS(17),
    resizeMode: 'contain',
    tintColor: '#4F5564',
  },
  customerName: {
    flex: 1,
    marginHorizontal: SIZE.MS(9),
    color: '#343845',
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(12),
  },
  chevron: {color: '#8250E9', fontSize: SIZE.MS(25)},
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(28),
  },
  emptyIcon: {
    width: SIZE.MS(48),
    height: SIZE.MS(48),
    resizeMode: 'contain',
    tintColor: '#8C65E9',
    marginBottom: SIZE.MVS(12),
  },
  emptyTitle: {
    fontFamily: FONTS.SEMI_BOLD,
    color: '#303342',
    fontSize: SIZE.MS(15),
    textAlign: 'center',
  },
  stateText: {
    fontFamily: FONTS.REGULAR,
    color: '#767B89',
    fontSize: SIZE.MS(12),
    textAlign: 'center',
    marginTop: SIZE.MVS(7),
  },
  retryButton: {
    marginTop: SIZE.MVS(14),
    backgroundColor: '#7440E8',
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(20),
    paddingVertical: SIZE.MVS(9),
  },
  retryText: {color: '#FFF', fontFamily: FONTS.SEMI_BOLD},
});
