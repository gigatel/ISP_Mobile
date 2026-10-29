import React from 'react';
import {
  ScrollView,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {FONTS} from '@res';

type Props = {
  customerName: string;
  splitterName: string;
  leg: number;
  updated: boolean;
  bottomInset: number;
  onBackToList: () => void;
};

export default function CustomerConnectionSuccess({
  customerName,
  splitterName,
  leg,
  updated,
  bottomInset,
  onBackToList,
}: Props) {
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onBackToList}>
      <View
        style={[styles.backdrop, {paddingBottom: Math.max(bottomInset, 20)}]}>
        <ScrollView
          style={styles.dialog}
          contentContainerStyle={styles.content}>
          <View style={styles.card} accessibilityViewIsModal>
            <View style={styles.iconHalo}>
              <View
                style={styles.icon}
                accessibilityLabel="Connection successful">
                <Text style={styles.check}>✓</Text>
              </View>
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {updated ? 'Connection updated' : 'Customer connected!'}
            </Text>
            <Text style={styles.message}>
              {customerName} is connected to {splitterName}.
            </Text>
            <View style={styles.legBadge}>
              <Text style={styles.legText}>Splitter leg {leg}</Text>
            </View>
            <Text style={styles.caption}>
              Your connection details have been saved successfully.
            </Text>
            <View style={styles.footer}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Back to splitter list"
                onPress={onBackToList}>
                <LinearGradient
                  colors={['#8858F9', '#6036C4']}
                  style={styles.button}>
                  <Text style={styles.buttonText}>Back to Splitter List</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 17, 40, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    flexGrow: 0,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: 20,
  },
  content: {flexGrow: 0},
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  iconHalo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#EFFAF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#27BA69',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {fontSize: 42, color: '#FFFFFF'},
  title: {
    fontFamily: FONTS.BOLD,
    fontSize: 22,
    color: '#303541',
    textAlign: 'center',
  },
  message: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 14,
    lineHeight: 22,
    color: '#555C6A',
    textAlign: 'center',
    marginTop: 12,
  },
  legBadge: {
    backgroundColor: '#F0E9FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 20,
  },
  legText: {fontFamily: FONTS.BOLD, fontSize: 12, color: '#7546D7'},
  caption: {
    fontFamily: FONTS.REGULAR,
    fontSize: 12,
    lineHeight: 19,
    color: '#8A909C',
    textAlign: 'center',
    marginTop: 20,
  },
  footer: {alignSelf: 'stretch', marginTop: 24},
  button: {
    minHeight: 48,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  buttonText: {fontFamily: FONTS.BOLD, fontSize: 14, color: '#FFFFFF'},
});
