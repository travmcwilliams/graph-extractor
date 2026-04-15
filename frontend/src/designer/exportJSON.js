/**
 * Full circuit save/load as JSON.
 * Includes components, wires, computed nodes, and adjacency matrix.
 */

export function exportCircuitJSON(graphHook) {
  const base = graphHook.toJSON();
  const { matrix, labels, edges, nodeCount } = graphHook.adjacency;

  return {
    version: "0.2.0",
    ...base,
    computed: {
      nodeCount,
      nodeLabels: labels,
      adjacencyMatrix: matrix,
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        componentType: e.type,
        componentLabel: e.label,
        value: e.value,
      })),
    },
  };
}

export function downloadJSON(data, filename = "circuit.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadCircuitFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return reject(new Error("No file selected"));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          resolve(data);
        } catch (err) {
          reject(new Error("Invalid JSON file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    };
    input.click();
  });
}
