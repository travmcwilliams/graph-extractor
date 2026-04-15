import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { getTerminals, terminalWorldPos, snapToGrid } from "./circuitState";

const STORAGE_KEY = "qcd:circuit";
const AUTOSAVE_MS = 10_000;

// ---- ID generator ----
let _nextId = 1;
function nextId() {
  return _nextId++;
}

// ---- Auto-label ----
function autoLabel(type, components) {
  const prefix = type === "capacitor" ? "C" : "JJ";
  const nums = components
    .filter((c) => c.type === type)
    .map((c) => {
      const m = c.label?.match(new RegExp(`^${prefix}(\\d+)$`));
      return m ? parseInt(m[1], 10) : 0;
    });
  const next = nums.length === 0 ? 1 : Math.max(...nums) + 1;
  return `${prefix}${next}`;
}

// ---- Union-Find ----
function makeUnionFind(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);
  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
  }
  return { find, union };
}

// ---- Compute electrical nodes ----
function computeNodes(components, wires) {
  const terminalIds = [];
  const terminalIndex = {};
  for (const comp of components) {
    for (const t of getTerminals(comp.type)) {
      const tid = `${comp.id}:${t.side}`;
      terminalIndex[tid] = terminalIds.length;
      terminalIds.push(tid);
    }
  }
  const n = terminalIds.length;
  if (n === 0) return { nodeCount: 0, terminalToNode: {}, nodeLabels: [] };

  const uf = makeUnionFind(n);
  for (const w of wires) {
    const si = terminalIndex[`${w.sourceComp}:${w.sourceSide}`];
    const ti = terminalIndex[`${w.targetComp}:${w.targetSide}`];
    if (si !== undefined && ti !== undefined) uf.union(si, ti);
  }

  const connectedSet = new Set();
  for (const w of wires) {
    connectedSet.add(`${w.sourceComp}:${w.sourceSide}`);
    connectedSet.add(`${w.targetComp}:${w.targetSide}`);
  }

  const rootToNode = {};
  let nodeCount = 0;
  const terminalToNode = {};
  for (const tid of terminalIds) {
    if (!connectedSet.has(tid)) continue;
    const root = uf.find(terminalIndex[tid]);
    if (!(root in rootToNode)) rootToNode[root] = nodeCount++;
    terminalToNode[tid] = rootToNode[root];
  }

  return { nodeCount, terminalToNode, nodeLabels: Array.from({ length: nodeCount }, (_, i) => `N${i}`) };
}

// ---- Adjacency matrix ----
function computeAdjacencyMatrix(components, wires) {
  const { nodeCount, terminalToNode, nodeLabels } = computeNodes(components, wires);
  if (nodeCount === 0) return { matrix: [], labels: [], edges: [], nodeCount: 0 };

  const matrix = Array.from({ length: nodeCount }, () => new Array(nodeCount).fill(0));
  const edges = [];
  for (const comp of components) {
    const terms = getTerminals(comp.type);
    if (terms.length < 2) continue;
    const nodeA = terminalToNode[`${comp.id}:${terms[0].side}`];
    const nodeB = terminalToNode[`${comp.id}:${terms[1].side}`];
    if (nodeA === undefined || nodeB === undefined || nodeA === nodeB) continue;
    matrix[nodeA][nodeB] += 1;
    matrix[nodeB][nodeA] += 1;
    edges.push({ source: nodeA, target: nodeB, type: comp.type, label: comp.label, value: comp.capacitance || comp.ic || null });
  }
  return { matrix, labels: nodeLabels, edges, nodeCount };
}

// ---- Validation warnings ----
function computeWarnings(components, wires, adjacency) {
  const warnings = [];
  const connectedCompIds = new Set();
  for (const w of wires) {
    connectedCompIds.add(w.sourceComp);
    connectedCompIds.add(w.targetComp);
  }

  // Floating components
  const floating = components.filter((c) => !connectedCompIds.has(c.id));
  for (const c of floating) {
    warnings.push({ type: "floating", compId: c.id, message: `${c.label} is not connected to any wire` });
  }

  // Missing values
  for (const c of components) {
    if (c.type === "capacitor" && !c.capacitance) {
      warnings.push({ type: "no_value", compId: c.id, message: `${c.label} has no capacitance value` });
    }
    if (c.type === "josephson_junction" && !c.ic) {
      warnings.push({ type: "no_value", compId: c.id, message: `${c.label} has no Ic value` });
    }
  }

  // Disconnected subgraphs — BFS on components connected by wires
  if (components.length > 1 && wires.length > 0) {
    const adj = {};
    for (const c of components) adj[c.id] = new Set();
    for (const w of wires) {
      adj[w.sourceComp]?.add(w.targetComp);
      adj[w.targetComp]?.add(w.sourceComp);
    }
    const visited = new Set();
    let subgraphs = 0;
    for (const c of components) {
      if (visited.has(c.id)) continue;
      subgraphs++;
      const queue = [c.id];
      visited.add(c.id);
      while (queue.length) {
        const cur = queue.pop();
        for (const nb of (adj[cur] || [])) {
          if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
        }
      }
    }
    if (subgraphs > 1) {
      warnings.push({ type: "disconnected", message: `Circuit has ${subgraphs} separate sections` });
    }
  }

  return warnings;
}

