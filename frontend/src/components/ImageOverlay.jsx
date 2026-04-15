import COMPONENT_COLORS, { displayName } from "../componentColors";

export default function ImageOverlay({ base64, edgeMetadata }) {
  if (!base64) return null;

  const types = new Set();
  if (edgeMetadata) {
    edgeMetadata.forEach((e) => {
      if (e.component && e.component !== "wire") types.add(e.component);
    });
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Annotated Image</h3>
      </div>

      <div className="relative">
        <img
          src={`data:image/png;base64,${base64}`}
          alt="Annotated circuit with detected nodes and edges"
          className="max-w-full rounded border border-gray-200"
        />

        {types.size > 0 && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow text-xs space-y-1">
            {[...types].map((type) => {
              const colors = COMPONENT_COLORS[type.toLowerCase()] || {};
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-3 h-3 rounded-sm ${colors.badge || "bg-gray-300"}`}
                  />
                  <span className="text-gray-700">{displayName(type)}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-gray-400" />
              <span className="text-gray-700">Wire</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
