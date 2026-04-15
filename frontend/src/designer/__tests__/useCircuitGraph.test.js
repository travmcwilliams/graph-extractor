import { describe, it, expect } from "vitest";
import {
  computeNodes,
  computeAdjacencyMatrix,
  computeWarnings,
  autoLabel,
} from "../useCircuitGraph";

function makeComponent(id, type, label, x = 0, y = 0, extra = {}) {
  return { id, type, label, x, y, rotation: 0, ...extra };
}

function makeWire(id, sourceComp, sourceSide, targetComp, targetSide) {
  return { id, type: "wire", sourceComp, sourceSide, targetComp, targetSide };
}

// ============================================================
// autoLabel
// ============================================================
describe("autoLabel", () => {
  it("returns C1 for first capacitor", () => {
    expect(autoLabel("capacitor", [])).toBe("C1");
  });

  it("returns JJ1 for first junction", () => {
    expect(autoLabel("josephson_junction", [])).toBe("JJ1");
  });

  it("increments label numbers", () => {
    const existing = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "capacitor", "C2")];
    expect(autoLabel("capacitor", existing)).toBe("C3");
  });

  it("handles gaps in numbering", () => {
    const existing = [makeComponent(1, "capacitor", "C1"), makeComponent(3, "capacitor", "C5")];
    expect(autoLabel("capacitor", existing)).toBe("C6");
  });

  it("does not count other types", () => {
    const existing = [makeComponent(1, "josephson_junction", "JJ1"), makeComponent(2, "josephson_junction", "JJ2")];
    expect(autoLabel("capacitor", existing)).toBe("C1");
  });
});

// ============================================================
// computeNodes
// ============================================================
describe("computeNodes", () => {
  it("returns 0 nodes for empty circuit", () => {
    expect(computeNodes([], []).nodeCount).toBe(0);
  });

  it("returns 0 nodes for components with no wires", () => {
    expect(computeNodes([makeComponent(1, "capacitor", "C1")], []).nodeCount).toBe(0);
  });

  it("merges two terminals into one node for one wire", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    const wires = [makeWire(10, 1, "right", 2, "left")];
    const result = computeNodes(comps, wires);
    expect(result.nodeCount).toBe(1);
    expect(result.terminalToNode["1:right"]).toBe(result.terminalToNode["2:left"]);
  });

  it("merges terminals connected through a chain", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1"), makeComponent(3, "capacitor", "C2")];
    const wires = [makeWire(10, 1, "right", 2, "left"), makeWire(11, 2, "right", 3, "left")];
    expect(computeNodes(comps, wires).nodeCount).toBe(2);
  });

  it("merges three terminals into one node (T-junction)", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1"), makeComponent(3, "capacitor", "C2")];
    const wires = [makeWire(10, 1, "left", 2, "left"), makeWire(11, 1, "left", 3, "left")];
    const result = computeNodes(comps, wires);
    expect(result.nodeCount).toBe(1);
    expect(result.terminalToNode["1:left"]).toBe(result.terminalToNode["2:left"]);
    expect(result.terminalToNode["1:left"]).toBe(result.terminalToNode["3:left"]);
  });

  it("generates sequential node labels", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    const wires = [makeWire(10, 1, "left", 2, "left"), makeWire(11, 1, "right", 2, "right")];
    const result = computeNodes(comps, wires);
    expect(result.nodeLabels).toEqual(["N0", "N1"]);
  });
});

// ============================================================
// computeAdjacencyMatrix
// ============================================================
describe("computeAdjacencyMatrix", () => {
  it("returns empty for empty circuit", () => {
    const result = computeAdjacencyMatrix([], []);
    expect(result.matrix).toEqual([]);
    expect(result.labels).toEqual([]);
    expect(result.nodeCount).toBe(0);
  });

  it("parallel C and JJ produce 2x2 matrix with weight 2", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    const wires = [makeWire(10, 1, "left", 2, "left"), makeWire(11, 1, "right", 2, "right")];
    const result = computeAdjacencyMatrix(comps, wires);
    expect(result.nodeCount).toBe(2);
    expect(result.matrix).toEqual([[0, 2], [2, 0]]);
    expect(result.edges).toHaveLength(2);
  });

  it("matrix is always symmetric", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    const wires = [makeWire(10, 1, "left", 2, "left"), makeWire(11, 1, "right", 2, "right")];
    const { matrix } = computeAdjacencyMatrix(comps, wires);
    for (let i = 0; i < matrix.length; i++)
      for (let j = 0; j < matrix.length; j++)
        expect(matrix[i][j]).toBe(matrix[j][i]);
  });

  it("half-wired component produces no edge", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    const wires = [makeWire(10, 1, "right", 2, "left")];
    const result = computeAdjacencyMatrix(comps, wires);
    expect(result.nodeCount).toBe(1);
    expect(result.edges).toHaveLength(0);
    expect(result.matrix).toEqual([[0]]);
  });

  it("3-node ring circuit", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1"), makeComponent(3, "capacitor", "C2")];
    const wires = [makeWire(10, 1, "right", 2, "left"), makeWire(11, 2, "right", 3, "left"), makeWire(12, 3, "right", 1, "left")];
    const result = computeAdjacencyMatrix(comps, wires);
    expect(result.nodeCount).toBe(3);
    expect(result.edges).toHaveLength(3);
    const { matrix } = result;
    for (let i = 0; i < 3; i++) expect(matrix[i][i]).toBe(0);
  });

  it("edge metadata includes label and value", () => {
    const comps = [
      makeComponent(1, "capacitor", "C1", 0, 0, { capacitance: "10 fF" }),
      makeComponent(2, "josephson_junction", "JJ1", 0, 0, { ic: "1 uA" }),
    ];
    const wires = [makeWire(10, 1, "left", 2, "left"), makeWire(11, 1, "right", 2, "right")];
    const { edges } = computeAdjacencyMatrix(comps, wires);
    expect(edges.find((e) => e.type === "capacitor").value).toBe("10 fF");
    expect(edges.find((e) => e.type === "josephson_junction").value).toBe("1 uA");
  });

  it("shorted terminals (same node) produce no edge", () => {
    // C1.left wired to C1.right through JJ1 which shorts them
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    // Wire both C1 terminals to the same JJ terminal — creates 1 node
    const wires = [makeWire(10, 1, "left", 2, "left"), makeWire(11, 1, "right", 2, "left")];
    const result = computeAdjacencyMatrix(comps, wires);
    // C1's terminals are both in the same node, so no edge from C1
    expect(result.edges.filter((e) => e.type === "capacitor")).toHaveLength(0);
  });
});

