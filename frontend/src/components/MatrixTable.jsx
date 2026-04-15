import { useState } from "react";
import { colorFor } from "../componentColors";

export default function MatrixTable({ matrix, nodeIndex, edgeMetadata }) {
  const [tooltip, setTooltip] = useState(null);

  if (!matrix || matrix.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-400">
        No adjacency matrix to display
      </div>
    );
  }

  const labels = Object.values(nodeIndex);

  // Build a lookup: "source-target" -> edge info
  const edgeLookup = {};
  if (edgeMetadata) {
    edgeMetadata.forEach((e) => {
      edgeLookup[`${e.source}-${e.target}`] = e;
      edgeLookup[`${e.target}-${e.source}`] = e;
    });
  }

  function getCellColor(i, j) {
    const edge = edgeLookup[`${i}-${j}`];
    if (edge?.component && edge.component !== "wire") {
      return colorFor(edge.component).cell;
    }
    return "bg-blue-100";
  }

  function getCellTextColor(i, j) {
    const edge = edgeLookup[`${i}-${j}`];
    if (edge?.component && edge.component !== "wire") {
      return colorFor(edge.component).text;
    }
    return "text-blue-800";
  }

  function handleMouseEnter(e, i, j) {
    const edge = edgeLookup[`${i}-${j}`];
    if (!edge) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      component: edge.component || "wire",
      value: edge.value,
      confidence: edge.confidence,
      label: edge.label,
    });
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
      <h3 className="text-lg font-semibold mb-3">Adjacency Matrix</h3>
      <table className="text-sm font-mono">
        <thead>
          <tr>
            <th className="px-3 py-1" />
            {labels.map((label, i) => (
              <th key={i} className="px-3 py-1 text-center text-blue-600 text-xs sm:text-sm">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td className="px-3 py-1 font-semibold text-blue-600 text-xs sm:text-sm">
                {labels[i]}
              </td>
              {row.map((val, j) => (
                <td
                  key={j}
                  className={`px-3 py-1 text-center transition-colors ${
                    val > 0
                      ? `${getCellColor(i, j)} ${getCellTextColor(i, j)} font-medium cursor-default`
                      : "text-gray-300"
                  }`}
                  onMouseEnter={(e) => val > 0 && handleMouseEnter(e, i, j)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-medium capitalize">{tooltip.component}</div>
          {tooltip.label && <div>Label: {tooltip.label}</div>}
          {tooltip.value && <div>Value: {tooltip.value}</div>}
          <div>Confidence: {(tooltip.confidence * 100).toFixed(0)}%</div>
        </div>
      )}
    </div>
  );
}
