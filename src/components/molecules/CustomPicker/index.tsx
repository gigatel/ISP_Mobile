import React, {useState, useMemo, FC} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
} from 'react-native';
import {BackHeader} from '@molecules';
import {Screen} from '@organisms';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '@navigation/navigator';
import {IMAGES} from '@res';
type Props = NativeStackScreenProps<RootStackParamList, 'CustomerPickerScreen'>;
const CustomerPickerScreen: FC<Props> = ({navigation, route}) => {
  const {data, selectedValue, onSelect} = route.params;
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () =>
      data.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  );
  return (
    <Screen preset="fixed">
      <BackHeader
        headerTitle="Select Customer"
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Image source={IMAGES.search} style={styles.searchIcon} />
            <TextInput
              placeholder="Search customers..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              autoFocus={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} style={styles.clearBtn}>
                <Text style={styles.clearText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Results Count */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsText}>
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </Text>
          </View>
        </View>
        {/* Customer List */}
        <FlatList
          data={filtered}
          contentContainerStyle={styles.listContent}
          keyExtractor={item => item.value}
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => {
            const isSelected = item.value === selectedValue;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  navigation.goBack();
                }}
                style={[
                  styles.customerItem,
                  isSelected && styles.customerItemSelected,
                ]}>
                <View style={styles.customerContent}>
                  {item.icon && (
                    <View
                      style={[
                        styles.customerIconWrapper,
                        isSelected && styles.customerIconWrapperSelected,
                      ]}>
                      <Image source={item.icon} style={styles.customerIcon} />
                    </View>
                  )}

                  <Text
                    style={[
                      styles.customerLabel,
                      isSelected && styles.customerLabelSelected,
                    ]}
                    numberOfLines={2}>
                    {item.label}
                  </Text>
                </View>

                {isSelected && (
                  <View style={styles.checkmarkContainer}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptyText}>
                Try adjusting your search terms
              </Text>
            </View>
          }
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F8FAFC',
  },

  container: {
    flex: 1,
  },

  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  searchBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },

  searchIcon: {
    width: 20,
    height: 20,
    tintColor: '#64748B',
    marginRight: 12,
  },

  searchInput: {
    fontSize: 16,
    flex: 1,
    color: '#0F172A',
    padding: 0,
  },

  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  clearText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },

  resultsHeader: {
    marginTop: 12,
  },

  resultsText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  customerItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  customerItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.15,
    elevation: 4,
  },

  customerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  customerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  customerIconWrapperSelected: {
    backgroundColor: '#DBEAFE',
  },

  customerIcon: {
    width: 28,
    height: 28,
  },
  customerLabel: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
  },
  customerLabelSelected: {
    color: '#1E40AF',
  },
  checkmarkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkmark: {
    fontSize: 16,
    color: '#FFFFFF',
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
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
export default CustomerPickerScreen;
