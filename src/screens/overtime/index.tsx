import React, {FC, useEffect, useState, useCallback} from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import {Screen} from '@organisms';
import {ScreenProps} from '@types';
import {COLORS, FONTS} from '@res';
import {BackHeader} from '@molecules';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Buttons} from '@atoms';
import {useDispatch, useSelector} from 'react-redux';
import {RootStackParamList} from '@navigation/navigator';
import {getOverTimeList} from '@slices/attendance.slice';
import {RootState, StoreDispatch} from '@reducers';
import {Common, Preferences} from '@utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'OverTime'>;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const YEARS = Array.from({length: 6}, (_, i) => 2022 + i); // 2022–2027

const OverTime: FC<ScreenProps.OverTime> = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useDispatch<StoreDispatch>();

  const otList = useSelector(
    (state: RootState) => state.attendance.overTimeList,
  );

  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const loadOT = async (m: number, y: number) => {
    const empId = await Preferences.getData('EMPLOYEE_ID');

    dispatch(
      getOverTimeList({
        page: 1,
        size: 30,
        search: '',
        empId: Number(empId),
        month: m + 1,
        year: y,
      }),
    );
  };

  useEffect(() => {
    loadOT(month, year);
  }, [month, year]);

  const formatTime = (time?: string) =>
    time ? Common.formatDate(new Date(time), 'HH:mm') : '--';

  const formatDate = (date?: string) =>
    date ? Common.formatDate(new Date(date), 'DD MMM') : '--';

  const renderRow = ({item}: any) => (
    <View style={styles.row}>
      <Text style={styles.cell}>{formatDate(item.date)}</Text>
      <Text style={styles.cell}>{item.ticketNo}</Text>
      <Text style={styles.cell}>{formatTime(item.startTime)}</Text>
      <Text style={styles.cell}>{formatTime(item.endTime)}</Text>
      <Text style={styles.cell}>{item.workingHours?.slice(0, 5)}</Text>
      <Text style={styles.cell}>{item.status}</Text>
    </View>
  );

  return (
    <Screen statusBgColor={COLORS.PRIMARY}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
      <BackHeader headerTitle="OverTime" onBackPress={handleBackPress} />
      {/* Month & Year Selector */}
      <View style={styles.selectorRow}>
        <TouchableOpacity
          style={styles.selectorBox}
          onPress={() => setShowMonthModal(true)}>
          <Text style={styles.selectorLabel}>Select month</Text>
          <Text style={styles.selectorValue}>{MONTHS[month]}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.selectorBox}
          onPress={() => setShowYearModal(true)}>
          <Text style={styles.selectorLabel}>Select year</Text>
          <Text style={styles.selectorValue}>{year}</Text>
        </TouchableOpacity>
      </View>
      {/* Month Modal */}
      <Modal visible={showMonthModal} transparent animationType="fade">
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowMonthModal(false)}>
          <View style={styles.modalBox}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={styles.modalItem}
                onPress={() => {
                  setMonth(i);
                  setShowMonthModal(false);
                }}>
                <Text style={styles.modalText}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Year Modal */}
      <Modal visible={showYearModal} transparent animationType="fade">
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowYearModal(false)}>
          <View style={styles.modalBox}>
            {YEARS.map(y => (
              <TouchableOpacity
                key={y}
                style={styles.modalItem}
                onPress={() => {
                  setYear(y);
                  setShowYearModal(false);
                }}>
                <Text style={styles.modalText}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Table Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerCell}>Date</Text>
        <Text style={styles.headerCell}>Ticket ID</Text>
        <Text style={styles.headerCell}>Start</Text>
        <Text style={styles.headerCell}>End</Text>
        <Text style={styles.headerCell}>WH</Text>
        <Text style={styles.headerCell}>Status</Text>
      </View>
      <FlatList
        data={otList ?? []}
        keyExtractor={item => String(item.id)}
        renderItem={renderRow}
        contentContainerStyle={{paddingBottom: 120}}
      />
      <View style={styles.bottomButton}>
        <Buttons
          title="MARK OVERTIME"
          onPress={() => navigation.navigate('MarkOverTime')}
        />
      </View>
    </Screen>
  );
};

export default OverTime;
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
  },
  modalItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  modalText: {
    fontSize: 16,
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
  },

  selectorBox: {
    width: '48%',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    // Shadow (Android + iOS)
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 10,
  },
  headerCell: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: FONTS.SEMI_BOLD,
  },

  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  cell: {
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },

  bottomButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },

  selectorLabel: {
    fontSize: 12,
    color: '#8A8A8A',
    marginBottom: 4,
  },

  selectorValue: {
    fontSize: 16,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#000',
  },
});
