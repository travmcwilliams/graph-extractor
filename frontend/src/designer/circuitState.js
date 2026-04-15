// Shared helpers for circuit state management

const GRID_SIZE = 20;

export function snapToGrid(val) {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

/** Compute world-space terminal position given component center, rotation, and terminal offset. */
export function terminalWorldPos(comp, terminal) {
  const rad = ((comp.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: comp.x + terminal.dx * cos - terminal.dy * sin,
    y: comp.y + terminal.dx * sin + terminal.dy * cos,
  };
}

const TERMINAL_DEFS = {
  capacitor: [
    { side: "left", dx: -30, dy: 0 },
    { side: "right", dx: 30, dy: 0 },
  ],
  josephson_junction: [
    { side: "left", dx: -30, dy: 0 },
    { side: "right", dx: 30, dy: 0 },
  ],
  ground: [
    { side: "top", dx: 0, dy: -20 },
  ],
};

export function getTerminals(compType) {
  return TERMINAL_DEFS[compType] || [];
}

/** Generate an auto-label like C1, C2, JJ1, JJ2 based on existing components. */
export function autoLabel(type, existingComponents) {
  const prefix = type === "capacitor" ? "C" : "JJ";
  const existing = existingComponents
    .filter((c) => c.type === type)
    .map((c) => {
      const match = c.label?.match(new RegExp(`^${prefix}(\\d+)$`));
      return match ? parseInt(match[1], 10) : 0;
    });
  const next = existing.length === 0 ? 1 : Math.max(...existing) + 1;
  return `${prefix}${next}`;
}

let _nextId = 1;
export function nextId() {
  return _nextId++;
}
