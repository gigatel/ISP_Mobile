import {RootStackParamList} from '@navigation/navigator';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {Screen} from '@organisms';
import {BackHeader} from '@molecules';
import React, {useCallback, useEffect, useState} from 'react';
import LinearGradient from 'react-native-linear-gradient';
import {
  Padding,
  Gap,
  BoxShadow,
  Border,
  FontSize,
  FontFamily,
  LineHeight,
  LetterSpacing,
  Opacity,
  Height,
  Width,
} from '../../res/globalStyle.ts';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import {ticketService} from '../../services/ticketService.ts';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TicketsList'
>;
const TicketsList: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'COMPLAINTS' | 'TASKS'>(
    'COMPLAINTS',
  );

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
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${hours}:${minutes}`;
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
  }, [activeTab, selectedDate]);

  useEffect(() => {
    setTickets([]);
    setFilteredTickets([]);
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

  const handleTicketPress = useCallback(
    (ticket: any) => {
      navigation.navigate('TicketDetails', {
        ticketId: ticket.id,
        comingFrom: activeTab,
      });
    },
    [navigation, activeTab],
  );

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

      console.log('🎯 RENDERING TICKET:', {
        id: item.id,
        rawStatus: item.rawData?.status,
        mappedStatus: item.status,
        displayStatus: displayStatus,
        transactionNo: item.transactionNo,
      });

      return (
        <Pressable
          style={styles.frameFlexBox}
          onPress={() => handleTicketPress(item)}>
          <View style={[styles.frameView, styles.frameParentShadowBox]}>
            <View style={[styles.frameParent2, styles.frameParentFlexBox]}>
              <LinearGradient
                style={[styles.c08350Wrapper, styles.wrapperFlexBox]}
                locations={[0, 1]}
                colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0)']}
                useAngle={true}
                angle={180}>
                <Text style={[styles.c08350, styles.asgByTypo]}>
                  {item.transactionNo}
                </Text>
              </LinearGradient>
              <View style={[styles.frameParent3, styles.parentFlexBox1]}>
                <LinearGradient
                  style={[styles.gigatelWrapper, styles.wrapperFlexBox]}
                  locations={[0, 1]}
                  colors={[
                    'rgba(255, 255, 255, 0.12)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  useAngle={true}
                  angle={180}>
                  <Text style={[styles.c08350, styles.asgByTypo]}>GIGATEL</Text>
                </LinearGradient>
                <LinearGradient
                  style={[styles.assignedWrapper, styles.frameItemShadowBox]}
                  locations={[0, 1]}
                  colors={[
                    'rgba(255, 255, 255, 0.12)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  useAngle={true}
                  angle={180}>
                  <Text style={[styles.c08350, styles.asgByTypo]}>
                    {displayStatus.toUpperCase()}
                  </Text>
                </LinearGradient>
                <LinearGradient
                  style={[styles.wrapper, styles.wrapperFlexBox]}
                  locations={[0, 1]}
                  colors={[
                    'rgba(255, 255, 255, 0.12)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  useAngle={true}
                  angle={180}>
                  <Text style={[styles.c08350, styles.asgByTypo]}>
                    {calculateDuration(
                      item.assignedDate,
                      item.endTime || item.ticketEndTime,
                      displayStatus,
                    )}
                  </Text>
                </LinearGradient>
              </View>
            </View>
            <View style={styles.frameChild} />
            <View style={styles.parentFlexBox}>
              <View
                style={[
                  styles.gigatelSolutionsPrivateLimiParent,
                  styles.parentFlexBox,
                ]}>
                <Text
                  style={[styles.gigatelSolutionsPrivate, styles.asgByTypo]}>
                  {item.customerName || 'N/A'}
                </Text>
                <LinearGradient
                  style={[styles.frameItem, styles.frameItemShadowBox]}
                  locations={[0, 1]}
                  colors={[
                    'rgba(255, 255, 255, 0.12)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  useAngle={true}
                  angle={180}
                />
              </View>
              {item.ticketType === 'complaint' ? (
                <>
                  <View style={styles.frameParent5}>
                    <View style={styles.frameParent6}>
                      <View style={styles.circuitIdWrapper}>
                        <Text style={[styles.circuitId, styles.dateTypo]}>
                          Circuit ID
                        </Text>
                      </View>
                      <View style={styles.container}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {`: `}
                        </Text>
                      </View>
                      <View style={styles.gignet4p24250949Parent}>
                        <Text
                          style={[styles.gignet4p24250949, styles.text3Typo]}>
                          {item.circuitId || 'N/A'}
                        </Text>
                        <Image
                          source={IMAGES.copyImage}
                          style={styles.vectorIcon2}
                          resizeMode="cover"
                        />
                      </View>
                    </View>
                    <View style={styles.frameParent6}>
                      <View style={styles.circuitIdWrapper}>
                        <Text style={[styles.circuitId, styles.dateTypo]}>
                          Issue Type
                        </Text>
                      </View>
                      <View style={styles.container}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {`: `}
                        </Text>
                      </View>
                      <View style={styles.fiberWrapper}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {item.natureOfFault || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.frameParent6}>
                      <View style={styles.circuitIdWrapper}>
                        <Text style={[styles.circuitId, styles.dateTypo]}>
                          Remarks
                        </Text>
                      </View>
                      <View style={styles.container}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {`: `}
                        </Text>
                      </View>
                      <View style={styles.fiberWrapper}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {item.remark || item.description || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.frameParent6}>
                      <View style={styles.circuitIdWrapper}>
                        <Text style={[styles.date, styles.dateTypo]}>Date</Text>
                      </View>
                      <View style={styles.container}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {`: `}
                        </Text>
                      </View>
                      <View style={styles.fiberWrapper}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {item.assignedDate
                            ? formatDate(item.assignedDate)
                            : 'N/A'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.frameParent5}>
                    {item.circuitId?.trim() !== '' && (
                      <View style={styles.frameParent6}>
                        <View style={styles.circuitIdWrapper}>
                          <Text style={[styles.circuitId, styles.dateTypo]}>
                            Circuit ID
                          </Text>
                        </View>
                        <View style={styles.container}>
                          <Text style={[styles.text3, styles.text3Typo]}>
                            {`: `}
                          </Text>
                        </View>
                        <View style={styles.gignet4p24250949Parent}>
                          <Text
                            style={[styles.gignet4p24250949, styles.text3Typo]}>
                            {item.circuitId}
                          </Text>
                          <Image
                            source={IMAGES.copyImage}
                            style={styles.vectorIcon2}
                            resizeMode="cover"
                          />
                        </View>
                      </View>
                    )}
                    <View style={styles.frameParent6}>
                      <View style={styles.circuitIdWrapper}>
                        <Text style={[styles.circuitId, styles.dateTypo]}>
                          Task Type
                        </Text>
                      </View>
                      <View style={styles.container}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {`: `}
                        </Text>
                      </View>
                      <View style={styles.fiberWrapper}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {item.taskType || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.frameParent6}>
                      <View style={styles.circuitIdWrapper}>
                        <Text style={[styles.circuitId, styles.dateTypo]}>
                          Remarks
                        </Text>
                      </View>
                      <View style={styles.container}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {`: `}
                        </Text>
                      </View>
                      <View style={styles.fiberWrapper}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {item.remark || item.description || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.frameParent6}>
                      <View style={styles.circuitIdWrapper}>
                        <Text style={[styles.date, styles.dateTypo]}>Date</Text>
                      </View>
                      <View style={styles.container}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {`: `}
                        </Text>
                      </View>
                      <View style={styles.fiberWrapper}>
                        <Text style={[styles.text3, styles.text3Typo]}>
                          {item.assignedDate
                            ? formatDate(item.assignedDate)
                            : 'N/A'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
              <View style={[styles.frameParent10, styles.frameParentFlexBox]}>
                <View style={styles.asgByParent}>
                  <Text style={[styles.asgBy, styles.asgByTypo]}>
                    {`Asg by : `}
                  </Text>
                  <Text style={[styles.shubhamDobriyal, styles.asgByTypo]}>
                    {getFirstName(item.assignedBy, 20)}
                  </Text>
                </View>
                <View style={styles.asgByParent}>
                  <Text style={[styles.asgBy, styles.asgByTypo]}>
                    {`Asg to : `}
                  </Text>
                  <Text style={[styles.naveenKumar, styles.asgByTypo]}>
                    {truncateChars(item.assignedTo, 20)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [
      handleTicketPress,
      formatDate,
      getPriorityColor,
      getStatusColor,
      calculateDuration,
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
      <View style={styles.headerWrapper}>
        <BackHeader headerTitle="Tickets" onBackPress={handleBackPress} />
        <View style={styles.floatingCard}>
          <View style={styles.searchBox}>
            <Image
              source={IMAGES.search}
              style={styles.vectorIcon}
              resizeMode="cover"
            />
            <TextInput
              placeholder="Search"
              placeholderTextColor="#999"
              value={searchText}
              onChangeText={handleSearch}
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity
            style={styles.dateBox}
            onPress={() => setShowDatePicker(true)}>
            <Image
              source={IMAGES.calendar}
              style={styles.calendarDaysSolidFull1Icon}
              resizeMode="cover"
            />
            <Text style={styles.dateText}>
              {selectedDate.toLocaleDateString('en-GB').replace(/\//g, '/')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabsSection}>
        <View style={styles.tabsContainer}>
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
      </View>

      {/* TICKET LIST */}
      <FlatList
        data={filteredTickets}
        showsVerticalScrollIndicator={false}
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
      />
      {/* DATE PICKER MODAL */}
      <DatePicker
        modal
        open={showDatePicker}
        date={selectedDate}
        mode="date"
        maximumDate={new Date()}
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
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
    paddingBottom: SIZE.MVS(28),
  },
  floatingCard: {
    position: 'absolute',
    bottom: -SIZE.MVS(22),
    width: '94%',
    alignSelf: 'center',
    flexDirection: 'row',
    borderRadius: SIZE.MS(12),
    alignItems: 'center',
    zIndex: 1000,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(12),
    marginRight: SIZE.MS(8),
    elevation: 3,
  },
  Iconnew: {
    width: 125,
    height: 125,
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  searchInput: {
    flex: 1,
    fontSize: SIZE.MS(14),
    color: COLORS.TEXT_DARK,
    padding: 2,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(12),
    elevation: 3,
  },
  ticketsParentFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  dateText: {
    fontSize: SIZE.MS(12),
    color: COLORS.TEXT_DARK,
    marginLeft: SIZE.MS(6),
  },

  /* Tabs */
  tabsSection: {
    paddingHorizontal: SIZE.MS(8),
    paddingTop: SIZE.MVS(30),
    backgroundColor: 'transparent',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(10),
  },
  tab: {
    flex: 1,
    paddingVertical: SIZE.MVS(10),
    borderRadius: SIZE.MS(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  activeTab: {
    backgroundColor: '#0ca2dd',
  },
  tabText: {
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.SEMI_BOLD,
  },
  activeTabText: {
    color: COLORS.WHITE,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: FontSize.fs_14,
  },

  list: {
    padding: SIZE.MS(10),
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
    fontFamily: FONTS.REGULAR,
  },

  frameFlexBox: {
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  frameParentShadowBox: {
    backgroundColor: COLORS.colorWhite,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    borderRadius: Border.br_6,
  },

  text3Typo: {
    textAlign: 'left',
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.REGULAR,
  },
  parentFlexBox1: {
    gap: Gap.gap_4,
    flexDirection: 'row',
  },
  frameParentFlexBox: {
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  wrapperFlexBox: {
    paddingVertical: Padding.padding_5,
    paddingHorizontal: Padding.padding_6,
    borderRadius: Border.br_4,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  asgByTypo: {
    lineHeight: LineHeight.lh_14,
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
  },
  frameItemShadowBox: {
    boxShadow: BoxShadow.shadow_drop3,
    backgroundColor: '#ffc107',
    elevation: 10,
  },
  parentFlexBox: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
  },
  dateTypo: {
    opacity: Opacity.opacity_0_8,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.REGULAR,
  },

  vectorIcon: {
    height: 14,
    width: 14,
  },
  calendarDaysSolidFull1Icon: {
    height: 20,
    width: 20,
  },

  frameView: {
    padding: Padding.padding_8,
    gap: Gap.gap_8,
    alignSelf: 'stretch',
  },
  frameParent2: {
    gap: 0,
  },
  c08350Wrapper: {
    boxShadow: BoxShadow.shadow_drop1,
    backgroundColor: '#155dfc',
    elevation: 10,
  },
  c08350: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorWhite,
  },
  frameParent3: {
    justifyContent: 'flex-end',
    flex: 1,
  },
  gigatelWrapper: {
    boxShadow: BoxShadow.shadow_drop2,
    backgroundColor: '#3ec21e',
    elevation: 10,
  },
  assignedWrapper: {
    paddingVertical: Padding.padding_5,
    paddingHorizontal: Padding.padding_6,
    borderRadius: Border.br_4,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: '#ffc107',
  },
  wrapper: {
    boxShadow: BoxShadow.shadow_drop4,
    backgroundColor: '#ea820b',
    elevation: 10,
  },
  frameChild: {
    height: Height.height_1,
    backgroundColor: COLORS.colorWhitesmoke,
    alignSelf: 'stretch',
  },

  gigatelSolutionsPrivateLimiParent: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  gigatelSolutionsPrivate: {
    color: COLORS.colorDarkslategray,
    fontSize: FontSize.fs_13,
    lineHeight: LineHeight.lh_14,
    flex: 1,
  },

  frameItem: {
    height: Height.height_14,
    width: Width.width_14,
    borderRadius: 50,
  },

  frameParent5: {
    gap: Gap.gap_6,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  frameParent6: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  circuitIdWrapper: {
    width: Width.width_73,
    justifyContent: 'center',
  },
  circuitId: {
    width: Width.width_83,
    display: 'flex',
    alignItems: 'center',
  },
  container: {
    justifyContent: 'center',
  },
  text3: {
    color: COLORS.colorDarkslategray,
    alignSelf: 'stretch',
  },
  gignet4p24250949Parent: {
    gap: Gap.gap_8,
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  gignet4p24250949: {
    color: COLORS.colorDarkslategray,
  },
  vectorIcon2: {
    height: Height.height_15,
    width: 13,
  },
  fiberWrapper: {
    justifyContent: 'center',
    flex: 1,
  },
  date: {
    alignSelf: 'stretch',
  },

  frameParent10: {
    borderStyle: 'solid',
    borderColor: COLORS.colorWhitesmoke,
    borderTopWidth: 1,
    paddingTop: Padding.padding_8,
    paddingBottom: Padding.padding_4,
    gap: Gap.gap_20,
  },
  asgByParent: {
    gap: Gap.gap_2,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  asgBy: {
    opacity: Opacity.opacity_0_7,
    color: COLORS.colorDarkslategray,
    fontSize: FontSize.fs_13,
    lineHeight: LineHeight.lh_14,
  },
  shubhamDobriyal: {
    color: COLORS.colorMediumslateblue,
    fontSize: FontSize.fs_13,
    lineHeight: LineHeight.lh_14,
  },
  naveenKumar: {
    fontSize: FontSize.fs_13,
    lineHeight: LineHeight.lh_14,
    color: COLORS.PRIMARY,
  },
});
export default TicketsList;
