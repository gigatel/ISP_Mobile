import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {FONTS} from '@res';
import {
  distanceLabel,
  powerLabel,
  splitterRatio,
  splitterTitle,
} from '../../services/lastMileConnectivityService';
import type {Splitter} from './types';
import type {SplitterMapConnectionSummary} from '../../services/splitterCustomerMap';

type Props = {
  items: {splitter: Splitter; number: number}[];
  connectionStats?: Record<string, SplitterMapConnectionSummary>;
  maxHeight: number;
  bottomInset: number;
  onClose: () => void;
  onOpen: (splitter: Splitter) => void;
};

export default function SplitterMapDetails({
  items,
  connectionStats,
  maxHeight,
  bottomInset,
  onClose,
  onOpen,
}: Props) {
  const [selectedId, setSelectedId] = useState(items[0].splitter.id);
  const selected =
    items.find(item => item.splitter.id === selectedId) ?? items[0];
  const {splitter, number} = selected;
  const connections = connectionStats?.[splitter.id];
  const field = (label: string, value: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close splitter map details"
      />
      <View
        style={[
          styles.sheet,
          {maxHeight, paddingBottom: Math.max(bottomInset, 12)},
        ]}
        accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Splitter Details</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close details"
            onPress={onClose}
            style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>
        {items.length > 1 && (
          <View>
            <Text style={styles.groupHint}>
              {items.length} splitters at this location — select a number
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}>
              {items.map(item => (
                <TouchableOpacity
                  key={item.splitter.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Select splitter ${item.number}: ${item.splitter.name}`}
                  accessibilityState={{
                    selected: item.splitter.id === splitter.id,
                  }}
                  onPress={() => setSelectedId(item.splitter.id)}
                  style={[
                    styles.tab,
                    item.splitter.id === splitter.id && styles.activeTab,
                  ]}>
                  <Text
                    style={[
                      styles.tabText,
                      item.splitter.id === splitter.id && styles.activeTabText,
                    ]}>
                    #{item.number}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <ScrollView
          style={styles.detailsScroll}
          showsVerticalScrollIndicator
          contentContainerStyle={styles.body}>
          <View style={styles.nameRow}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{number}</Text>
            </View>
            <Text style={styles.name}>{splitterTitle(splitter)}</Text>
          </View>
          <View style={styles.badges}>
            <Text style={styles.typeBadge}>
              Type: {splitterRatio(splitter)}
            </Text>
            <Text style={styles.freeBadge}>{splitter.free} Free</Text>
            <Text style={styles.distanceBadge}>
              {distanceLabel(splitter.distance)}
            </Text>
          </View>
          {splitter.code ? field('Splitter Code', splitter.code) : null}
          {field(
            'Connected Customers',
            String(
              connections?.totalCustomers ??
                (connectionStats ? '—' : splitter.connectedCustomers ?? '—'),
            ),
          )}
          {connections &&
            field(
              'Connected Legs',
              connections.connectedLegs.length
                ? connections.connectedLegs.join(', ')
                : 'None',
            )}
          <View style={styles.powerRow}>
            {field('Optical Power In', powerLabel(splitter.opticalPowerIn))}
            {field('Optical Power Out', powerLabel(splitter.opticalPowerOut))}
          </View>
          {(splitter.rxPower != null || splitter.txPower != null) && (
            <View style={styles.powerRow}>
              {field('RX Power', powerLabel(splitter.rxPower))}
              {field('TX Power', powerLabel(splitter.txPower))}
            </View>
          )}
          {field('Address', splitter.address || '—')}
          {field('Landmark', splitter.landmark || '—')}
          {field(
            'Lat/Lng',
            splitter.latitude !== null && splitter.longitude !== null
              ? `${splitter.latitude}, ${splitter.longitude}`
              : '—',
          )}
        </ScrollView>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="View customer connections"
          onPress={() => onOpen(splitter)}
          style={styles.openButton}>
          <LinearGradient
            colors={['#8858F9', '#6036C4']}
            style={styles.openGradient}>
            <Text style={styles.openText}>View Customer Connections</Text>
            <Text style={styles.openArrow}>›</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(25,16,43,0.35)',
    zIndex: 10,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DED7E8',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {fontFamily: FONTS.BOLD, fontSize: 16, color: '#352944'},
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {fontSize: 26, color: '#84758F'},
  groupHint: {
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    color: '#8D7D9D',
    marginBottom: 8,
  },
  tabs: {gap: 7, paddingBottom: 12},
  tab: {
    minWidth: 42,
    minHeight: 34,
    borderRadius: 9,
    backgroundColor: '#F2EDF9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  activeTab: {backgroundColor: '#8050DF'},
  tabText: {fontFamily: FONTS.BOLD, fontSize: 12, color: '#8050DF'},
  activeTabText: {color: '#FFFFFF'},
  body: {paddingBottom: 8},
  nameRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    marginBottom: 12,
  },
  numberBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#8050DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {fontFamily: FONTS.BOLD, fontSize: 13, color: '#FFFFFF'},
  name: {
    flex: 1,
    fontFamily: FONTS.BOLD,
    fontSize: 14,
    lineHeight: 21,
    color: '#352944',
  },
  badges: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 15},
  typeBadge: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 11,
    color: '#8050DF',
    backgroundColor: '#F1EAFB',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
  },
  freeBadge: {
    fontFamily: FONTS.BOLD,
    fontSize: 11,
    color: '#228B5C',
    backgroundColor: '#ECF8F0',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
  },
  distanceBadge: {
    fontFamily: FONTS.BOLD,
    fontSize: 11,
    color: '#0075E6',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
  },
  detailsScroll: {flexGrow: 0, flexShrink: 1},
  field: {flexGrow: 1, marginBottom: 12},
  label: {
    fontFamily: FONTS.BOLD,
    fontSize: 10,
    color: '#9A8AA9',
    marginBottom: 4,
  },
  value: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 12,
    lineHeight: 19,
    color: '#51425F',
  },
  powerRow: {flexDirection: 'row', gap: 14},
  openButton: {marginTop: 4},
  openGradient: {
    minHeight: 44,
    borderRadius: 9,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  openText: {fontFamily: FONTS.MEDIUM, fontSize: 12, color: '#FFFFFF'},
  openArrow: {fontSize: 23, color: '#FFFFFF'},
});
