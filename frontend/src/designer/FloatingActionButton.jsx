import { useState } from "react";

export default function FloatingActionButton({ onExportCSV, onSaveJSON, onLoadJSON }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2">
      {/* Menu items */}
      {open && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-slide-in-bottom">
          <MenuItem label="Export CSV" onClick={() => { onExportCSV?.("binary"); setOpen(false); }} />
          <MenuItem label="Save JSON" onClick={() => { onSaveJSON?.(); setOpen(false); }} />
          <MenuItem label="Load Circuit" onClick={() => { onLoadJSON?.(); setOpen(false); }} />
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all
          ${open ? "bg-gray-700 rotate-45" : "bg-green-600 hover:bg-green-700"}`}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
          {open ? (
            <path d="M12 5v14M5 12h14" />
          ) : (
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          )}
        </svg>
      </button>
    </div>
  );
}

function MenuItem({ label, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0">
      {label}
    </button>
  );
}