// ---- localStorage helpers ----
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveToStorage(components, wires, circuitName) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ components, wires, circuitName }));
  } catch { /* quota exceeded — ignore */ }
}

function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ---- The hook ----
export default function useCircuitGraph() {
  // Load initial state from localStorage
  const saved = useRef(loadFromStorage());
  const [components, setComponents] = useState(saved.current?.components || []);
  const [wires, setWires] = useState(saved.current?.wires || []);
  const [selectedId, setSelectedId] = useState(null);
  const [wireStart, setWireStart] = useState(null);
  const [circuitName, setCircuitName] = useState(saved.current?.circuitName || "Untitled Circuit");
  const [lastSaved, setLastSaved] = useState(saved.current ? Date.now() : null);
  const [dirty, setDirty] = useState(false);

  // Advance ID generator past loaded IDs
  useEffect(() => {
    const maxId = Math.max(0, ...components.map((c) => c.id), ...wires.map((w) => w.id));
    while (_nextId <= maxId) _nextId++;
  }, []); // only on mount

  // Undo/redo
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  function snapshot() {
    return { components: components.map((c) => ({ ...c })), wires: wires.map((w) => ({ ...w })) };
  }
  function pushUndo() {
    undoStack.current.push(snapshot());
    redoStack.current = [];
    if (undoStack.current.length > 100) undoStack.current.shift();
    setDirty(true);
  }

  // ---- Auto-save to localStorage ----
  useEffect(() => {
    // Save on every change (debounced by React batching)
    saveToStorage(components, wires, circuitName);
    setLastSaved(Date.now());
    setDirty(false);
  }, [components, wires, circuitName]);

  // Periodic save (belt-and-suspenders)
  useEffect(() => {
    const id = setInterval(() => saveToStorage(components, wires, circuitName), AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [components, wires, circuitName]);

  // ---- Component CRUD ----
  const addComponent = useCallback((type, x, y) => {
    pushUndo();
    const label = autoLabel(type, components);
    const comp = { id: nextId(), type, x, y, rotation: 0, label };
    setComponents((prev) => [...prev, comp]);
    setSelectedId(comp.id);
    return comp;
  }, [components, wires]);

  const removeComponent = useCallback((id) => {
    pushUndo();
    setWires((prev) => prev.filter((w) => w.sourceComp !== id && w.targetComp !== id));
    setComponents((prev) => prev.filter((c) => c.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, [components, wires]);

  const moveComponent = useCallback((id, x, y) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)));
  }, []);

  const startMoveComponent = useCallback(() => { pushUndo(); }, [components, wires]);

  const updateComponent = useCallback((id, props) => {
    pushUndo();
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, ...props } : c)));
  }, [components, wires]);

  const rotateComponent = useCallback((id) => {
    pushUndo();
    setComponents((prev) => prev.map((c) => c.id === id ? { ...c, rotation: (c.rotation + 90) % 360 } : c));
  }, [components, wires]);

  // ---- Wire CRUD ----
  const addWire = useCallback((sourceComp, sourceSide, targetComp, targetSide) => {
    if (sourceComp === targetComp && sourceSide === targetSide) return null;
    const exists = wires.some((w) =>
      (w.sourceComp === sourceComp && w.sourceSide === sourceSide && w.targetComp === targetComp && w.targetSide === targetSide) ||
      (w.sourceComp === targetComp && w.sourceSide === targetSide && w.targetComp === sourceComp && w.targetSide === sourceSide));
    if (exists) return null;
    pushUndo();
    const wire = { id: nextId(), type: "wire", sourceComp, sourceSide, targetComp, targetSide };
    setWires((prev) => [...prev, wire]);
    return wire;
  }, [wires, components]);

  const removeWire = useCallback((id) => {
    pushUndo();
    setWires((prev) => prev.filter((w) => w.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, [components, wires]);

  // ---- Wire drawing ----
  const startWire = useCallback((compId, side) => setWireStart({ compId, side }), []);
  const completeWire = useCallback((compId, side) => {
    if (!wireStart) return;
    addWire(wireStart.compId, wireStart.side, compId, side);
    setWireStart(null);
  }, [wireStart, addWire]);
  const cancelWire = useCallback(() => setWireStart(null), []);
  const handleTerminalClick = useCallback((compId, side) => {
    if (!wireStart) startWire(compId, side);
    else completeWire(compId, side);
  }, [wireStart, startWire, completeWire]);

  // ---- Selection ----
  const select = useCallback((id) => { setSelectedId(id); setWireStart(null); }, []);
  const deleteSelected = useCallback(() => {
    if (selectedId == null) return;
    if (components.some((c) => c.id === selectedId)) removeComponent(selectedId);
    else removeWire(selectedId);
  }, [selectedId, components, removeComponent, removeWire]);

  // ---- Undo / Redo ----
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    redoStack.current.push(snapshot());
    const prev = undoStack.current.pop();
    setComponents(prev.components); setWires(prev.wires);
    setSelectedId(null); setWireStart(null);
  }, [components, wires]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(snapshot());
    const next = redoStack.current.pop();
    setComponents(next.components); setWires(next.wires);
    setSelectedId(null); setWireStart(null);
  }, [components, wires]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  // ---- Clear / New ----
  const clear = useCallback(() => {
    pushUndo();
    setComponents([]); setWires([]); setSelectedId(null); setWireStart(null);
  }, [components, wires]);

  const newCircuit = useCallback(() => {
    setComponents([]); setWires([]); setSelectedId(null); setWireStart(null);
    setCircuitName("Untitled Circuit");
    undoStack.current = []; redoStack.current = [];
    clearStorage();
    setLastSaved(null);
  }, []);

  // ---- Serialization ----
  const toJSON = useCallback(() => ({
    components: components.map(({ id, type, label, x, y, rotation, capacitance, ic }) => ({
      id, type, label, x, y, rotation, ...(capacitance ? { capacitance } : {}), ...(ic ? { ic } : {}),
    })),
    wires: wires.map(({ id, sourceComp, sourceSide, targetComp, targetSide }) => ({
      id, sourceComp, sourceSide, targetComp, targetSide,
    })),
    circuitName,
  }), [components, wires, circuitName]);

  const fromJSON = useCallback((data) => {
    pushUndo();
    setComponents(data.components || []); setWires(data.wires || []);
    if (data.circuitName) setCircuitName(data.circuitName);
    setSelectedId(null); setWireStart(null);
    const maxId = Math.max(0, ...(data.components || []).map((c) => c.id), ...(data.wires || []).map((w) => w.id));
    while (_nextId <= maxId) _nextId++;
  }, [components, wires]);

  // ---- Derived / computed ----
  const connectedTerminals = useMemo(() =>
    wires.flatMap((w) => [`${w.sourceComp}:${w.sourceSide}`, `${w.targetComp}:${w.targetSide}`]),
  [wires]);

  const selected = useMemo(() =>
    components.find((c) => c.id === selectedId) || wires.find((w) => w.id === selectedId) || null,
  [components, wires, selectedId]);

  const nodeInfo = useMemo(() => computeNodes(components, wires), [components, wires]);
  const adjacency = useMemo(() => computeAdjacencyMatrix(components, wires), [components, wires]);
  const warnings = useMemo(() => computeWarnings(components, wires, adjacency), [components, wires, adjacency]);

  const componentCounts = useMemo(() => {
    const capacitors = components.filter((c) => c.type === "capacitor").length;
    const junctions = components.filter((c) => c.type === "josephson_junction").length;
    return { capacitors, junctions, total: components.length };
  }, [components]);

  const counts = useMemo(() => ({
    capacitors: componentCounts.capacitors,
    junctions: componentCounts.junctions,
    components: componentCounts.total,
    nodes: nodeInfo.nodeCount,
    edges: adjacency.edges.length,
  }), [componentCounts, nodeInfo, adjacency]);

  return {
    components, wires, selectedId, selected, wireStart, connectedTerminals,
    circuitName, setCircuitName, lastSaved, dirty,
    counts, adjacency, nodeInfo, warnings,
    addComponent, removeComponent, moveComponent, startMoveComponent, updateComponent, rotateComponent,
    addWire, removeWire, handleTerminalClick, cancelWire,
    select, deleteSelected,
    undo, redo, canUndo, canRedo,
    clear, newCircuit, toJSON, fromJSON,
  };
}

export { computeNodes, computeAdjacencyMatrix, computeWarnings, autoLabel };
