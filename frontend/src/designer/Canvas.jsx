import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Stage, Layer, Circle, Line, Text, Rect } from "react-konva";
import CapacitorSymbol from "./symbols/Capacitor";
import JosephsonJunctionSymbol from "./symbols/JosephsonJunction";
import GroundSymbol from "./symbols/Ground";
import WireSymbol from "./symbols/Wire";
import { snapToGrid, terminalWorldPos, getTerminals, wireRoute, routeMidpoint } from "./circuitState";
import ContextMenu from "./ContextMenu";

const GRID_SIZE = 20;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

const SYMBOL_MAP = {
  capacitor: CapacitorSymbol,
  josephson_junction: JosephsonJunctionSymbol,
  ground: GroundSymbol,
};

function GridDots({ width, height, scale, offsetX, offsetY }) {
  const dots = [];
  const startX = Math.floor(-offsetX / scale / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(-offsetY / scale / GRID_SIZE) * GRID_SIZE;
  const endX = startX + Math.ceil(width / scale / GRID_SIZE + 1) * GRID_SIZE;
  const endY = startY + Math.ceil(height / scale / GRID_SIZE + 1) * GRID_SIZE;
  for (let x = startX; x <= endX; x += GRID_SIZE) {
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      dots.push(<Circle key={`${x},${y}`} x={x} y={y} radius={1 / scale} fill="#d1d5db" listening={false} />);
    }
  }
  return <>{dots}</>;
}

function NodeLabels({ components, nodeInfo }) {
  if (!nodeInfo || nodeInfo.nodeCount === 0) return null;
  const { terminalToNode, nodeLabels } = nodeInfo;
  const nodePositions = {};
  for (const comp of components) {
    for (const t of getTerminals(comp.type)) {
      const tid = `${comp.id}:${t.side}`;
      const nodeIdx = terminalToNode[tid];
      if (nodeIdx === undefined) continue;
      const pos = terminalWorldPos(comp, t);
      if (!nodePositions[nodeIdx]) nodePositions[nodeIdx] = [];
      nodePositions[nodeIdx].push(pos);
    }
  }
  return Object.entries(nodePositions)
    .filter(([, positions]) => positions.length >= 2)
    .map(([idx, positions]) => {
      const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
      const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
      const label = nodeLabels[idx];
      const w = label.length * 6 + 8;
      return (
        <React.Fragment key={`node-${idx}`}>
          <Rect x={cx + 4} y={cy - 16} width={w} height={14} cornerRadius={3}
            fill="white" stroke="#d1d5db" strokeWidth={0.5} listening={false} />
          <Text x={cx + 4} y={cy - 15} width={w} height={14} align="center" verticalAlign="middle"
            text={label} fontSize={9} fontFamily="system-ui, sans-serif" fontStyle="bold"
            fill={label === "GND" ? "#166534" : "#6b7280"} listening={false} />
        </React.Fragment>
      );
    });
}

function ValueLabels({ components }) {
  return components.map((comp) => {
    const val = comp.capacitance || comp.ic;
    if (!val) return null;
    return (
      <Text key={`val-${comp.id}`} x={comp.x - 30} y={comp.y + 22} width={60} align="center"
        text={val} fontSize={9} fontFamily="system-ui, sans-serif" fill="#9ca3af" listening={false} />
    );
  });
}

