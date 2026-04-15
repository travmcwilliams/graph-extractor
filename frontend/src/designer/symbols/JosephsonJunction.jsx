import { useState } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import Terminal from "./Terminal";

// Josephson Junction: X cross between two horizontal leads
// Total width ~60px, height ~40px, centered at (0,0)
const W = 60;
const H = 40;
const CROSS = 14; // half-size of the X

export default function JosephsonJunction({
  id,
  x,
  y,
  rotation = 0,
  label,
  isSelected,
  hoveredTerminal,
  connectedTerminals = [],
  wireToolActive,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTerminalEnter,
  onTerminalLeave,
  onTerminalClick,
}) {
  const [hovered, setHovered] = useState(false);

  function terminalState(side) {
    if (hoveredTerminal === `${id}:${side}`) return wireToolActive ? "dragging-wire" : "hover";
    if (connectedTerminals.includes(`${id}:${side}`)) return "connected";
    if (hovered) return "hover";
    return "default";
  }

  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      draggable
      onClick={(e) => { e.cancelBubble = true; onSelect?.(id); }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(id); }}
      onDragStart={() => onDragStart?.(id)}
      onDragMove={(e) => onDragMove?.(id, e)}
      onDragEnd={(e) => onDragEnd?.(id, e)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Selection highlight */}
      {isSelected && (
        <Rect
          x={-W / 2 - 4}
          y={-H / 2 - 4}
          width={W + 8}
          height={H + 8}
          stroke="#93c5fd"
          strokeWidth={1.5}
          cornerRadius={3}
          dash={[4, 3]}
          listening={false}
        />
      )}

      {/* Left lead wire */}
      <Line points={[-W / 2, 0, -CROSS, 0]} stroke="#7f1d1d" strokeWidth={2} listening={false} />
      {/* X cross — top-left to bottom-right */}
      <Line points={[-CROSS, -CROSS, CROSS, CROSS]} stroke="#7f1d1d" strokeWidth={2.5} listening={false} />
      {/* X cross — bottom-left to top-right */}
      <Line points={[-CROSS, CROSS, CROSS, -CROSS]} stroke="#7f1d1d" strokeWidth={2.5} listening={false} />
      {/* Right lead wire */}
      <Line points={[CROSS, 0, W / 2, 0]} stroke="#7f1d1d" strokeWidth={2} listening={false} />

      {/* Hit area */}
      <Rect
        x={-W / 2}
        y={-H / 2}
        width={W}
        height={H}
        fill="transparent"
        listening={true}
      />

      {/* Label */}
      {label && (
        <Text
          text={label}
          x={-W / 2}
          y={-H / 2 - 14}
          width={W}
          align="center"
          fontSize={11}
          fontFamily="system-ui, sans-serif"
          fill="#374151"
          listening={false}
        />
      )}

      {/* Terminals */}
      <Terminal
        x={-W / 2}
        y={0}
        state={terminalState("left")}
        onMouseEnter={() => onTerminalEnter?.(id, "left")}
        onMouseLeave={() => onTerminalLeave?.(id, "left")}
        onClick={(e) => {
          e.cancelBubble = true;
          onTerminalClick?.(id, "left");
        }}
      />
      <Terminal
        x={W / 2}
        y={0}
        state={terminalState("right")}
        onMouseEnter={() => onTerminalEnter?.(id, "right")}
        onMouseLeave={() => onTerminalLeave?.(id, "right")}
        onClick={(e) => {
          e.cancelBubble = true;
          onTerminalClick?.(id, "right");
        }}
      />
    </Group>
  );
}

JosephsonJunction.terminals = [
  { side: "left", dx: -W / 2, dy: 0 },
  { side: "right", dx: W / 2, dy: 0 },
];
JosephsonJunction.WIDTH = W;
JosephsonJunction.HEIGHT = H;
