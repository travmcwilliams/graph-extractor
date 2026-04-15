/**
 * Live adjacency matrix table.
 * Color-coded: capacitor edges in blue, JJ edges in red, empty in light gray.
 */

function buildColorMatrix(labels, edges, n) {
  // Build a map of (i,j) -> edge types for coloring
  const cellInfo = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ value: 0, types: [] })),
  );

  for (const edge of edges) {
    const { source: s, target: t, type } = edge;
    cellInfo[s][t].value++;
    cellInfo[s][t].types.push(type);
    cellInfo[t][s].value++;
    cellInfo[t][s].types.push(type);
  }

  return cellInfo;
}

function cellColor(types) {
  if (types.length === 0) return "";
  const hasC = types.includes("capacitor");
  const hasJJ = types.includes("josephson_junction");
  if (hasC && hasJJ) return "bg-purple-100 text-purple-800";
  if (hasC) return "bg-blue-100 text-blue-800";
  if (hasJJ) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

export default function MatrixPreview({ adjacency }) {
  if (!adjacency || adjacency.nodeCount === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        Connect components with wires to see the adjacency matrix.
      </p>
    );
  }

  const { labels, edges, nodeCount } = adjacency;
  const cellInfo = buildColorMatrix(labels, edges, nodeCount);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs font-mono border-collapse">
        <thead>
          <tr>
            <th className="w-8" />
            {labels.map((l) => (
              <th
                key={l}
                className="px-1.5 py-1 text-gray-500 font-semibold text-center border-b border-gray-200"
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cellInfo.map((row, i) => (
            <tr key={i}>
              <td className="pr-1.5 py-0.5 text-gray-500 font-semibold text-right border-r border-gray-200">
                {labels[i]}
              </td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-1.5 py-0.5 text-center font-medium rounded-sm ${
                    i === j
                      ? "text-gray-200"
                      : cell.value > 0
                        ? cellColor(cell.types)
                        : "text-gray-300"
                  }`}
                >
                  {cell.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-blue-100 border border-blue-300" />
          Capacitor
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-100 border border-red-300" />
          JJ
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-purple-100 border border-purple-300" />
          Both
        </span>
      </div>
    </div>
  );
}
