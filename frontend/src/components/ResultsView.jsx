import { colorFor, displayName } from "../componentColors";
import MatrixTable from "./MatrixTable";
import ImageOverlay from "./ImageOverlay";
import ConfidenceBar from "./ConfidenceBar";

function ComponentSummary({ edgeMetadata }) {
  const counts = {};
  edgeMetadata.forEach((e) => {
    const type = e.component || "wire";
    counts[type] = (counts[type] || 0) + 1;
  });

  const types = Object.entries(counts).filter(([t]) => t !== "wire");
  if (types.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow px-6 py-4">
      <h3 className="text-sm font-semibold text-gray-500 mb-2">
        Components Detected
      </h3>
      <div className="flex flex-wrap gap-2">
        {types.map(([type, count]) => {
          const colors = colorFor(type);
          return (
            <span
              key={type}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${colors.badge}`}
              />
              {count} {displayName(type)}
              {count > 1 ? "s" : ""}
            </span>
          );
        })}
        {counts.wire > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            {counts.wire} Wire{counts.wire > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function downloadJSON(result) {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "graph_extraction.json";
  a.click();
  URL.revokeObjectURL(url);
}

function copyMatrix(matrix) {
  const text = matrix.map((row) => row.join("\t")).join("\n");
  navigator.clipboard.writeText(text);
}

function downloadAnnotatedImage(base64) {
  const a = document.createElement("a");
  a.href = `data:image/png;base64,${base64}`;
  a.download = "annotated_circuit.png";
  a.click();
}

export default function ResultsView({ result, onReset }) {
  if (!result) return null;

  const hasComponents = result.edge_metadata.some(
    (e) => e.component && e.component !== "wire"
  );

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Summary bar */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
            <span>
              Status:{" "}
              <span
                className={
                  result.status === "success"
                    ? "text-green-600 font-medium"
                    : "text-yellow-600 font-medium"
                }
              >
                {result.status}
              </span>
            </span>
            <span>
              Nodes: <span className="font-medium">{result.node_count}</span>
            </span>
            <span>
              Edges: <span className="font-medium">{result.edge_count}</span>
            </span>
            <span>
              Time:{" "}
              <span className="font-medium">
                {result.processing_time_ms.toFixed(0)}ms
              </span>
            </span>
          </div>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            Upload Another
          </button>
        </div>
      </div>

      {/* Component summary */}
      {hasComponents && (
        <ComponentSummary edgeMetadata={result.edge_metadata} />
      )}

      {/* Annotated image */}
      {result.annotated_image && (
        <ImageOverlay
          base64={result.annotated_image}
          edgeMetadata={result.edge_metadata}
        />
      )}

      {/* Adjacency matrix */}
      <MatrixTable
        matrix={result.adjacency_matrix}
        nodeIndex={result.node_index}
        edgeMetadata={result.edge_metadata}
      />

      {/* Edge metadata table */}
      {result.edge_metadata.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold mb-3">Edge Metadata</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2 pr-3">Target</th>
                {hasComponents && <th className="pb-2 pr-3">Type</th>}
                <th className="pb-2 pr-3">Confidence</th>
                <th className="pb-2 pr-3">Label</th>
                <th className="pb-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {result.edge_metadata.map((e, i) => {
                const type = e.component || "wire";
                const colors = colorFor(type);
                return (
                  <tr key={i} className={`border-b last:border-0 ${colors.bg}`}>
                    <td className="py-2 pr-3">
                      {result.node_index[e.source] ?? e.source}
                    </td>
                    <td className="py-2 pr-3">
                      {result.node_index[e.target] ?? e.target}
                    </td>
                    {hasComponents && (
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
                        >
                          {displayName(type)}
                        </span>
                      </td>
                    )}
                    <td className="py-2 pr-3">
                      <ConfidenceBar confidence={e.confidence} />
                    </td>
                    <td className="py-2 pr-3 text-gray-500">
                      {e.label ?? "—"}
                    </td>
                    <td className="py-2 text-gray-500">
                      {e.value ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Uncertain edges warning */}
      {result.uncertain.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          {result.uncertain.length} uncertain edge(s) detected (confidence
          below threshold)
        </div>
      )}

      {/* Download / Copy actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => downloadJSON(result)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Download JSON
        </button>
        <button
          onClick={() => copyMatrix(result.adjacency_matrix)}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-300 transition-colors"
        >
          Copy Matrix
        </button>
        {result.annotated_image && (
          <button
            onClick={() => downloadAnnotatedImage(result.annotated_image)}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-300 transition-colors"
          >
            Download Annotated Image
          </button>
        )}
      </div>
    </div>
  );
}
