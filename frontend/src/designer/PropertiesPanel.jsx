import { useState } from "react";
import MatrixPreview from "./MatrixPreview";

const CSV_MODES = [
  { value: "binary", label: "Binary (0/1)" },
  { value: "types", label: "Component Types" },
  { value: "separate", label: "Separate Matrices" },
];

export default function PropertiesPanel({
  selected,
  counts,
  adjacency,
  warnings = [],
  onPropertyChange,
  onExportCSV,
  onSaveJSON,
  onLoadJSON,
  isOpen,
  onClose,
}) {
  const [csvMode, setCsvMode] = useState("binary");

  return (
    <>
      {/* Desktop: static sidebar */}
      <div className="hidden lg:flex w-64 bg-gray-50 border-l border-gray-200 flex-col flex-shrink-0">
        <PanelContent
          selected={selected} counts={counts} adjacency={adjacency} warnings={warnings}
          onPropertyChange={onPropertyChange} csvMode={csvMode} setCsvMode={setCsvMode}
          onExportCSV={onExportCSV} onSaveJSON={onSaveJSON} onLoadJSON={onLoadJSON}
        />
      </div>

      {/* Tablet: slide-in drawer from right */}
      {isOpen && (
        <div className="hidden md:block lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={onClose} />
          <div className="absolute top-0 right-0 bottom-0 w-72 bg-gray-50 border-l border-gray-200 flex flex-col shadow-xl animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
              <h2 className="text-xs font-semibold text-gray-500 uppercase">Properties</h2>
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </div>
            <PanelContent
              selected={selected} counts={counts} adjacency={adjacency} warnings={warnings}
              onPropertyChange={onPropertyChange} csvMode={csvMode} setCsvMode={setCsvMode}
              onExportCSV={onExportCSV} onSaveJSON={onSaveJSON} onLoadJSON={onLoadJSON}
              noHeader
            />
          </div>
        </div>
      )}

      {/* Mobile: bottom sheet */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={onClose} />
          <div className="absolute bottom-0 left-0 right-0 bg-gray-50 rounded-t-2xl shadow-xl max-h-[70vh] flex flex-col animate-slide-in-bottom safe-area-bottom">
            <div className="flex items-center justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-4 py-1 border-b border-gray-200">
              <h2 className="text-xs font-semibold text-gray-500 uppercase">Properties</h2>
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </div>
            <PanelContent
              selected={selected} counts={counts} adjacency={adjacency} warnings={warnings}
              onPropertyChange={onPropertyChange} csvMode={csvMode} setCsvMode={setCsvMode}
              onExportCSV={onExportCSV} onSaveJSON={onSaveJSON} onLoadJSON={onLoadJSON}
              noHeader
            />
          </div>
        </div>
      )}
    </>
  );
}

function PanelContent({ selected, counts, adjacency, warnings, onPropertyChange, csvMode, setCsvMode, onExportCSV, onSaveJSON, onLoadJSON, noHeader }) {
  return (
    <>
      {!noHeader && (
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Properties</h2>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {selected ? (
          <SelectedProperties selected={selected} onPropertyChange={onPropertyChange} />
        ) : (
          <CircuitSummary counts={counts} adjacency={adjacency} warnings={warnings} />
        )}
      </div>
      <div className="px-4 py-3 border-t border-gray-200 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => onExportCSV?.(csvMode)}
            className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-l hover:bg-blue-700 transition-colors">
            Export CSV
          </button>
          <select value={csvMode} onChange={(e) => setCsvMode(e.target.value)}
            className="py-2 px-1 text-xs border border-blue-600 bg-blue-50 text-blue-800 rounded-r focus:outline-none cursor-pointer">
            {CSV_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onSaveJSON} className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">
            Save JSON
          </button>
          <button onClick={onLoadJSON} className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">
            Load
          </button>
        </div>
      </div>
    </>
  );
}

function SelectedProperties({ selected, onPropertyChange }) {
  if (selected.type === "capacitor") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-gray-800">Capacitor</span>
        </div>
        <Field label="Label" value={selected.label || ""} placeholder="C1" onChange={(v) => onPropertyChange(selected.id, "label", v)} />
        <Field label="Capacitance" value={selected.capacitance || ""} placeholder="e.g. 10 fF" onChange={(v) => onPropertyChange(selected.id, "capacitance", v)} />
        <ReadonlyField label="Position" value={`(${selected.x}, ${selected.y})`} />
        <ReadonlyField label="Rotation" value={`${selected.rotation || 0}\u00b0`} />
      </div>
    );
  }
  if (selected.type === "josephson_junction") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-sm font-medium text-gray-800">Josephson Junction</span>
        </div>
        <Field label="Label" value={selected.label || ""} placeholder="JJ1" onChange={(v) => onPropertyChange(selected.id, "label", v)} />
        <Field label="Critical Current (Ic)" value={selected.ic || ""} placeholder="e.g. 1 uA" onChange={(v) => onPropertyChange(selected.id, "ic", v)} />
        <ReadonlyField label="Position" value={`(${selected.x}, ${selected.y})`} />
        <ReadonlyField label="Rotation" value={`${selected.rotation || 0}\u00b0`} />
      </div>
    );
  }
  if (selected.type === "ground") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-green-600" />
          <span className="text-sm font-medium text-gray-800">Ground</span>
        </div>
        <Field label="Label" value={selected.label || ""} placeholder="GND" onChange={(v) => onPropertyChange(selected.id, "label", v)} />
        <ReadonlyField label="Position" value={`(${selected.x}, ${selected.y})`} />
      </div>
    );
  }
  if (selected.type === "wire") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-sm font-medium text-gray-800">Wire</span>
        </div>
        <div className="text-sm text-gray-600">
          <p>From: {selected.sourceComp}:{selected.sourceSide}</p>
          <p>To: {selected.targetComp}:{selected.targetSide}</p>
        </div>
      </div>
    );
  }
  return <p className="text-sm text-gray-500">Unknown type</p>;
}

function CircuitSummary({ counts, adjacency, warnings = [] }) {
  const { capacitors = 0, junctions = 0, nodes = 0, edges = 0 } = counts;
  const actionableWarnings = warnings.filter((w) => w.type !== "no_value");
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Select a component to edit its properties.</p>
      {actionableWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          {actionableWarnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
              <span className="mt-0.5 flex-shrink-0">!</span><span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">Circuit Summary</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-500">Capacitors</span>
          <span className="font-medium text-blue-700 text-right">{capacitors}</span>
          <span className="text-gray-500">Josephson Junctions</span>
          <span className="font-medium text-red-800 text-right">{junctions}</span>
          <span className="text-gray-500 border-t border-gray-100 pt-1">Nodes</span>
          <span className="font-medium text-gray-800 text-right border-t border-gray-100 pt-1">{nodes}</span>
          <span className="text-gray-500">Edges</span>
          <span className="font-medium text-gray-800 text-right">{edges}</span>
        </div>
      </div>
      {adjacency && adjacency.nodeCount > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Adjacency Matrix</h3>
          <MatrixPreview adjacency={adjacency} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, placeholder, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
    </label>
  );
}

function ReadonlyField({ label, value }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1 px-2 py-1.5 text-sm text-gray-500 bg-gray-100 rounded">{value}</div>
    </div>
  );
}
