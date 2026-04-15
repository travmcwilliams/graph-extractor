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

export default function DesignerApp() {
  const [activeTool, setActiveTool] = useState("select");
  const [propsOpen, setPropsOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const graph = useCircuitGraph();

  const handleToolChange = useCallback((tool) => {
    setActiveTool(tool);
    graph.cancelWire();
  }, [graph.cancelWire]);

  const handleDropComponent = useCallback((type, x, y) => {
    graph.addComponent(type, x, y);
    setActiveTool("select");
  }, [graph.addComponent]);

  // On mobile, tapping a "place" tool places at center of canvas
  useEffect(() => {
    if (activeTool === "place_capacitor" || activeTool === "place_jj" || activeTool === "place_ground") {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        const type = activeTool === "place_capacitor" ? "capacitor" : activeTool === "place_ground" ? "ground" : "josephson_junction";
        const x = snapToGrid(Math.round(window.innerWidth / 2 / 20) * 20);
        const y = snapToGrid(Math.round(window.innerHeight / 2 / 20) * 20);
        graph.addComponent(type, x, y);
        setActiveTool("select");
      }
    }
  }, [activeTool]);

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
        case "c": case "C": setActiveTool("place_capacitor"); graph.cancelWire(); break;
        case "j": case "J": setActiveTool("place_jj"); graph.cancelWire(); break;
        case "g": case "G": setActiveTool("place_ground"); graph.cancelWire(); break;
        case "w": case "W": setActiveTool("wire"); graph.cancelWire(); break;
        case "v": case "V": setActiveTool("select"); graph.cancelWire(); break;
        case "Escape":
          if (graph.wireStart) graph.cancelWire();
          else { setActiveTool("select"); graph.select(null); }
          break;
        case "r": case "R": if (graph.selectedId != null) graph.rotateComponent(graph.selectedId); break;
        case "Delete": case "Backspace": graph.deleteSelected(); break;
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [graph]);

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
          {/* Tablet: toggle properties drawer */}
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
      />

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop/tablet left palette (mobile version is position:fixed in ComponentPalette) */}
        <ComponentPalette
          activeTool={activeTool}
          onToolChange={handleToolChange}
          onUndo={graph.undo}
          counts={graph.counts}
        />

        {/* Canvas — add bottom padding on mobile for bottom bar */}
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
              onTerminalClick={graph.handleTerminalClick}
              onCancelWire={graph.cancelWire}
              connectedTerminals={graph.connectedTerminals}
              warnings={graph.warnings}
              nodeInfo={graph.nodeInfo}
              showLabels={showLabels}
            />
          </div>
        </div>

        {/* Properties: desktop static, tablet/mobile overlay */}
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

      {/* Mobile FAB for export */}
      <FloatingActionButton
        onExportCSV={handleExportCSV}
        onSaveJSON={handleSaveJSON}
        onLoadJSON={handleLoadJSON}
      />
    </div>
  );
}
