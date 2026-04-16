import { useState, useCallback, useEffect } from "react";
import Canvas from "./Canvas";
import ComponentPalette from "./ComponentPalette";
import PropertiesPanel from "./PropertiesPanel";
import Toolbar from "./Toolbar";
import FloatingActionButton from "./FloatingActionButton";
import useCircuitGraph from "./useCircuitGraph";
import { exportAdjacencyCSV, downloadCSV } from "./exportCSV";
import { exportCircuitJSON, downloadJSON, loadCircuitFile } from "./exportJSON";
import { snapToGrid } from "./circuitState";
import { buildShareURL, readCircuitFromHash, clearHash, copyToClipboard } from "./shareLink";
import Toast from "./Toast";

const PLACE_TOOLS = {
  place_capacitor: "capacitor",
  place_jj: "josephson_junction",
  place_ground: "ground",
};

const PLACE_LABELS = {
  place_capacitor: "Capacitor",
  place_jj: "Junction",
  place_ground: "Ground",
};

export default function DesignerApp() {
  const [activeTool, setActiveTool] = useState("select");
  const [propsOpen, setPropsOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [toast, setToast] = useState(null);
  const graph = useCircuitGraph();

  const isPlaceTool = activeTool in PLACE_TOOLS;

  // Load circuit from URL hash on mount
  useEffect(() => {
    const data = readCircuitFromHash();
    if (data) {
      graph.fromJSON(data);
      clearHash();
      setToast("Circuit loaded from shared link");
    }
  }, []);

  const handleShare = useCallback(async () => {
    const data = graph.toJSON();
    const url = buildShareURL(data);
    await copyToClipboard(url);
    setToast("Link copied to clipboard!");
  }, [graph.toJSON]);

  const handleToolChange = useCallback((tool) => {
    // If tapping the same place tool again, toggle back to select
    if (tool === activeTool && tool in PLACE_TOOLS) {
      setActiveTool("select");
      setToast(null);
      graph.cancelWire();
      return;
    }
    setActiveTool(tool);
    graph.cancelWire();
    // Show toast for placement mode
    if (tool in PLACE_LABELS) {
      setToast(`Tap canvas to place ${PLACE_LABELS[tool]}`);
    }
  }, [activeTool, graph.cancelWire]);

  // Desktop drag-and-drop from palette
  const handleDropComponent = useCallback((type, x, y) => {
    graph.addComponent(type, x, y);
    setActiveTool("select");
    setToast(null);
  }, [graph.addComponent]);

  // Tap-to-place on canvas (mobile and desktop)
  const handleCanvasPlace = useCallback((x, y) => {
    if (!isPlaceTool) return;
    const type = PLACE_TOOLS[activeTool];
    graph.addComponent(type, x, y);
    // Stay in placement mode so user can place multiples
  }, [activeTool, isPlaceTool, graph.addComponent]);

  const handlePropertyChange = useCallback((id, key, value) => {
    graph.updateComponent(id, { [key]: value });
  }, [graph.updateComponent]);

  const handleExportCSV = useCallback((mode) => {
    const csv = exportAdjacencyCSV(graph.adjacency, mode);
    if (!csv) return;
    downloadCSV(csv);
  }, [graph.adjacency]);

  const handleSaveJSON = useCallback(() => {
    downloadJSON(exportCircuitJSON(graph));
  }, [graph]);

  const handleLoadJSON = useCallback(async () => {
    try {
      const data = await loadCircuitFile();
      graph.fromJSON(data);
    } catch (err) {
      if (err.message !== "No file selected") alert(`Load failed: ${err.message}`);
    }
  }, [graph.fromJSON]);

  const handleClear = useCallback(() => {
    if (graph.counts.components === 0 || window.confirm(`Clear all ${graph.counts.components} components and ${graph.counts.edges} wires?`)) {
      graph.clear();
    }
  }, [graph.clear, graph.counts]);

  const handleLoadTemplate = useCallback((templateData) => {
    if (graph.counts.components > 0 && !window.confirm("Replace current circuit with template?")) return;
    graph.fromJSON(templateData);
  }, [graph.fromJSON, graph.counts]);

  const handleNewCircuit = useCallback(() => {
    if (graph.counts.components === 0 || window.confirm("Start a new circuit? Current circuit will be cleared.")) {
      graph.newCircuit();
    }
  }, [graph.newCircuit, graph.counts]);

  // Open properties when something is selected on mobile
  useEffect(() => {
    if (graph.selected && window.innerWidth < 1024) {
      setPropsOpen(true);
    }
  }, [graph.selectedId]);

  // ---- Global keyboard shortcuts ----
  useEffect(() => {
    const handle = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "z" && !e.shiftKey) { e.preventDefault(); graph.undo(); return; }
      if (ctrl && ((e.key === "z" && e.shiftKey) || e.key === "Z")) { e.preventDefault(); graph.redo(); return; }
      if (ctrl && e.key === "s") { e.preventDefault(); downloadJSON(exportCircuitJSON(graph)); return; }
      if (ctrl && e.key === "e") { e.preventDefault(); const csv = exportAdjacencyCSV(graph.adjacency, "binary"); if (csv) downloadCSV(csv); return; }
      if (ctrl && e.key === "d") { e.preventDefault(); graph.duplicateSelected(); return; }
      if (ctrl && e.key === "c") { e.preventDefault(); graph.copySelected(); return; }
      if (ctrl && e.key === "v") { e.preventDefault(); graph.paste(); return; }
      if (ctrl) return;

      switch (e.key) {
        case "c": case "C": setActiveTool("place_capacitor"); graph.cancelWire(); setToast("Tap canvas to place Capacitor"); break;
        case "j": case "J": setActiveTool("place_jj"); graph.cancelWire(); setToast("Tap canvas to place Junction"); break;
        case "g": case "G": setActiveTool("place_ground"); graph.cancelWire(); setToast("Tap canvas to place Ground"); break;
        case "w": case "W": setActiveTool("wire"); graph.cancelWire(); setToast(null); break;
        case "v": case "V": setActiveTool("select"); graph.cancelWire(); setToast(null); break;
        case "Escape":
          if (isPlaceTool) { setActiveTool("select"); setToast(null); }
          else if (graph.wireStart) graph.cancelWire();
          else { setActiveTool("select"); graph.select(null); }
          break;
        case "r": case "R": if (graph.selectedId != null) graph.rotateComponent(graph.selectedId); break;
        case "Delete": case "Backspace": graph.deleteSelected(); break;
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [graph, isPlaceTool]);

  // Prevent Safari gesturestart (browser-level pinch zoom)
  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-100">
      {/* Header */}
      <div className="flex items-center h-10 md:h-11 bg-gray-900 text-white px-3 md:px-4 gap-2 md:gap-3 flex-shrink-0">
        <span className="text-sm font-semibold tracking-wide whitespace-nowrap">QCD</span>
        <span className="text-gray-600 hidden sm:inline">|</span>
        <input
          type="text"
          value={graph.circuitName}
          onChange={(e) => graph.setCircuitName(e.target.value)}
          className="bg-transparent text-sm text-gray-200 border-none outline-none hover:text-white focus:text-white min-w-0 flex-shrink hidden sm:block"
          spellCheck={false}
        />
        <div className="ml-auto flex items-center gap-2 md:gap-3 text-xs text-gray-500 whitespace-nowrap">
          <span className={`hidden sm:inline ${graph.dirty ? "text-yellow-400" : "text-green-500"}`}>
            {graph.dirty ? "Unsaved" : "Saved"}
          </span>
          <button onClick={handleNewCircuit} className="text-gray-400 hover:text-white transition-colors">New</button>
          <button onClick={() => setPropsOpen(!propsOpen)}
            className="hidden md:inline-block lg:hidden text-gray-400 hover:text-white transition-colors">
            {propsOpen ? "Close" : "Props"}
          </button>
        </div>
      </div>

      <Toolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        onUndo={graph.undo}
        onRedo={graph.redo}
        canUndo={graph.canUndo}
        canRedo={graph.canRedo}
        onClear={handleClear}
        onZoomToFit={() => {}}
        counts={graph.counts}
        warnings={graph.warnings}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onLoadTemplate={handleLoadTemplate}
        onShare={handleShare}
      />

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        <ComponentPalette
          activeTool={activeTool}
          onToolChange={handleToolChange}
          onUndo={graph.undo}
          counts={graph.counts}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 pb-16 md:pb-0">
            <Canvas
              activeTool={activeTool}
              components={graph.components}
              wires={graph.wires}
              selectedId={graph.selectedId}
              selectedIds={graph.selectedIds}
              wireStart={graph.wireStart}
              onSelect={graph.select}
              onComponentMove={graph.moveComponent}
              onStartMoveComponent={graph.startMoveComponent}
              onDropComponent={handleDropComponent}
              onCanvasPlace={handleCanvasPlace}
              onTerminalClick={graph.handleTerminalClick}
              onCancelWire={graph.cancelWire}
              connectedTerminals={graph.connectedTerminals}
              warnings={graph.warnings}
              nodeInfo={graph.nodeInfo}
              showLabels={showLabels}
              onDeleteComponent={graph.removeComponent}
              onDuplicateComponent={graph.duplicateSelected}
              onRotateComponent={graph.rotateComponent}
              onOpenProperties={() => setPropsOpen(true)}
            />
          </div>
        </div>

        <PropertiesPanel
          selected={graph.selected}
          counts={graph.counts}
          adjacency={graph.adjacency}
          warnings={graph.warnings}
          onPropertyChange={handlePropertyChange}
          onExportCSV={handleExportCSV}
          onSaveJSON={handleSaveJSON}
          onLoadJSON={handleLoadJSON}
          onDuplicate={graph.duplicateSelected}
          isOpen={propsOpen}
          onClose={() => setPropsOpen(false)}
        />
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <FloatingActionButton
        onExportCSV={handleExportCSV}
        onSaveJSON={handleSaveJSON}
        onLoadJSON={handleLoadJSON}
      />
    </div>
  );
}
