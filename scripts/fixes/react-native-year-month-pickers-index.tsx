import React, {useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type AnimationType = 'none' | 'slide' | 'fade';

type YearMonthPickerProps = {
  show: boolean;
  value?: string;
  animationType?: AnimationType;
  primaryColor?: string;
  onClose: () => void;
  onDone: (value: string) => void;
};

type MonthItem = {
  label: string;
  value: string;
};

const MONTHS: MonthItem[] = [
  {label: 'Jan', value: '01'},
  {label: 'Feb', value: '02'},
  {label: 'Mar', value: '03'},
  {label: 'Apr', value: '04'},
  {label: 'May', value: '05'},
  {label: 'Jun', value: '06'},
  {label: 'Jul', value: '07'},
  {label: 'Aug', value: '08'},
  {label: 'Sep', value: '09'},
  {label: 'Oct', value: '10'},
  {label: 'Nov', value: '11'},
  {label: 'Dec', value: '12'},
];

function parseValue(value?: string) {
  const now = new Date();
  const [rawMonth, rawYear] = (value || '').split('/');
  const monthNumber = Number(rawMonth);
  const yearNumber = Number(rawYear);

  return {
    month:
      monthNumber >= 1 && monthNumber <= 12
        ? String(monthNumber).padStart(2, '0')
        : String(now.getMonth() + 1).padStart(2, '0'),
    year:
      yearNumber >= 1900 && yearNumber <= 3000
        ? String(yearNumber)
        : String(now.getFullYear()),
  };
}

function buildYears(selectedYear: string) {
  const currentYear = new Date().getFullYear();
  const focusedYear = Number(selectedYear) || currentYear;
  const startYear = Math.min(currentYear - 20, focusedYear - 5);
  const endYear = Math.max(currentYear + 10, focusedYear + 5);

  return Array.from({length: endYear - startYear + 1}, (_, index) =>
    String(startYear + index),
  );
}

const YearMonthPicker: React.FC<YearMonthPickerProps> = ({
  show,
  value,
  animationType = 'slide',
  primaryColor = '#9b42f5',
  onClose,
  onDone,
}) => {
  const initialValue = useMemo(() => parseValue(value), [value]);
  const [selectedMonth, setSelectedMonth] = useState(initialValue.month);
  const [selectedYear, setSelectedYear] = useState(initialValue.year);
  const years = useMemo(() => buildYears(selectedYear), [selectedYear]);

  useEffect(() => {
    if (show) {
      const nextValue = parseValue(value);
      setSelectedMonth(nextValue.month);
      setSelectedYear(nextValue.year);
    }
  }, [show, value]);

  const selectedColor = {borderColor: primaryColor};
  const selectedText = {color: primaryColor};

  return (
    <Modal
      visible={show}
      animationType={animationType}
      transparent
      onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.sheet}>
          <Text style={[styles.title, selectedText]}>Select Month</Text>

          <View style={styles.columns}>
            <View style={styles.column}>
              <Text style={styles.columnTitle}>Month</Text>
              <FlatList
                data={MONTHS}
                keyExtractor={item => item.value}
                showsVerticalScrollIndicator={false}
                renderItem={({item}) => {
                  const active = item.value === selectedMonth;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setSelectedMonth(item.value)}
                      style={[styles.option, active && selectedColor]}>
                      <Text style={[styles.optionText, active && selectedText]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <View style={styles.column}>
              <Text style={styles.columnTitle}>Year</Text>
              <FlatList
                data={years}
                keyExtractor={item => item}
                showsVerticalScrollIndicator={false}
                initialScrollIndex={Math.max(years.indexOf(selectedYear) - 2, 0)}
                getItemLayout={(_, index) => ({
                  length: 48,
                  offset: 48 * index,
                  index,
                })}
                renderItem={({item}) => {
                  const active = item === selectedYear;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setSelectedYear(item)}
                      style={[styles.option, active && selectedColor]}>
                      <Text style={[styles.optionText, active && selectedText]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onClose}
              style={[styles.button, styles.cancelButton]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onDone(`${selectedMonth}/${selectedYear}`)}
              style={[styles.button, {backgroundColor: primaryColor}]}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '78%',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  title: {
    marginBottom: 14,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  columns: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 260,
    maxHeight: 360,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    marginBottom: 8,
    color: '#656565',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  option: {
    height: 44,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  optionText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
  },
  button: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#F2F2F2',
  },
  cancelText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '700',
  },
  doneText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default YearMonthPicker;
