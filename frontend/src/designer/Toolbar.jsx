import { useState } from "react";
import { TEMPLATES } from "./templates";

const TOOL_NAMES = {
  select: "Select",
  wire: "Wire Drawing",
  delete: "Delete",
  place_capacitor: "Place Capacitor",
  place_jj: "Place Junction",
  place_ground: "Place Ground",
};

export default function Toolbar({ activeTool, onToolChange, onUndo, onRedo, canUndo, canRedo, onClear, onZoomToFit, counts, warnings = [], showLabels, onToggleLabels, onLoadTemplate, onShare }) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const { capacitors = 0, junctions = 0, nodes = 0, edges = 0 } = counts;
  const disconnectedWarning = warnings.find((w) => w.type === "disconnected");
  const floatingCount = warnings.filter((w) => w.type === "floating").length;
  const toolName = TOOL_NAMES[activeTool] || "Select";

  return (
    <div className="h-10 bg-white border-b border-gray-200 flex items-center px-2 md:px-3 gap-1 md:gap-2 flex-shrink-0 overflow-x-auto">
      {/* Active tool indicator */}
      <span className="text-xs font-medium text-gray-700 whitespace-nowrap hidden sm:inline">
        {toolName}
      </span>

      <div className="hidden sm:block w-px h-5 bg-gray-200" />

      {/* Action buttons — hidden on mobile (undo is in the bottom bar) */}
      <div className="hidden sm:flex items-center gap-0.5">
        <ActionButton label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h7a3 3 0 010 6H8" /><path d="M6 4L3 7l3 3" /></svg>
        </ActionButton>
        <ActionButton label="Redo (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo}>
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 7H6a3 3 0 000 6h2" /><path d="M10 4l3 3-3 3" /></svg>
        </ActionButton>
        <ActionButton label="Clear All" onClick={onClear}>
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </ActionButton>
        <button onClick={onToggleLabels} title="Toggle Labels"
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${showLabels ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:bg-gray-100"}`}>
          Labels
        </button>
        <div className="relative">
          <button onClick={() => setTemplateOpen(!templateOpen)}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors">
            Templates
          </button>
          {templateOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-52">
              {TEMPLATES.map((t) => (
                <button key={t.name} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  onClick={() => { onLoadTemplate?.(t.data); setTemplateOpen(false); }}>
                  <div className="font-medium text-gray-700">{t.name}</div>
                  <div className="text-gray-400">{t.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onShare} title="Copy share link"
          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors">
          Share
        </button>
      </div>

      {/* Warnings */}
      {(disconnectedWarning || floatingCount > 0) && (
        <>
          <div className="hidden sm:block w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {disconnectedWarning && (
              <span className="text-[10px] md:text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap" title={disconnectedWarning.message}>
                {disconnectedWarning.message}
              </span>
            )}
            {floatingCount > 0 && (
              <span className="text-[10px] md:text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                {floatingCount} unconnected
              </span>
            )}
          </div>
        </>
      )}

      {/* Circuit counts */}
      <div className="ml-auto flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-gray-500 flex-shrink-0">
        <span className="inline-flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 hidden md:inline-block" />
          C:<span className="font-semibold text-blue-700">{capacitors}</span>
        </span>
        <span className="text-gray-300">|</span>
        <span className="inline-flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 hidden md:inline-block" />
          JJ:<span className="font-semibold text-red-800">{junctions}</span>
        </span>
        <span className="text-gray-300 hidden sm:inline">|</span>
        <span className="hidden sm:inline">N:<span className="font-semibold text-gray-700">{nodes}</span></span>
        <span className="text-gray-300 hidden sm:inline">|</span>
        <span className="hidden sm:inline">E:<span className="font-semibold text-gray-700">{edges}</span></span>
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={`p-1.5 rounded transition-colors ${disabled ? "text-gray-300 cursor-default" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>
      {children}
    </button>
  );
}
