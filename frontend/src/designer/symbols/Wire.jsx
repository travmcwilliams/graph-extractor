import { useState } from "react";
import { Group, Line } from "react-konva";
import { wireRoute } from "../circuitState";

export default function Wire({
  id,
  points, // [x1, y1, x2, y2] — source and target positions
  isSelected,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);
  if (!points || points.length < 4) return null;

  // Straight if aligned, Manhattan otherwise
  const linePoints = wireRoute(points);

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
      {/* Visible wire (the delete handle is the HTML X button rendered by Canvas) */}
      <Line
        points={linePoints}
        stroke={color}
        strokeWidth={width}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    </Group>
  );
}
