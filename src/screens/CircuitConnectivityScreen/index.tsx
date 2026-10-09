import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
import {HeaderPattern} from '../InfraConnectivityScreen/ConnectivityIcons';
import {companyService, UserCompany} from '../../services/companyService';

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
  const [connectivityType, setConnectivityType] = useState<
    'infra' | 'customer'
  >('infra');
  const [typeOpen, setTypeOpen] = useState(false);
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadCompanies = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const response = await companyService.getUserCompanies();
      if (response.success) {
        setCompanies(response.data);
      } else {
        setCompanies([]);
        setError(response.message || 'Failed to load companies');
      }
    } catch (loadError: any) {
      setCompanies([]);
      setError(loadError?.message || 'Failed to load companies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const filteredCompanies = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return companies;
    }
    return companies.filter(item =>
      [
        valueOf(item, 'name', 'companyName', 'CompanyName'),
        valueOf(item, 'companyCode', 'CompanyCode'),
        valueOf(item, 'organizationName', 'OrganizationName'),
      ]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }, [companies, query]);

  const renderCompany = ({item}: {item: UserCompany}) => {
    const companyName = String(
      valueOf(
        item,
        'organizationName',
        'OrganizationName',
        'name',
        'companyName',
        'CompanyName',
      ) || 'Unnamed company',
    );
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Open circuits for ${companyName}`}
        onPress={() =>
          navigation.navigate('InfraConnectivity', {
            company: item,
            connectivityType,
          })
        }
        style={styles.customerCard}>
        <View style={styles.customerIconWrap}>
          <Image source={IMAGES.Building} style={styles.customerIcon} />
        </View>
        <Text numberOfLines={2} style={styles.customerName}>
          {companyName}
        </Text>
        <Image source={IMAGES.rightarrow} style={styles.chevronIcon} />
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
        <HeaderPattern />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
          style={styles.backButton}>
          <Image source={IMAGES.arrowBack} style={styles.backImage} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Circuit</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Connectivity Type"
            accessibilityState={{expanded: typeOpen}}
            onPress={() => setTypeOpen(!typeOpen)}
            style={styles.typeButton}>
            <Text style={styles.typeText}>
              {connectivityType === 'infra'
                ? 'Infra Connectivity'
                : 'Customer End Connectivity'}
            </Text>
            <Image source={IMAGES.down} style={styles.dropdownIcon} />
          </TouchableOpacity>
          <View style={styles.searchBox}>
            <Image source={IMAGES.search} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#777D8E"
              returnKeyType="search"
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>
        </View>
        {typeOpen && (
          <View style={styles.typeMenu}>
            {(['infra', 'customer'] as const).map(type => (
              <TouchableOpacity
                key={type}
                accessibilityRole="button"
                accessibilityState={{selected: connectivityType === type}}
                style={styles.typeOption}
                onPress={() => {
                  setConnectivityType(type);
                  setTypeOpen(false);
                }}>
                <Text
                  style={[
                    styles.typeText,
                    connectivityType === type && styles.selectedType,
                  ]}>
                  {type === 'infra'
                    ? 'Infra Connectivity'
                    : 'Customer End Connectivity'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#7440E8" size="large" />
            <Text style={styles.stateText}>Loading companies…</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCompanies}
            renderItem={renderCompany}
            keyExtractor={(item, index) =>
              String(valueOf(item, 'id', 'companyId', 'CompanyId') || index)
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              filteredCompanies.length ? styles.list : styles.emptyList
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadCompanies(true)}
                colors={['#7440E8']}
                tintColor="#7440E8"
              />
            }
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Image source={IMAGES.Circuit} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>
                  {error ? 'Could not load companies' : 'No company found'}
                </Text>
                <Text style={styles.stateText}>
                  {error || 'Try a different company name or code.'}
                </Text>
                {!!error && (
                  <TouchableOpacity
                    onPress={() => loadCompanies()}
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

const styles = StyleSheet.create({
  filterRow: {flexDirection: 'row', gap: 8},
  typeButton: {
    width: '43%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    minHeight: 44,
    backgroundColor: '#FFF',
    borderRadius: 6,
  },
  dropdownIcon: {
    width: 18,
    height: 18,
    tintColor: '#737987',
    resizeMode: 'contain',
  },
  selectedType: {color: '#7440E8'},
  typeText: {fontSize: 11, color: '#515663', flexShrink: 1},
  typeMenu: {
    backgroundColor: '#FFF',
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  typeOption: {padding: 14},
  screen: {flex: 1, backgroundColor: '#F3F5F9'},
  header: {
    minHeight: SIZE.MVS(90),
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SIZE.MS(12),
    paddingBottom: SIZE.MVS(12),
  },
  backButton: {
    width: SIZE.MS(34),
    height: SIZE.MS(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backImage: {width: 22, height: 22, tintColor: '#FFF', resizeMode: 'contain'},
  backArrow: {fontSize: SIZE.MS(34), lineHeight: SIZE.MS(34), color: '#FFF'},
  headerTitle: {
    color: '#FFF',
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(18),
    marginBottom: 4,
  },
  body: {flex: 1, paddingHorizontal: SIZE.MS(16), paddingTop: SIZE.MVS(14)},
  searchBox: {
    flex: 1,
    minHeight: SIZE.MVS(44),
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
    minHeight: SIZE.MVS(42),
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
    backgroundColor: '#FFF',
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
  chevronIcon: {
    width: 12,
    height: 12,
    tintColor: '#8250E9',
    resizeMode: 'contain',
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
