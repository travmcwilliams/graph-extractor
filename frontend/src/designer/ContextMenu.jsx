import { useEffect, useRef } from "react";

const ITEMS = [
  { id: "delete", label: "Delete", icon: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6", color: "text-red-600" },
  { id: "duplicate", label: "Duplicate", icon: "M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v12M12 2v6M9 5l3-3 3 3", color: "text-gray-700" },
  { id: "rotate", label: "Rotate", icon: "M4 12a8 8 0 0114.5-4.5M20 4v4h-4M20 12a8 8 0 01-14.5 4.5M4 20v-4h4", color: "text-gray-700" },
  { id: "properties", label: "Properties", icon: "M12 3v1.5M12 19.5V21M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M3 12h1.5M19.5 12H21M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1", color: "text-gray-700" },
];

export default function ContextMenu({ x, y, onAction, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [onClose]);

  // Keep menu within viewport
  const style = {
    left: Math.min(x, window.innerWidth - 160),
    top: Math.min(y, window.innerHeight - 200),
  };

  return (
    <div ref={ref} className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-40" style={style}>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => { onAction(item.id); onClose(); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${item.color}`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={item.icon} />
          </svg>
          {item.label}
        </button>
      ))}
    </div>
  );
}
