import {RootStackParamList} from '@navigation/navigator';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {COLORS, SIZE} from '@res';
import {Screen} from '@organisms';
import {BackHeader} from '@molecules';
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import {ticketService} from '../../services/ticketService.ts';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'OverTimeSelect'
>;

const OverTimeSelect: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<any[]>([]);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'COMPLAINTS' | 'TASKS'>(
    'COMPLAINTS',
  );

  // Calculate minimum date (yesterday)
  const getMinimumDate = useCallback(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  }, []);

  // Calculate maximum date (today)
  const getMaximumDate = useCallback(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
  }, []);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const formatDate = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const month = months[date.getMonth()];
      const hours = String(date.getHours()).padStart(2, '0');
      const years = String(date.getFullYear());
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${years} ${hours}:${minutes}`;
    } catch {
      return '';
    }
  }, []);

  const formatDateForAPI = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const getFirstName = (name?: string): string => {
    if (!name) return 'N/A';
    return name.trim().split(' ')[0];
  };

  const truncateChars = (name?: string, maxChars = 20): string => {
    if (!name) return 'N/A';
    const trimmedName = name.trim();
    if (trimmedName.includes(',')) {
      const names = trimmedName.split(',').map(n => n.trim());
      const firstNames = names.map(n => n.split(' ')[0]).filter(Boolean);
      if (firstNames.length === 2) {
        const result = `${firstNames[0]}, ${firstNames[1]}`;
        return result.length <= maxChars
          ? result
          : result.slice(0, maxChars - 3) + '...';
      }
      if (firstNames.length > 2) {
        const result = `${firstNames[0]}, ${firstNames[1]}`;
        return result.length <= maxChars - 3
          ? result + '...'
          : result.slice(0, maxChars - 3) + '...';
      }
      const single = firstNames[0];
      return single.length >= maxChars
        ? single.slice(0, maxChars - 3) + '...'
        : single;
    }
    const firstName = trimmedName.split(' ')[0];
    if (firstName.length > maxChars) {
      return firstName.slice(0, maxChars - 3) + '...';
    }
    return firstName;
  };

  const getStatusColor = useCallback((status: string) => {
    if (!status) return COLORS.TEXT_MEDIUM;

    const normalizedStatus = status.toLowerCase().trim();

    if (normalizedStatus === 'assigned') {
      return COLORS.WARNING;
    }
    if (normalizedStatus === 'started' || normalizedStatus === 'in-progress') {
      return COLORS.PRIMARY;
    }
    if (
      normalizedStatus === 'completed' ||
      normalizedStatus === 'complete' ||
      normalizedStatus === 'task complete' ||
      normalizedStatus === 'closed'
    ) {
      return COLORS.SUCCESS;
    }

    return COLORS.TEXT_MEDIUM;
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    if (!priority) return COLORS.TEXT_MEDIUM;
    switch (priority.toLowerCase()) {
      case 'high':
        return COLORS.ERROR;
      case 'medium':
        return COLORS.WARNING;
      case 'low':
        return COLORS.SUCCESS;
      default:
        return COLORS.TEXT_MEDIUM;
    }
  }, []);

  const loadTickets = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);

        const formattedDate = formatDateForAPI(selectedDate);
        const employeeData = ticketService.getEmployeeData();

        const payload = {
          moduleName: activeTab === 'TASKS' ? 'TASK' : 'COMPLAINTS',
          formId: activeTab === 'TASKS' ? 3 : 1,
          empId: employeeData.empId,
          date: formattedDate,
          companyId: employeeData.companyId,
        };
        console.log('🔥 LOADING TICKETS FOR:', activeTab);
        const response = await ticketService.getTickets(payload);
        const list = Array.isArray(response?.data) ? response.data : [];
        console.log('🔥 API RETURNED', list.length, 'tickets');
        if (list.length > 0) {
          console.log(
            '🔥 FIRST TICKET FULL:',
            JSON.stringify(list[0], null, 2),
          );
          console.log('🔥 RAW DATA STATUS:', list[0]?.rawData?.status);
          console.log('🔥 MAPPED STATUS:', list[0]?.status);
        }

        setTickets(list);
        setFilteredTickets(list);
      } catch (e) {
        console.log('❌ loadTickets error:', e);
        setTickets([]);
        setFilteredTickets([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, selectedDate, formatDateForAPI],
  );

  useEffect(() => {
    loadTickets();
    setSelectedTickets(new Set());
  }, [activeTab, selectedDate]);

  useEffect(() => {
    setTickets([]);
    setFilteredTickets([]);
    setSelectedTickets(new Set());
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [loadTickets]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTickets(false);
  }, [loadTickets]);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (text.trim() === '') {
        setFilteredTickets(tickets);
      } else {
        const filtered = tickets.filter(
          ticket =>
            (ticket.transactionNo &&
              ticket.transactionNo
                .toLowerCase()
                .includes(text.toLowerCase())) ||
            (ticket.customerName &&
              ticket.customerName.toLowerCase().includes(text.toLowerCase())) ||
            (ticket.circuitId &&
              ticket.circuitId.toLowerCase().includes(text.toLowerCase())) ||
            (ticket.taskType &&
              ticket.taskType.toLowerCase().includes(text.toLowerCase())),
        );
        setFilteredTickets(filtered);
      }
    },
    [tickets],
  );

  const toggleTicketSelection = useCallback((ticketId: string) => {
    setSelectedTickets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  }, []);

  const selectAllTickets = useCallback(() => {
    if (selectedTickets.size === filteredTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(
        new Set(filteredTickets.map(t => t.id || t.transactionNo)),
      );
    }
  }, [filteredTickets, selectedTickets]);

  const calculateDuration = useCallback(
    (assignedDate?: string, endDate?: string, status?: string): string => {
      if (!assignedDate) return '00:00:00';
      try {
        const start = new Date(assignedDate).getTime();

        const normalizedStatus = status?.toLowerCase().trim() || '';
        const isClosed =
          normalizedStatus === 'closed' ||
          normalizedStatus === 'completed' ||
          normalizedStatus === 'complete' ||
          normalizedStatus === 'task complete';

        const end =
          isClosed && endDate ? new Date(endDate).getTime() : Date.now();

        const diffMs = end - start;
        if (diffMs <= 0) return '00:00:00';

        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } catch {
        return '00:00:00';
      }
    },
    [],
  );

  const renderTicket = useCallback(
    ({item, index}: {item: any; index: number}) => {
      const displayStatus = item.rawData?.status || item.status || 'Assigned';
      const ticketId = item.id || item.transactionNo;
      const isSelected = selectedTickets.has(ticketId);

      console.log('🎯 RENDERING TICKET:', {
        id: item.id,
        rawStatus: item.rawData?.status,
        mappedStatus: item.status,
        displayStatus: displayStatus,
        transactionNo: item.transactionNo,
      });

      return (
        <TouchableOpacity
          style={[styles.card, isSelected && styles.cardSelected]}
          onPress={() => toggleTicketSelection(ticketId)}>
          <View style={styles.cardContent}>
            <View style={styles.checkbox}>
              <View
                style={[
                  styles.checkboxInner,
                  isSelected && styles.checkboxSelected,
                ]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>

            <View style={styles.ticketInfo}>
              <View style={styles.headerMainRow}>
                <Text style={styles.cardIndex}>{index + 1}.</Text>
                <Text style={styles.ticketId}>{item.transactionNo}</Text>
                <View
                  style={[
                    styles.badge,
                    {backgroundColor: getStatusColor(displayStatus)},
                  ]}>
                  <Text style={styles.badgeText}>
                    {displayStatus.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.customer}>{item.customerName}</Text>
              <Text style={styles.dateBadgeText}>
                {item.assignedDate ? formatDate(item.assignedDate) : 'N/A'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [
      formatDate,
      getPriorityColor,
      getStatusColor,
      calculateDuration,
      selectedTickets,
      toggleTicketSelection,
    ],
  );

  const keyExtractor = useCallback(
    (item: any, index: number) => `${item.ticketType}-${item.id || index}`,
    [],
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>
          Loading {activeTab.toLowerCase()}...
        </Text>
      </View>
    );
  }

  return (
    <Screen statusBgColor={COLORS.PRIMARY} loading={loading}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
      <BackHeader headerTitle="Select Ticket" onBackPress={handleBackPress} />

      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets..."
            value={searchText}
            onChangeText={handleSearch}
            placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
          />
        </View>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>
            {selectedDate.toLocaleDateString('en-GB')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'COMPLAINTS' && styles.activeTab]}
          onPress={() => setActiveTab('COMPLAINTS')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'COMPLAINTS' && styles.activeTabText,
            ]}>
            Complaints
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'TASKS' && styles.activeTab]}
          onPress={() => setActiveTab('TASKS')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'TASKS' && styles.activeTabText,
            ]}>
            Tasks
          </Text>
        </TouchableOpacity>
      </View>

      {filteredTickets.length > 0 && (
        <View style={styles.selectionBar}>
          <TouchableOpacity
            style={styles.selectAllBtn}
            onPress={selectAllTickets}>
            <Text style={styles.selectAllText}>
              {selectedTickets.size === filteredTickets.length
                ? 'Deselect All'
                : 'Select All'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.selectedCount}>
            {selectedTickets.size} selected
          </Text>
        </View>
      )}

      <FlatList
        data={filteredTickets}
        renderItem={renderTicket}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.PRIMARY]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : `No ${activeTab.toLowerCase()} found`}
            </Text>
            {!loading && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => loadTickets()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      {/* Bottom Next Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          disabled={selectedTickets.size === 0}
          style={[
            styles.nextBtn,
            selectedTickets.size === 0 && styles.nextBtnDisabled,
          ]}
          onPress={() => {
            const selectedIds = Array.from(selectedTickets);

            navigation.replace('MarkOverTime', {
              selectedTickets: selectedIds,
            });
          }}>
          <Text style={styles.nextBtnText}>Next</Text>
        </TouchableOpacity>
      </View>

      <DatePicker
        modal
        open={showDatePicker}
        date={selectedDate}
        mode="date"
        minimumDate={getMinimumDate()}
        maximumDate={getMaximumDate()}
        onConfirm={date => {
          setShowDatePicker(false);
          setSelectedDate(date);
        }}
        onCancel={() => setShowDatePicker(false)}
      />
    </Screen>
  );
};
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
  },
  loadingText: {
    marginTop: SIZE.MS(12),
    color: COLORS.TEXT_MEDIUM,
    fontSize: SIZE.MS(16),
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(16),
    paddingVertical: SIZE.MVS(10),
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_DEFAULT,
  },
  searchBox: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(8),
    marginRight: SIZE.MS(12),
    borderWidth: 1,
    borderColor: COLORS.BORDER_DEFAULT,
  },
  searchInput: {fontSize: SIZE.MS(14), color: COLORS.TEXT_DARK},
  dateBtn: {
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(8),
    borderRadius: SIZE.MS(6),
    borderWidth: 1,
    borderColor: COLORS.BORDER_DEFAULT,
  },
  dateText: {fontSize: SIZE.MS(12), color: COLORS.TEXT_DARK},
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_DEFAULT,
  },
  tab: {
    flex: 1,
    paddingVertical: SIZE.MVS(12),
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {borderBottomColor: COLORS.PRIMARY},
  tabText: {fontSize: SIZE.MS(15), color: COLORS.TEXT_MEDIUM},
  activeTabText: {color: COLORS.PRIMARY, fontWeight: 'bold'},
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(16),
    paddingVertical: SIZE.MVS(10),
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_DEFAULT,
  },
  selectAllBtn: {
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(6),
  },
  selectAllText: {
    fontSize: SIZE.MS(14),
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
  },
  selectedCount: {
    fontSize: SIZE.MS(14),
    color: COLORS.TEXT_MEDIUM,
    fontWeight: '500',
  },
  list: {padding: SIZE.MS(10)},
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(10),
    paddingVertical: SIZE.MVS(8),
    marginBottom: SIZE.MVS(6),
    elevation: 2,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    marginRight: SIZE.MS(10),
    paddingTop: SIZE.MVS(2),
  },
  checkboxInner: {
    width: SIZE.MS(22),
    height: SIZE.MS(22),
    borderRadius: SIZE.MS(4),
    borderWidth: 2,
    borderColor: COLORS.BORDER_DEFAULT,
    backgroundColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  checkmark: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(16),
    fontWeight: 'bold',
  },
  ticketInfo: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZE.MVS(6),
  },
  headerLeft: {flex: 1},
  badges: {flexDirection: 'row', flexWrap: 'wrap'},
  badge: {
    paddingHorizontal: SIZE.MS(5),
    paddingVertical: SIZE.MVS(2),
    borderRadius: SIZE.MS(3),
    marginRight: SIZE.MS(4),
    marginBottom: SIZE.MVS(2),
  },
  badgeText: {
    fontSize: SIZE.MS(8),
    color: COLORS.WHITE,
    fontWeight: 'bold',
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  dot: {width: SIZE.MS(8), height: SIZE.MS(8), borderRadius: SIZE.MS(4)},
  customer: {
    fontSize: SIZE.MS(13),
    fontWeight: 'bold',
    color: COLORS.TEXT_DARKER,
    marginBottom: SIZE.MVS(5),
  },
  details: {marginBottom: SIZE.MVS(6)},
  row: {
    flexDirection: 'row',
    marginBottom: SIZE.MVS(2),
    alignItems: 'flex-start',
  },
  label: {
    fontSize: SIZE.MS(10),
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
    width: SIZE.MS(70),
  },
  value: {
    fontSize: SIZE.MS(10),
    color: COLORS.TEXT_DARK,
    flex: 1,
    lineHeight: SIZE.MS(14),
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZE.MVS(60),
  },
  emptyText: {color: COLORS.TEXT_LIGHT, fontSize: SIZE.MS(16)},
  retryBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SIZE.MS(20),
    paddingVertical: SIZE.MVS(10),
    borderRadius: SIZE.MS(8),
    marginTop: SIZE.MVS(16),
  },
  retryText: {color: COLORS.WHITE, fontSize: SIZE.MS(14), fontWeight: 'bold'},
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZE.MVS(1),
    justifyContent: 'flex-start',
  },
  cardIndex: {
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
    fontSize: SIZE.MS(17),
    marginRight: SIZE.MS(7),
  },
  ticketId: {
    color: COLORS.TEXT_DARKER,
    fontWeight: 'bold',
    fontSize: SIZE.MS(15),
    marginRight: SIZE.MS(7),
  },
  topRightBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  dateBadge: {
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    borderRadius: SIZE.MS(5),
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MVS(2),
    marginRight: SIZE.MS(5),
  },
  dateBadgeText: {
    fontSize: SIZE.MS(12),
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
  },
  footerRow: {
    marginTop: SIZE.MVS(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(2),
  },
  footerLabel: {
    fontSize: SIZE.MS(11),
    color: COLORS.TEXT_MEDIUM,
    fontWeight: '500',
  },
  bottomBar: {
    padding: SIZE.MS(16),
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_DEFAULT,
    backgroundColor: COLORS.WHITE,
  },

  nextBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SIZE.MVS(12),
    borderRadius: SIZE.MS(8),
    alignItems: 'center',
    justifyContent: 'center',
  },

  nextBtnDisabled: {
    backgroundColor: COLORS.TEXT_LIGHT,
  },

  nextBtnText: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(16),
    fontWeight: 'bold',
  },

  footerValue: {color: COLORS.TEXT_DARKER, fontWeight: 'bold'},
});

export default OverTimeSelect;
