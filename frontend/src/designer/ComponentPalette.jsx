// SVG icons used in both desktop and mobile layouts
const ICONS = {
  select: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M3 2l14 9.5L10.5 13 8.5 20z" />
    </svg>
  ),
  wire: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="5" r="3" />
      <line x1="7" y1="17" x2="17" y2="7" />
    </svg>
  ),
  capacitor: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="2" y1="12" x2="9" y2="12" />
      <line x1="9" y1="5" x2="9" y2="19" strokeWidth="2.5" />
      <line x1="15" y1="5" x2="15" y2="19" strokeWidth="2.5" />
      <line x1="15" y1="12" x2="22" y2="12" />
    </svg>
  ),
  josephson_junction: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="9" y1="5" x2="15" y2="19" strokeWidth="2.5" />
      <line x1="15" y1="5" x2="9" y2="19" strokeWidth="2.5" />
    </svg>
  ),
  ground: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="3" x2="12" y2="10" />
      <line x1="4" y1="10" x2="20" y2="10" strokeWidth="2.5" />
      <line x1="7" y1="15" x2="17" y2="15" strokeWidth="2.5" />
      <line x1="10" y1="20" x2="14" y2="20" strokeWidth="2.5" />
    </svg>
  ),
  delete: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10h10a5 5 0 010 10H11" />
      <path d="M7 6L3 10l4 4" />
    </svg>
  ),
};

const BUTTONS = [
  { id: "select", label: "Select", shortcut: "V", icon: ICONS.select },
  { id: "wire", label: "Wire", shortcut: "W", icon: ICONS.wire },
  { id: "capacitor", toolId: "place_capacitor", label: "Capacitor", shortcut: "C", icon: ICONS.capacitor, countKey: "capacitors", badgeColor: "bg-blue-500" },
  { id: "josephson_junction", toolId: "place_jj", label: "Junction", shortcut: "J", icon: ICONS.josephson_junction, countKey: "junctions", badgeColor: "bg-red-600" },
  { id: "ground", toolId: "place_ground", label: "Ground", shortcut: "G", icon: ICONS.ground, countKey: "grounds", badgeColor: "bg-green-700" },
  { id: "delete", label: "Delete", shortcut: "", icon: ICONS.delete },
  { id: "undo", label: "Undo", shortcut: "", icon: ICONS.undo },
];

function toolIdFor(btn) {
  return btn.toolId || btn.id;
}

function isActive(btn, activeTool) {
  return activeTool === toolIdFor(btn) || (btn.id === "capacitor" && activeTool === "place_capacitor") || (btn.id === "josephson_junction" && activeTool === "place_jj") || (btn.id === "ground" && activeTool === "place_ground");
}

export default function ComponentPalette({ activeTool, onToolChange, onUndo, onDelete, counts = {} }) {
  const handleButtonClick = (btn) => {
    if (btn.id === "undo") {
      onUndo?.();
      return;
    }
    if (btn.id === "delete") {
      onDelete?.();
      return;
    }
    onToolChange(toolIdFor(btn));
  };

  return (
    <>
      {/* Desktop: left sidebar with 2-col grid */}
      <div className="hidden lg:flex w-48 bg-gray-50 border-r border-gray-200 flex-col flex-shrink-0">
        <div className="px-2 py-3 flex-1">
          <div className="grid grid-cols-2 gap-1.5">
            {BUTTONS.map((btn) => (
              <DesktopButton
                key={btn.id}
                btn={btn}
                active={isActive(btn, activeTool)}
                count={btn.countKey ? counts[btn.countKey] : null}
                onClick={() => handleButtonClick(btn)}
              />
            ))}
          </div>
        </div>
        <div className="px-3 py-2 border-t border-gray-200 text-[10px] text-gray-400 text-center">
          Drag or press shortcut key
        </div>
      </div>

      {/* Tablet: narrow icon strip */}
      <div className="hidden md:flex lg:hidden w-14 bg-gray-50 border-r border-gray-200 flex-col items-center py-2 gap-1 flex-shrink-0">
        {BUTTONS.map((btn) => (
          <TabletButton
            key={btn.id}
            btn={btn}
            active={isActive(btn, activeTool)}
            count={btn.countKey ? counts[btn.countKey] : null}
            onClick={() => handleButtonClick(btn)}
          />
        ))}
      </div>

      {/* Mobile: fixed bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around px-1 py-1">
          {BUTTONS.map((btn) => (
            <MobileButton
              key={btn.id}
              btn={btn}
              active={isActive(btn, activeTool)}
              count={btn.countKey ? counts[btn.countKey] : null}
              onClick={() => handleButtonClick(btn)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function DesktopButton({ btn, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      draggable={btn.id === "capacitor" || btn.id === "josephson_junction" || btn.id === "ground"}
      onDragStart={(e) => e.dataTransfer.setData("component-type", btn.id)}
      title={`${btn.label}${btn.shortcut ? ` (${btn.shortcut})` : ""}`}
      className={`relative flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all
        min-h-[60px] cursor-pointer
        ${active
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-transparent bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
        }`}
    >
      <div className="mb-0.5">{btn.icon}</div>
      <span className="text-[10px] font-medium leading-tight">{btn.label}</span>
      {btn.shortcut && <span className="text-[9px] text-gray-400">{btn.shortcut}</span>}
      {count > 0 && (
        <span className={`absolute -top-1 -right-1 text-[9px] text-white font-bold w-4 h-4 rounded-full flex items-center justify-center ${btn.badgeColor}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function TabletButton({ btn, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      title={`${btn.label}${btn.shortcut ? ` (${btn.shortcut})` : ""}`}
      className={`relative p-2 rounded-lg transition-colors
        ${active ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"}`}
    >
      {btn.icon}
      {count > 0 && (
        <span className={`absolute -top-0.5 -right-0.5 text-[8px] text-white font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center ${btn.badgeColor}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function MobileButton({ btn, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center min-w-[48px] min-h-[48px] p-1 rounded-lg transition-colors
        ${active ? "text-blue-600" : "text-gray-500"}`}
    >
      <div className="w-5 h-5 flex items-center justify-center">{btn.icon}</div>
      <span className="text-[9px] font-medium mt-0.5 leading-tight">{btn.label}</span>
      {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-blue-600 rounded-full" />}
      {count > 0 && (
        <span className={`absolute top-0 right-0.5 text-[8px] text-white font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center ${btn.badgeColor}`}>
          {count}
        </span>
      )}
    </button>
  );
}
