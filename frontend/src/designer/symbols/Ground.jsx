import { useState } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import Terminal from "./Terminal";

// Ground symbol: vertical lead + 3 horizontal lines decreasing in width
// One terminal at top center
const W = 40;
const H = 40;

export default function Ground({
  id, x, y, rotation = 0, label, isSelected,
  hoveredTerminal, connectedTerminals = [], wireToolActive,
  onSelect, onDragStart, onDragMove, onDragEnd,
  onTerminalEnter, onTerminalLeave, onTerminalClick, getTerminalState,
  onTouchStart, onTouchEnd,
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
      x={x} y={y} rotation={rotation} draggable
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
      {isSelected && (
        <Rect x={-W / 2 - 4} y={-H / 2 - 4} width={W + 8} height={H + 8}
          stroke="#93c5fd" strokeWidth={1.5} cornerRadius={3} dash={[4, 3]} listening={false} />
      )}

      {/* Vertical lead from terminal to top of ground bars */}
      <Line points={[0, -H / 2, 0, -4]} stroke="#166534" strokeWidth={2} listening={false} />
      {/* Three horizontal bars, decreasing width */}
      <Line points={[-16, -4, 16, -4]} stroke="#166534" strokeWidth={2.5} listening={false} />
      <Line points={[-10, 4, 10, 4]} stroke="#166534" strokeWidth={2.5} listening={false} />
      <Line points={[-4, 12, 4, 12]} stroke="#166534" strokeWidth={2.5} listening={false} />

      {/* Hit area */}
      <Rect x={-W / 2} y={-H / 2} width={W} height={H} fill="transparent" listening={true} />

      {/* Label */}
      {label && (
        <Text text={label} x={-W / 2} y={H / 2 + 2} width={W} align="center"
          fontSize={11} fontFamily="system-ui, sans-serif" fill="#374151" listening={false} />
      )}

      {/* Single terminal at top */}
      <Terminal
        x={0} y={-H / 2}
        state={terminalState("top")}
        onMouseEnter={() => onTerminalEnter?.(id, "top")}
        onMouseLeave={() => onTerminalLeave?.(id, "top")}
        onClick={(e) => { e.cancelBubble = true; onTerminalClick?.(id, "top"); }}
      />
    </Group>
  );
}

Ground.terminals = [{ side: "top", dx: 0, dy: -H / 2 }];
Ground.WIDTH = W;
Ground.HEIGHT = H;
