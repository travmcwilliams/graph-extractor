import { useState } from "react";
import { Group, Line, Circle } from "react-konva";

// Manhattan routing: horizontal from start, then vertical to end
function manhattanPoints(x1, y1, x2, y2) {
  const midX = x2;
  return [x1, y1, midX, y1, midX, y2, x2, y2];
}

export default function Wire({
  id,
  points, // [x1, y1, x2, y2] — source and target positions
  isSelected,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);
  if (!points || points.length < 4) return null;

  const [x1, y1, x2, y2] = points;

  // Use straight line if aligned, manhattan otherwise
  const isStraight = x1 === x2 || y1 === y2;
  const linePoints = isStraight ? [x1, y1, x2, y2] : manhattanPoints(x1, y1, x2, y2);

  const color = isSelected ? "#2563eb" : hovered ? "#60a5fa" : "#4b5563";
  const width = isSelected || hovered ? 2.5 : 2;

  return (
    <Group>
      {/* Fat invisible hit area */}
      <Line
        points={linePoints}
        stroke="transparent"
        strokeWidth={16}
        onClick={(e) => { e.cancelBubble = true; onSelect?.(id); }}
        onTap={(e) => { e.cancelBubble = true; onSelect?.(id); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {/* Visible wire */}
      <Line
        points={linePoints}
        stroke={color}
        strokeWidth={width}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
      {/* Delete handle when selected */}
      {isSelected && (
        <Circle
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2}
          radius={7}
          fill="#ef4444"
          stroke="white"
          strokeWidth={1.5}
          listening={false}
        />
      )}
    </Group>
  );
}
