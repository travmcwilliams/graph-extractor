import { useState } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import Terminal from "./Terminal";

// Capacitor: two parallel vertical lines with lead wires
// Total width ~60px, height ~40px, centered at (0,0)
// Terminals at (-30, 0) and (30, 0)
const W = 60;
const H = 40;
const GAP = 8;
const PLATE_H = 30;

export default function Capacitor({
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
  getTerminalState,
  onTerminalClick,
  onTouchStart,
  onTouchEnd,
  draggable = true,
}) {
  const [hovered, setHovered] = useState(false);

  function terminalState(side) {
    if (getTerminalState) return getTerminalState(id, side);
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
      draggable={draggable}
      onClick={(e) => { e.cancelBubble = true; onSelect?.(id); }}
      onTap={(e) => { e.cancelBubble = true; onSelect?.(id); }}
      onDragStart={() => onDragStart?.(id)}
      onDragMove={(e) => onDragMove?.(id, e)}
      onDragEnd={(e) => onDragEnd?.(id, e)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
      <Line points={[-W / 2, 0, -GAP / 2, 0]} stroke="#1e3a5f" strokeWidth={2} listening={false} />
      {/* Left plate */}
      <Line points={[-GAP / 2, -PLATE_H / 2, -GAP / 2, PLATE_H / 2]} stroke="#1e3a5f" strokeWidth={2.5} listening={false} />
      {/* Right plate */}
      <Line points={[GAP / 2, -PLATE_H / 2, GAP / 2, PLATE_H / 2]} stroke="#1e3a5f" strokeWidth={2.5} listening={false} />
      {/* Right lead wire */}
      <Line points={[GAP / 2, 0, W / 2, 0]} stroke="#1e3a5f" strokeWidth={2} listening={false} />

      {/* Hit area for easier clicking */}
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

// Terminal offsets relative to component center, before rotation
Capacitor.terminals = [
  { side: "left", dx: -W / 2, dy: 0 },
  { side: "right", dx: W / 2, dy: 0 },
];
Capacitor.WIDTH = W;
Capacitor.HEIGHT = H;
