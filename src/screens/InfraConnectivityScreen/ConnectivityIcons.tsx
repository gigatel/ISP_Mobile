import React from 'react';
import {Image, StyleSheet} from 'react-native';
import {IMAGES} from '@res';
import {markerKindOf} from './markerDetails';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

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

// Map glyphs stay legible inside a marker at normal zoom.
export function MasterMapIcon({
  type,
  size = 22,
  color = '#FFF',
}: {
  type: string;
  size?: number;
  color?: string;
}) {
  const kind = markerKindOf(type);
  const paths: Partial<Record<typeof kind, string>> = {
    chamber: 'M5 5h14v14H5ZM8 8h8v8H8ZM5 5l3 3m8 8 3 3M19 5l-3 3M8 16l-3 3',
    switch: 'M3 6h18v12H3ZM6 10h2m3 0h2m3 0h2M6 14h2m3 0h2m3 0h2',
    splitter: 'M12 3v7M5 20v-6h14v6M12 10v10',
    pop: 'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h8M8 18h2',
    enclosure: 'M5 3h14v18H5ZM12 3v18m3-10v3',
    pole: 'M12 3v18M4 7h16M7 7v3M17 7v3M9 21h6',
    tree: 'M12 3 6 10h3l-4 6h14l-4-6h3ZM12 16v5',
    building: 'M5 21V4h14v17ZM8 8h2m4 0h2M8 12h2m4 0h2M10 21v-5h4v5',
    customer: 'M5 21v-3a7 7 0 0 1 14 0v3M5 21h14',
    tiffin: 'M6 7h12v14H6ZM9 7V3h6v4M6 12h12m-12 4h12',
    master: 'M12 3 21 8v9l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v9',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'point' ? (
        <>
          <Circle
            cx="12"
            cy="12"
            r="8"
            stroke={color}
            strokeWidth="2"
            fill="none"
          />
          <Circle cx="12" cy="12" r="3" fill={color} />
        </>
      ) : (
        <Path
          d={paths[kind]}
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {kind === 'customer' && (
        <Circle
          cx="12"
          cy="7"
          r="3.5"
          stroke={color}
          strokeWidth="1.8"
          fill="none"
        />
      )}
      {kind === 'splitter' && (
        <>
          <Rect x="9" y="2" width="6" height="5" rx="1" fill={color} />
          <Circle cx="5" cy="20" r="2" fill={color} />
          <Circle cx="12" cy="20" r="2" fill={color} />
          <Circle cx="19" cy="20" r="2" fill={color} />
        </>
      )}
    </Svg>
  );
}
