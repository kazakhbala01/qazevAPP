// MarkerSVG.tsx
import React from "react";
import { Svg, Circle, Text } from "react-native-svg";

interface MarkerSVGProps {
  power: number;
  capacity: number;
  borderColor: string;
}

const MarkerSVG: React.FC<MarkerSVGProps> = ({
  power,
  capacity,
  borderColor,
}) => {
  return (
    <Svg width={60} height={60} viewBox="0 0 60 60">
      <Circle
        cx={30}
        cy={30}
        r={25}
        fill="white"
        stroke={borderColor}
        strokeWidth={3}
      />
      <Text
        x={30}
        y={35}
        textAnchor="middle"
        fontSize={12}
        fontWeight="bold"
        fill="#000"
      >
        {capacity > 1 ? capacity : `${power} kW`}
      </Text>
    </Svg>
  );
};

export default MarkerSVG;
