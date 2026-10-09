import React from 'react';
import {Image, StyleSheet} from 'react-native';
import {IMAGES} from '@res';
import Svg, {Circle, Path} from 'react-native-svg';

export const connectivityImageFor = (type: string) => {
  const name = type.toLowerCase();
  if (name.includes('customer')) {
    return IMAGES.Customer;
  }
  if (name.includes('split')) {
    return IMAGES.enclosureIcon;
  }
  if (name.includes('switch') || name.includes('pop')) {
    return IMAGES.FiberEnclosur;
  }
  if (name.includes('encl')) {
    return IMAGES.jointEnclosure;
  }
  if (name.includes('pole')) {
    return IMAGES.PoleImage;
  }
  if (name.includes('building')) {
    return IMAGES.Building;
  }
  if (name.includes('tiffin')) {
    return IMAGES.TiffinIcon;
  }
  if (name.includes('chamber')) {
    return IMAGES.ChamberNew;
  }
  return IMAGES.mapLocation;
};
export function ConnectivityIcon({
  type = 'location',
  color = '#FFF',
  size = 20,
}: {
  type?: string;
  color?: string;
  size?: number;
}) {
  return (
    <Image
      source={connectivityImageFor(type)}
      resizeMode="contain"
      style={{width: size, height: size, tintColor: color}}
    />
  );
}
export function HeaderPattern() {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 400 100"
      preserveAspectRatio="none">
      <Path
        d="M0 25H400M0 50H400M0 75H400M40 0V100M80 0V100M120 0V100M160 0V100M200 0V100M240 0V100M280 0V100M320 0V100M360 0V100"
        stroke="#FFF"
        strokeOpacity="0.05"
      />
      {[40, 80, 120, 160, 200, 240, 280, 320, 360].map((x, i) => (
        <Circle
          key={x}
          cx={x}
          cy={i % 2 ? 75 : 50}
          r="0.8"
          fill="#FFF"
          fillOpacity="0.24"
        />
      ))}
    </Svg>
  );
}
