/**
 * Export adjacency matrix as CSV in three modes:
 *   "binary"    — 0/1 connectivity
 *   "types"     — component type abbreviations (C, JJ)
 *   "separate"  — two sections: capacitance matrix + Josephson energy matrix
 */

const TYPE_ABBREV = {
  capacitor: "C",
  josephson_junction: "JJ",
};

function csvRow(cells) {
  return cells
    .map((c) => {
      const s = String(c ?? "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

export function exportAdjacencyCSV(adjacency, mode = "binary") {
  const { matrix, labels, edges, nodeCount } = adjacency;
  if (nodeCount === 0) return "";

  switch (mode) {
    case "binary":
      return exportBinary(matrix, labels);
    case "types":
      return exportTypes(labels, edges, nodeCount);
    case "separate":
      return exportSeparate(labels, edges, nodeCount);
    default:
      return exportBinary(matrix, labels);
  }
}

function exportBinary(matrix, labels) {
  const rows = [csvRow(["", ...labels])];
  for (let i = 0; i < labels.length; i++) {
    rows.push(csvRow([labels[i], ...matrix[i]]));
  }
  return rows.join("\n");
}

function exportTypes(labels, edges, n) {
  // Build a matrix where each cell is the type abbreviation(s)
  const typeMatrix = Array.from({ length: n }, () => Array(n).fill(""));

  for (const edge of edges) {
    const abbrev = TYPE_ABBREV[edge.type] || edge.type;
    const existing = typeMatrix[edge.source][edge.target];
    typeMatrix[edge.source][edge.target] = existing
      ? `${existing}+${abbrev}`
      : abbrev;
    typeMatrix[edge.target][edge.source] = typeMatrix[edge.source][edge.target];
  }

  // Replace empty with "0"
  const rows = [csvRow(["", ...labels])];
  for (let i = 0; i < n; i++) {
    rows.push(
      csvRow([labels[i], ...typeMatrix[i].map((v) => v || "0")]),
    );
  }
  return rows.join("\n");
}

function exportSeparate(labels, edges, n) {
  const capMatrix = Array.from({ length: n }, () => Array(n).fill("0"));
  const jjMatrix = Array.from({ length: n }, () => Array(n).fill("0"));

  for (const edge of edges) {
    const val = edge.value || "1";
    if (edge.type === "capacitor") {
      capMatrix[edge.source][edge.target] = val;
      capMatrix[edge.target][edge.source] = val;
    } else if (edge.type === "josephson_junction") {
      jjMatrix[edge.source][edge.target] = val;
      jjMatrix[edge.target][edge.source] = val;
    }
  }

  const sections = [];

  sections.push("# Capacitance Matrix");
  sections.push(csvRow(["", ...labels]));
  for (let i = 0; i < n; i++) {
    sections.push(csvRow([labels[i], ...capMatrix[i]]));
  }

  sections.push("");
  sections.push("# Josephson Energy Matrix");
  sections.push(csvRow(["", ...labels]));
  for (let i = 0; i < n; i++) {
    sections.push(csvRow([labels[i], ...jjMatrix[i]]));
  }

  return sections.join("\n");
}

export function downloadCSV(content, filename = "circuit.csv") {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
