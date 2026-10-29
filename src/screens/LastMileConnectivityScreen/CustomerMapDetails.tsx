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
import CallCustomerButton from './CallCustomerButton';
import {splitterTitle} from '../../services/lastMileConnectivityService';
import type {SplitterCustomerLink} from '../../services/splitterCustomerMap';

type Props = {
  items: SplitterCustomerLink[];
  maxHeight: number;
  bottomInset: number;
  onClose: () => void;
  onOpen: (link: SplitterCustomerLink) => void;
};

export default function CustomerMapDetails({
  items,
  maxHeight,
  bottomInset,
  onClose,
  onOpen,
}: Props) {
  const [selectedKey, setSelectedKey] = useState(items[0].key);
  const link = items.find(item => item.key === selectedKey) ?? items[0];
  const {customer, splitter, leg, splitterNumber} = link;
  const field = (label: string, value: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value || '—'}
      </Text>
    </View>
  );
  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close customer map details"
      />
      <View
        style={[
          styles.sheet,
          {maxHeight, paddingBottom: Math.max(bottomInset, 12)},
        ]}
        accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Customer Details</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close customer details"
            onPress={onClose}
            style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>
        {items.length > 1 && (
          <View>
            <Text style={styles.groupHint}>
              {items.length} customers at this location — select a connection
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}>
              {items.map(item => (
                <TouchableOpacity
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Select customer ${
                    item.customer.name || 'Unnamed'
                  } on splitter ${item.splitterNumber} leg ${item.leg}`}
                  accessibilityState={{selected: item.key === link.key}}
                  onPress={() => setSelectedKey(item.key)}
                  style={[
                    styles.tab,
                    item.key === link.key && styles.activeTab,
                  ]}>
                  <Text
                    style={[
                      styles.tabText,
                      item.key === link.key && styles.activeTabText,
                    ]}>
                    #{item.splitterNumber} · Leg {item.leg}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <ScrollView
          style={styles.detailsScroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator>
          <Text style={styles.name}>{customer.name || 'Customer'}</Text>
          <View style={styles.badges}>
            <Text style={styles.badge}>
              Splitter #{splitterNumber} · Leg {leg}
            </Text>
            <Text style={styles.badge}>{customer.connectivity}</Text>
            <Text
              style={[
                styles.status,
                customer.online === true
                  ? styles.online
                  : customer.online === false
                  ? styles.offline
                  : styles.unknown,
              ]}>
              {customer.online === true
                ? 'Online'
                : customer.online === false
                ? 'Offline'
                : 'Status unavailable'}
            </Text>
          </View>
          {field('Connected Splitter', splitterTitle(splitter))}
          {field('Splitter Code', splitter.code || '')}
          <View style={styles.mobileRow}>
            {field('Mobile Number', customer.mobile)}
            <CallCustomerButton mobile={customer.mobile} />
          </View>
          {field('MAC Address', customer.mac)}
          {customer.connectivity === 'Physical GIG' && (
            <>
              {field('GIG', customer.gig)}
              <View style={styles.row}>
                {field('Tube', customer.tube)}
                {field('Core', customer.core)}
              </View>
            </>
          )}
          {field('Address', customer.address)}
          {field('Landmark', customer.landmark)}
          {field('Lat/Lng', customer.latLng)}
        </ScrollView>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="View customer splitter connections"
          onPress={() => onOpen(link)}
          style={styles.openButton}>
          <LinearGradient
            colors={['#8858F9', '#6036C4']}
            style={styles.openGradient}>
            <Text style={styles.openText}>View Splitter Connections</Text>
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
  detailsScroll: {flexGrow: 0, flexShrink: 1},
  body: {paddingBottom: 8},
  name: {
    fontFamily: FONTS.BOLD,
    fontSize: 15,
    lineHeight: 22,
    color: '#352944',
    marginBottom: 12,
  },
  badges: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 15},
  badge: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 11,
    color: '#8050DF',
    backgroundColor: '#F1EAFB',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
  },
  status: {
    fontFamily: FONTS.BOLD,
    fontSize: 11,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
  },
  online: {color: '#228B5C', backgroundColor: '#ECF8F0'},
  offline: {color: '#D94444', backgroundColor: '#FFF0F0'},
  unknown: {color: '#7C7388', backgroundColor: '#F2EFF5'},
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
  mobileRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  row: {flexDirection: 'row', gap: 14},
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