export default function Canvas({
  activeTool, components, wires, selectedId, selectedIds = new Set(), wireStart,
  onSelect, onComponentMove, onStartMoveComponent, onDropComponent,
  onTerminalClick, onCancelWire, connectedTerminals,
  warnings = [], nodeInfo, showLabels = true,
  onDeleteComponent, onDeleteWire, onDuplicateComponent, onRotateComponent, onOpenProperties,
  onCanvasPlace, onFinishPlacement, placementLabel,
  onCancelDelete,
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hoveredTerminal, setHoveredTerminal] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const lastPinchDist = useRef(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, compId }
  const longPressTimer = useRef(null);

  const floatingIds = useMemo(() =>
    new Set(warnings.filter((w) => w.type === "floating").map((w) => w.compId)),
  [warnings]);

  // Build set of terminal IDs belonging to the wireStart component (to exclude from targets)
  const wireStartTerminalIds = useMemo(() => {
    if (!wireStart) return new Set();
    return new Set([`${wireStart.compId}:${wireStart.side}`]);
  }, [wireStart]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, direction > 0 ? oldScale * factor : oldScale / factor));
    setScale(newScale);
    setPosition({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  }, []);

  const handleTouchMove = useCallback((e) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current != null) {
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const ratio = dist / lastPinchDist.current;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * ratio));
        const cx = (touches[0].clientX + touches[1].clientX) / 2;
        const cy = (touches[0].clientY + touches[1].clientY) / 2;
        const rect = containerRef.current.getBoundingClientRect();
        const px = cx - rect.left;
        const py = cy - rect.top;
        const mousePointTo = { x: (px - stage.x()) / oldScale, y: (py - stage.y()) / oldScale };
        setScale(newScale);
        setPosition({ x: px - mousePointTo.x * newScale, y: py - mousePointTo.y * newScale });
      }
      lastPinchDist.current = dist;
    }
  }, []);

  const justPinched = useRef(false);
  const handleTouchEnd = useCallback(() => {
    if (lastPinchDist.current != null) justPinched.current = true;
    lastPinchDist.current = null;
    // Reset pinch flag after a short delay so the next single tap works
    setTimeout(() => { justPinched.current = false; }, 300);
  }, []);

  const handleDragEnd = useCallback((e) => {
    if (e.target === stageRef.current) setPosition({ x: e.target.x(), y: e.target.y() });
  }, []);

  const isPlaceTool = activeTool?.startsWith("place_");
  const isDeleteTool = activeTool === "delete";

  const handleStageClick = useCallback((e) => {
    if (e.target !== stageRef.current) return;
    // Guard: don't place if a pinch gesture just ended
    if (justPinched.current) return;

    if (isPlaceTool && onCanvasPlace) {
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const x = snapToGrid((pointer.x - stage.x()) / stage.scaleX());
      const y = snapToGrid((pointer.y - stage.y()) / stage.scaleY());
      onCanvasPlace(x, y);
    } else if (wireStart) {
      onCancelWire?.();
    } else {
      onSelect?.(null);
    }
  }, [onSelect, wireStart, onCancelWire, isPlaceTool, onCanvasPlace]);

  const handleMouseMove = useCallback((e) => {
    if (!wireStart) { setMousePos(null); return; }
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    setMousePos({ x: (pointer.x - stage.x()) / stage.scaleX(), y: (pointer.y - stage.y()) / stage.scaleY() });
  }, [wireStart]);

  // Long-press detection for context menu
  const handleComponentTouchStart = useCallback((compId, e) => {
    if (isDeleteTool) return;
    longPressTimer.current = setTimeout(() => {
      const touch = e.evt?.touches?.[0] || e.evt;
      if (touch) {
        setContextMenu({ x: touch.clientX, y: touch.clientY, compId });
        onSelect?.(compId);
      }
    }, 500);
  }, [isDeleteTool, onSelect]);

  const handleComponentTouchEnd = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  // Right-click context menu (desktop)
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    // Find component under pointer
    const canvasX = (pointer.x - stage.x()) / stage.scaleX();
    const canvasY = (pointer.y - stage.y()) / stage.scaleY();
    const comp = components.find((c) => Math.abs(c.x - canvasX) < 35 && Math.abs(c.y - canvasY) < 25);
    if (comp) {
      setContextMenu({ x: e.clientX, y: e.clientY, compId: comp.id });
      onSelect?.(comp.id);
    }
  }, [components, onSelect]);

  const handleContextAction = useCallback((action) => {
    if (!contextMenu) return;
    switch (action) {
      case "delete": onDeleteComponent?.(contextMenu.compId); break;
      case "duplicate": onDuplicateComponent?.(); break;
      case "rotate": onRotateComponent?.(contextMenu.compId); break;
      case "properties": onOpenProperties?.(); break;
    }
  }, [contextMenu, onDeleteComponent, onDuplicateComponent, onRotateComponent, onOpenProperties]);

  const handleComponentDragStart = useCallback((id) => {
    handleComponentTouchEnd(); // Cancel long-press if drag starts
    onStartMoveComponent?.();
  }, [onStartMoveComponent, handleComponentTouchEnd]);
  const handleComponentDragMove = useCallback((id, e) => {
    const node = e.target; node.x(snapToGrid(node.x())); node.y(snapToGrid(node.y()));
  }, []);
  const handleComponentDragEnd = useCallback((id, e) => {
    const node = e.target; onComponentMove?.(id, snapToGrid(node.x()), snapToGrid(node.y()));
  }, [onComponentMove]);

  const handleTerminalEnter = useCallback((compId, side) => setHoveredTerminal(`${compId}:${side}`), []);
  const handleTerminalLeave = useCallback(() => setHoveredTerminal(null), []);

  // Terminal click: on mobile, always handle (auto-enter wire mode); on desktop, only in wire mode
  const handleTerminalClick = useCallback((compId, side) => {
    if (isDeleteTool) {
      onDeleteComponent?.(compId);
      return;
    }
    if (isPlaceTool) return;
    // Always allow terminal clicks to start/complete wires; the hook handles the state machine.
    onTerminalClick?.(compId, side);
  }, [isDeleteTool, isPlaceTool, onDeleteComponent, onTerminalClick]);

  const handleComponentSelect = useCallback((id) => {
    if (isDeleteTool) {
      onDeleteComponent?.(id);
      return;
    }
    onSelect?.(id);
  }, [isDeleteTool, onDeleteComponent, onSelect]);

  const handleWireSelect = useCallback((id) => {
    if (isDeleteTool) {
      onDeleteWire?.(id);
      return;
    }
    onSelect?.(id);
  }, [isDeleteTool, onDeleteWire, onSelect]);

  const handleDragOver = useCallback((e) => e.preventDefault(), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("component-type");
    if (!type) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = containerRef.current.getBoundingClientRect();
    onDropComponent?.(type, snapToGrid((e.clientX - rect.left - position.x) / scale), snapToGrid((e.clientY - rect.top - position.y) / scale));
  }, [scale, position, onDropComponent]);

  function wirePoints(wire) {
    const srcComp = components.find((c) => c.id === wire.sourceComp);
    const tgtComp = components.find((c) => c.id === wire.targetComp);
    if (!srcComp || !tgtComp) return null;
    const srcT = getTerminals(srcComp.type).find((t) => t.side === wire.sourceSide);
    const tgtT = getTerminals(tgtComp.type).find((t) => t.side === wire.targetSide);
    if (!srcT || !tgtT) return null;
    const src = terminalWorldPos(srcComp, srcT);
    const tgt = terminalWorldPos(tgtComp, tgtT);
    return [src.x, src.y, tgt.x, tgt.y];
  }

  // Wire preview: follow mouse on desktop, or point toward canvas center on mobile
  let wirePreviewPoints = null;
  if (wireStart) {
    const comp = components.find((c) => c.id === wireStart.compId);
    if (comp) {
      const t = getTerminals(comp.type).find((t) => t.side === wireStart.side);
      if (t) {
        const src = terminalWorldPos(comp, t);
        if (mousePos) {
          wirePreviewPoints = [src.x, src.y, mousePos.x, mousePos.y];
        } else {
          // Static short line pointing outward from terminal (for mobile where no mousemove)
          wirePreviewPoints = [src.x, src.y, src.x + 30, src.y];
        }
      }
    }
  }

  // Determine terminal state: during wire drawing, show non-start terminals as "target"
  function getTerminalState(compId, side) {
    const tid = `${compId}:${side}`;
    if (hoveredTerminal === tid) {
      return wireStart ? "dragging-wire" : "hover";
    }
    if (wireStart && !wireStartTerminalIds.has(tid)) return "target";
    if (connectedTerminals.includes(tid)) return "connected";
    return "default";
  }

  const cursor = isPlaceTool ? "cell" : activeTool === "wire" || wireStart ? "crosshair" : isDeleteTool ? "pointer" : "default";
  const isEmpty = components.length === 0;

  // Compute screen position of delete X button for the selected item.
  const selectedComp = selectedId ? components.find((c) => c.id === selectedId) : null;
  const selectedWire = selectedId ? wires.find((w) => w.id === selectedId) : null;
  let deleteButtonPos = null;
  let deleteButtonKind = null;
  if (selectedComp && !wireStart) {
    deleteButtonPos = {
      x: selectedComp.x * scale + position.x + 30 * scale,
      y: selectedComp.y * scale + position.y - 25 * scale,
    };
    deleteButtonKind = "component";
  } else if (selectedWire && !wireStart) {
    const pts = wirePoints(selectedWire);
    if (pts) {
      const mid = routeMidpoint(wireRoute(pts));
      deleteButtonPos = {
        x: mid.x * scale + position.x,
        y: mid.y * scale + position.y,
      };
      deleteButtonKind = "wire";
    }
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden bg-white relative touch-none" style={{ cursor }} onDragOver={handleDragOver} onDrop={handleDrop} onContextMenu={handleContextMenu}>
      {/* Wire drawing banner */}
      {wireStart && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200">
          <span className="text-xs text-blue-700 font-medium">Tap another terminal to complete the wire</span>
          <button onClick={onCancelWire}
            className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-white border border-blue-300 rounded hover:bg-blue-50">
            Cancel
          </button>
        </div>
      )}

      {/* Delete mode banner */}
      {isDeleteTool && !wireStart && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center gap-3 px-4 py-2 bg-red-50 border-b border-red-200">
          <span className="text-xs text-red-700 font-medium">Tap a component or wire to delete</span>
          <button onClick={onCancelDelete}
            className="px-2 py-0.5 text-xs font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50">
            Done
          </button>
        </div>
      )}

      {/* Placement mode banner (mobile) */}
      {isPlaceTool && !wireStart && (
        <div className="absolute top-0 left-0 right-0 z-20 flex md:hidden items-center justify-center gap-3 px-4 py-2 bg-green-50 border-b border-green-200">
          <span className="text-xs text-green-700 font-medium">Tap canvas to place {placementLabel || "component"}</span>
          <button onClick={onFinishPlacement}
            className="px-2 py-0.5 text-xs font-medium text-green-600 bg-white border border-green-300 rounded hover:bg-green-50">
            Done
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 px-8">
          <div className="text-center">
            <div className="text-gray-300 text-base md:text-lg font-medium hidden md:block">Drag a component from the panel to get started</div>
            <div className="text-gray-300 text-base font-medium md:hidden">Choose a component below, then tap the canvas</div>
            <div className="text-gray-300 text-sm mt-1 hidden md:block">or press C for capacitor, J for Josephson junction</div>
          </div>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={activeTool === "select" && !wireStart && !isPlaceTool}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Layer listening={false}>
          <GridDots width={dimensions.width} height={dimensions.height} scale={scale} offsetX={position.x} offsetY={position.y} />
        </Layer>
        <Layer>
          {wires.map((w) => {
            const pts = wirePoints(w);
            if (!pts) return null;
            return <WireSymbol key={w.id} id={w.id} points={pts} isSelected={selectedId === w.id} onSelect={handleWireSelect} />;
          })}
          {wirePreviewPoints && <Line points={wirePreviewPoints} stroke="#93c5fd" strokeWidth={2} dash={[6, 4]} listening={false} />}
          {components.filter((c) => floatingIds.has(c.id)).map((comp) => (
            <Rect key={`warn-${comp.id}`} x={comp.x - 36} y={comp.y - 26} width={72} height={52}
              stroke="#f59e0b" strokeWidth={1.5} cornerRadius={4} dash={[5, 3]} listening={false} />
          ))}
          {components.map((comp) => {
            const Symbol = SYMBOL_MAP[comp.type];
            if (!Symbol) return null;
            return (
              <Symbol key={comp.id} id={comp.id} x={comp.x} y={comp.y} rotation={comp.rotation} label={comp.label}
                isSelected={selectedId === comp.id || selectedIds.has(comp.id)} hoveredTerminal={hoveredTerminal}
                connectedTerminals={connectedTerminals} wireToolActive={activeTool === "wire" || !!wireStart}
                getTerminalState={getTerminalState}
                onSelect={handleComponentSelect} onDragStart={handleComponentDragStart} onDragMove={handleComponentDragMove}
                onDragEnd={handleComponentDragEnd} onTerminalEnter={handleTerminalEnter}
                onTerminalLeave={handleTerminalLeave} onTerminalClick={handleTerminalClick}
                draggable={activeTool === "select" && !wireStart}
                onTouchStart={(e) => handleComponentTouchStart(comp.id, e)}
                onTouchEnd={handleComponentTouchEnd} />
            );
          })}
          {showLabels && <ValueLabels components={components} />}
          {showLabels && <NodeLabels components={components} nodeInfo={nodeInfo} />}
        </Layer>
      </Stage>

      {/* Delete X button on selected item */}
      {deleteButtonPos && deleteButtonKind && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (deleteButtonKind === "component") onDeleteComponent?.(selectedComp.id);
            else onDeleteWire?.(selectedWire.id);
          }}
          className="absolute z-20 w-8 h-8 md:w-7 md:h-7 flex items-center justify-center
                     bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md
                     transition-colors"
          style={{ left: deleteButtonPos.x, top: deleteButtonPos.y, transform: "translate(-50%, -50%)" }}
          title="Delete"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
