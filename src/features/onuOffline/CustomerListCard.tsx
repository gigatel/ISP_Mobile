import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {COLORS, FONTS} from '@res';
import {OnuCustomer, parseLatLng} from './model';

type Props = {
  customer: OnuCustomer;
  lastInform: string;
  onOpen: () => void;
  onMap: () => void;
};
const CardIcon = ({
  kind,
  color = COLORS.TEXT_MEDIUM,
}: {
  kind: 'phone' | 'location' | 'clock';
  color?: string;
}) => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants">
    {kind === 'phone' && (
      <Path
        d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
    {kind === 'location' && (
      <>
        <Path
          d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"
          stroke={color}
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={10} r={2.5} stroke={color} strokeWidth={1.7} />
      </>
    )}
    {kind === 'clock' && (
      <>
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.7} />
        <Path
          d="M12 7v5l3 2"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
  </Svg>
);
export default function CustomerListCard({
  customer,
  lastInform,
  onOpen,
  onMap,
}: Props) {
  const hasLocation = !!parseLatLng(customer.LatLng);
  const initials =
    customer.CustomerName?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'C';
  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${
          customer.CustomerName || customer.CustomerId
        }`}
        onPress={onOpen}
        style={styles.content}>
        <View style={styles.heading}>
          <View
            style={styles.avatar}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={2}>
              {customer.CustomerName || 'Unnamed customer'}
            </Text>
            <Text style={styles.customerId}>
              Customer ID{' '}
              <Text style={styles.idValue}>{customer.CustomerId}</Text>
            </Text>
          </View>
          <View style={styles.status}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>OFFLINE</Text>
          </View>
        </View>
        <View style={styles.contact}>
          <View style={styles.contactRow}>
            <CardIcon kind="phone" />
            <Text style={styles.mobile}>
              {customer.MobNo || 'Mobile not available'}
            </Text>
          </View>
          <View style={styles.contactRow}>
            <CardIcon kind="location" />
            <Text style={styles.address}>
              {customer.Address || 'Address not available'}
            </Text>
          </View>
        </View>
        <View style={styles.devicePanel}>
          <View style={styles.deviceField}>
            <Text style={styles.fieldLabel}>MAC ADDRESS</Text>
            <Text style={styles.deviceValue}>{customer.MACAddress || '—'}</Text>
          </View>
          <View style={styles.deviceField}>
            <Text style={styles.fieldLabel}>GENIEACS DEVICE ID</Text>
            <Text style={styles.deviceValue}>
              {customer.GenieAcsDeviceId || '—'}
            </Text>
          </View>
        </View>
        <View style={styles.lastInform}>
          <CardIcon kind="clock" />
          <View style={styles.dateContent}>
            <Text style={styles.fieldLabel}>LAST INFORM</Text>
            <Text style={styles.date}>{lastInform}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open full details for customer ${customer.CustomerId}`}
          style={styles.detailsButton}
          activeOpacity={0.75}>
          <Text style={styles.detailsText}>View details</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onMap}
          disabled={!hasLocation}
          accessibilityRole="button"
          accessibilityLabel={`View customer ${customer.CustomerId} on map`}
          accessibilityState={{disabled: !hasLocation}}
          style={[styles.mapButton, !hasLocation && styles.mapDisabled]}
          activeOpacity={0.75}>
          {hasLocation && <CardIcon kind="location" color={COLORS.WHITE} />}
          <Text
            style={[styles.mapText, !hasLocation && styles.mapTextDisabled]}>
            {hasLocation ? 'View on Map' : 'Location unavailable'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E5EF',
    shadowColor: '#292039',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  content: {padding: 16},
  heading: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F0E9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: COLORS.PRIMARY_MEDIUM,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 15,
  },
  identity: {flex: 1, paddingTop: 1},
  name: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.TEXT_DARKER,
  },
  customerId: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.TEXT_MEDIUM,
    marginTop: 3,
  },
  idValue: {color: COLORS.TEXT_DARK, fontFamily: FONTS.MEDIUM},
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F1',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginTop: 2,
  },
  statusDot: {width: 5, height: 5, borderRadius: 3, backgroundColor: '#D92D3A'},
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#C82A36',
    letterSpacing: 0.4,
  },
  contact: {marginTop: 17, gap: 10},
  contactRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  mobile: {
    flex: 1,
    color: COLORS.TEXT_DARKER,
    fontFamily: FONTS.MEDIUM,
    fontSize: 14,
    lineHeight: 20,
  },
  address: {
    flex: 1,
    color: COLORS.TEXT_MEDIUM,
    fontFamily: FONTS.REGULAR,
    fontSize: 13,
    lineHeight: 20,
  },
  devicePanel: {
    marginTop: 16,
    backgroundColor: '#F7F6FA',
    borderRadius: 11,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  deviceField: {flexBasis: '45%', flexGrow: 1, minWidth: 100, gap: 5},
  fieldLabel: {
    color: COLORS.TEXT_MEDIUM,
    fontFamily: FONTS.MEDIUM,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  deviceValue: {
    color: COLORS.TEXT_DARK,
    fontFamily: FONTS.MEDIUM,
    fontSize: 13,
    lineHeight: 19,
  },
  lastInform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  dateContent: {flex: 1, gap: 3},
  date: {color: COLORS.TEXT_MEDIUM, fontSize: 12, lineHeight: 18},
  actions: {
    borderTopWidth: 1,
    borderTopColor: '#F0EDF5',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  detailsText: {
    color: COLORS.PRIMARY_MEDIUM,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 12,
  },
  chevron: {color: COLORS.PRIMARY_MEDIUM, fontSize: 22, lineHeight: 24},
  mapButton: {
    flex: 1.25,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 11,
    minHeight: 44,
  },
  mapText: {
    color: COLORS.WHITE,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 12,
    flexShrink: 1,
    textAlign: 'center',
  },
  mapDisabled: {backgroundColor: '#F1F0F5'},
  mapTextDisabled: {color: COLORS.TEXT_MEDIUM},
});
