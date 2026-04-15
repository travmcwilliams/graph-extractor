import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Stage, Layer, Circle, Line, Text, Rect } from "react-konva";
import CapacitorSymbol from "./symbols/Capacitor";
import JosephsonJunctionSymbol from "./symbols/JosephsonJunction";
import WireSymbol from "./symbols/Wire";
import { snapToGrid, terminalWorldPos, getTerminals } from "./circuitState";

const GRID_SIZE = 20;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

const SYMBOL_MAP = {
  capacitor: CapacitorSymbol,
  josephson_junction: JosephsonJunctionSymbol,
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
  return Object.entries(nodePositions).map(([idx, positions]) => {
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
    return (
      <Text key={`node-${idx}`} x={cx + 6} y={cy - 12} text={nodeLabels[idx]}
        fontSize={9} fontFamily="system-ui, sans-serif" fontStyle="bold" fill="#6b7280" listening={false} />
    );
  });
}

export default function Canvas({
  activeTool, components, wires, selectedId, wireStart,
  onSelect, onComponentMove, onStartMoveComponent, onDropComponent,
  onTerminalClick, onCancelWire, connectedTerminals,
  warnings = [], nodeInfo,
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hoveredTerminal, setHoveredTerminal] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const lastPinchDist = useRef(null);

  const floatingIds = useMemo(() =>
    new Set(warnings.filter((w) => w.type === "floating").map((w) => w.compId)),
  [warnings]);

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

  // Scroll-wheel zoom
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

  // Pinch-to-zoom (touch)
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

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  const handleDragEnd = useCallback((e) => {
    if (e.target === stageRef.current) setPosition({ x: e.target.x(), y: e.target.y() });
  }, []);

  const handleStageClick = useCallback((e) => {
    if (e.target === stageRef.current) {
      if (wireStart) onCancelWire?.();
      else onSelect?.(null);
    }
  }, [onSelect, wireStart, onCancelWire]);

  const handleMouseMove = useCallback((e) => {
    if (!wireStart) { setMousePos(null); return; }
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    setMousePos({ x: (pointer.x - stage.x()) / stage.scaleX(), y: (pointer.y - stage.y()) / stage.scaleY() });
  }, [wireStart]);

  const handleComponentDragStart = useCallback(() => { onStartMoveComponent?.(); }, [onStartMoveComponent]);
  const handleComponentDragMove = useCallback((id, e) => {
    const node = e.target; node.x(snapToGrid(node.x())); node.y(snapToGrid(node.y()));
  }, []);
  const handleComponentDragEnd = useCallback((id, e) => {
    const node = e.target; onComponentMove?.(id, snapToGrid(node.x()), snapToGrid(node.y()));
  }, [onComponentMove]);

  const handleTerminalEnter = useCallback((compId, side) => setHoveredTerminal(`${compId}:${side}`), []);
  const handleTerminalLeave = useCallback(() => setHoveredTerminal(null), []);
  const handleTerminalClick = useCallback((compId, side) => {
    if (activeTool === "wire") onTerminalClick?.(compId, side);
  }, [activeTool, onTerminalClick]);

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

  let wirePreviewPoints = null;
  if (wireStart && mousePos) {
    const comp = components.find((c) => c.id === wireStart.compId);
    if (comp) {
      const t = getTerminals(comp.type).find((t) => t.side === wireStart.side);
      if (t) { const src = terminalWorldPos(comp, t); wirePreviewPoints = [src.x, src.y, mousePos.x, mousePos.y]; }
    }
  }

  const cursor = activeTool === "wire" ? "crosshair" : activeTool === "delete" ? "not-allowed" : "default";
  const isEmpty = components.length === 0;

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden bg-white relative touch-none" style={{ cursor }} onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Empty state */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 px-8">
          <div className="text-center">
            <div className="text-gray-300 text-base md:text-lg font-medium hidden md:block">
              Drag a component from the panel to get started
            </div>
            <div className="text-gray-300 text-base font-medium md:hidden">
              Tap a component button below to place it
            </div>
            <div className="text-gray-300 text-sm mt-1 hidden md:block">
              or press C for capacitor, J for Josephson junction
            </div>
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
        draggable={activeTool === "select" && !wireStart}
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
            return <WireSymbol key={w.id} id={w.id} points={pts} isSelected={selectedId === w.id} onSelect={onSelect} />;
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
                isSelected={selectedId === comp.id} hoveredTerminal={hoveredTerminal}
                connectedTerminals={connectedTerminals} wireToolActive={activeTool === "wire"}
                onSelect={onSelect} onDragStart={handleComponentDragStart} onDragMove={handleComponentDragMove}
                onDragEnd={handleComponentDragEnd} onTerminalEnter={handleTerminalEnter}
                onTerminalLeave={handleTerminalLeave} onTerminalClick={handleTerminalClick} />
            );
          })}
          <NodeLabels components={components} nodeInfo={nodeInfo} />
        </Layer>
      </Stage>
    </div>
  );
}
