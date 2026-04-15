import { Circle } from "react-konva";

const STATES = {
  default: { radius: 4, fill: "transparent", stroke: "#9ca3af", strokeWidth: 1.5 },
  hover: { radius: 6, fill: "#dbeafe", stroke: "#3b82f6", strokeWidth: 2 },
  connected: { radius: 4, fill: "#22c55e", stroke: "#16a34a", strokeWidth: 1.5 },
  "dragging-wire": { radius: 6, fill: "#fed7aa", stroke: "#f97316", strokeWidth: 2 },
};

export default function Terminal({
  x,
  y,
  state = "default",
  onMouseEnter,
  onMouseLeave,
  onClick,
}) {
  const style = STATES[state] || STATES.default;

  return (
    <Circle
      x={x}
      y={y}
      radius={style.radius}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onTap={onClick}
      hitStrokeWidth={14}
    />
  );
}
