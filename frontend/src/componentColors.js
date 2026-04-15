const COMPONENT_COLORS = {
  resistor:   { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300",   badge: "bg-blue-500",   cell: "bg-blue-100",   hex: "#3b82f6" },
  capacitor:  { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300",  badge: "bg-green-500",  cell: "bg-green-100",  hex: "#22c55e" },
  inductor:   { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", badge: "bg-purple-500", cell: "bg-purple-100", hex: "#a855f7" },
  diode:      { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", badge: "bg-orange-500", cell: "bg-orange-100", hex: "#f97316" },
  transistor: { bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300",    badge: "bg-red-500",    cell: "bg-red-100",    hex: "#ef4444" },
  wire:       { bg: "bg-gray-100",   text: "text-gray-700",   border: "border-gray-300",   badge: "bg-gray-400",   cell: "bg-gray-100",   hex: "#9ca3af" },
  junction:   { bg: "bg-gray-100",   text: "text-gray-700",   border: "border-gray-300",   badge: "bg-gray-400",   cell: "bg-gray-100",   hex: "#9ca3af" },
};

const DEFAULT_COLOR = { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", badge: "bg-gray-300", cell: "bg-gray-50", hex: "#d1d5db" };

export function colorFor(componentType) {
  if (!componentType) return DEFAULT_COLOR;
  const key = componentType.toLowerCase();
  return COMPONENT_COLORS[key] || DEFAULT_COLOR;
}

export function displayName(componentType) {
  if (!componentType || componentType === "wire") return "Wire";
  return componentType.charAt(0).toUpperCase() + componentType.slice(1).toLowerCase();
}

export default COMPONENT_COLORS;
