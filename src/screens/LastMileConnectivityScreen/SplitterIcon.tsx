import React from 'react';
import Svg, {Path, Rect} from 'react-native-svg';

export default function SplitterIcon({size = 22, color = '#FFFFFF'}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 8v4M5 16v-4h14v4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={9} y={3} width={6} height={5} rx={1.3} fill={color} />
      {[2, 9, 16].map(x => (
        <Rect key={x} x={x} y={16} width={6} height={5} rx={1.3} fill={color} />
      ))}
    </Svg>
  );
}
