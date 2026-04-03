// components/SingleChamberCard.tsx
import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Linking} from 'react-native';
import {COLORS, SIZE} from '@res';
import {ChamberUIData} from '../../../utils/chamberMapper';

interface Props {
  chamber: ChamberUIData;
}

const SingleChamberCard: React.FC<Props> = ({chamber}) => {
  return (
    <View style={styles.card}>
      {/* Title */}
      <View style={styles.row}>
        <Text style={styles.pin}>📍</Text>
        <Text style={styles.title}>{chamber.title}</Text>
      </View>

      {/* Address */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              chamber.address,
            )}`,
          )
        }>
        <Text style={styles.address}>{chamber.address}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SingleChamberCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.WHITE,
    marginHorizontal: SIZE.MS(16),
    marginTop: SIZE.MVS(16),
    padding: SIZE.MS(12),
    borderRadius: SIZE.MS(8),
    borderWidth: 1.5,
    borderColor: COLORS.BORDER_DEFAULT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pin: {
    fontSize: SIZE.MS(16),
    marginRight: SIZE.MS(6),
  },
  title: {
    fontSize: SIZE.MS(12),
    color: COLORS.TEXT_DARKER,
    fontWeight: 'bold',
  },
  address: {
    marginTop: SIZE.MVS(6),
    fontSize: SIZE.MS(12),
    color: COLORS.PRIMARY, // ✅ blue clickable text like image
    textDecorationLine: 'underline',
  },
});