// ============================================================
// computeWarnings
// ============================================================
describe("computeWarnings", () => {
  it("returns empty for empty circuit", () => {
    expect(computeWarnings([], [], { edges: [] })).toEqual([]);
  });

  it("detects floating components", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    const warnings = computeWarnings(comps, [], { edges: [] });
    const floating = warnings.filter((w) => w.type === "floating");
    expect(floating).toHaveLength(2);
    expect(floating.map((w) => w.compId).sort()).toEqual([1, 2]);
  });

  it("does not flag connected components as floating", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    const wires = [makeWire(10, 1, "right", 2, "left")];
    const warnings = computeWarnings(comps, wires, { edges: [] });
    expect(warnings.filter((w) => w.type === "floating")).toHaveLength(0);
  });

  it("detects missing capacitance value", () => {
    const comps = [makeComponent(1, "capacitor", "C1")];
    const warnings = computeWarnings(comps, [], { edges: [] });
    expect(warnings.some((w) => w.type === "no_value" && w.compId === 1)).toBe(true);
  });

  it("does not warn about missing value when set", () => {
    const comps = [makeComponent(1, "capacitor", "C1", 0, 0, { capacitance: "10 fF" })];
    const warnings = computeWarnings(comps, [], { edges: [] });
    expect(warnings.filter((w) => w.type === "no_value")).toHaveLength(0);
  });

  it("detects disconnected subgraphs", () => {
    // Two components, no wires between them but each has wires to other things
    const comps = [
      makeComponent(1, "capacitor", "C1"),
      makeComponent(2, "capacitor", "C2"),
      makeComponent(3, "josephson_junction", "JJ1"),
      makeComponent(4, "josephson_junction", "JJ2"),
    ];
    // Group 1: C1 <-> JJ1, Group 2: C2 <-> JJ2
    const wires = [makeWire(10, 1, "right", 3, "left"), makeWire(11, 2, "right", 4, "left")];
    const warnings = computeWarnings(comps, wires, { edges: [] });
    const disc = warnings.find((w) => w.type === "disconnected");
    expect(disc).toBeDefined();
    expect(disc.message).toContain("2 separate sections");
  });

  it("does not warn about disconnected when fully connected", () => {
    const comps = [makeComponent(1, "capacitor", "C1"), makeComponent(2, "josephson_junction", "JJ1")];
    const wires = [makeWire(10, 1, "right", 2, "left")];
    const warnings = computeWarnings(comps, wires, { edges: [] });
    expect(warnings.filter((w) => w.type === "disconnected")).toHaveLength(0);
  });
});

// ============================================================
// Save/Load serialization
// ============================================================
describe("serialization roundtrip", () => {
  it("components and wires survive JSON roundtrip", () => {
    const comps = [
      makeComponent(1, "capacitor", "C1", 100, 200, { capacitance: "10 fF" }),
      makeComponent(2, "josephson_junction", "JJ1", 300, 200, { ic: "1 uA" }),
    ];
    const wires = [makeWire(10, 1, "left", 2, "left"), makeWire(11, 1, "right", 2, "right")];

    // Simulate toJSON
    const json = JSON.stringify({
      components: comps.map(({ id, type, label, x, y, rotation, capacitance, ic }) => ({
        id, type, label, x, y, rotation, ...(capacitance ? { capacitance } : {}), ...(ic ? { ic } : {}),
      })),
      wires: wires.map(({ id, sourceComp, sourceSide, targetComp, targetSide }) => ({
        id, sourceComp, sourceSide, targetComp, targetSide,
      })),
    });

    const parsed = JSON.parse(json);
    expect(parsed.components).toHaveLength(2);
    expect(parsed.wires).toHaveLength(2);
    expect(parsed.components[0].capacitance).toBe("10 fF");
    expect(parsed.components[1].ic).toBe("1 uA");

    // Verify graph still computes correctly after roundtrip
    const adj = computeAdjacencyMatrix(parsed.components, parsed.wires);
    expect(adj.nodeCount).toBe(2);
    expect(adj.matrix).toEqual([[0, 2], [2, 0]]);
  });
});

// ============================================================
// Undo/Redo logic (pure state tests)
// ============================================================
describe("undo/redo state management", () => {
  it("snapshot captures deep copy", () => {
    const comps = [makeComponent(1, "capacitor", "C1", 0, 0)];
    const snap = { components: comps.map((c) => ({ ...c })), wires: [] };
    comps[0].x = 999;
    expect(snap.components[0].x).toBe(0); // snapshot is independent
  });

  it("undo stack is a LIFO", () => {
    const stack = [];
    stack.push({ state: "A" });
    stack.push({ state: "B" });
    stack.push({ state: "C" });
    expect(stack.pop().state).toBe("C");
    expect(stack.pop().state).toBe("B");
    expect(stack.pop().state).toBe("A");
  });
});
