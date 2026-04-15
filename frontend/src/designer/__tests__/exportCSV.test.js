import { describe, it, expect } from "vitest";
import { exportAdjacencyCSV } from "../exportCSV";

function makeAdjacency(matrix, labels, edges) {
  return { matrix, labels, edges, nodeCount: labels.length };
}

describe("exportAdjacencyCSV", () => {
  it("returns empty string for empty circuit", () => {
    expect(exportAdjacencyCSV({ matrix: [], labels: [], edges: [], nodeCount: 0 })).toBe("");
  });

  describe("binary mode", () => {
    it("exports numeric matrix", () => {
      const adj = makeAdjacency(
        [[0, 2], [2, 0]], ["N0", "N1"],
        [
          { source: 0, target: 1, type: "capacitor", label: "C1", value: "10fF" },
          { source: 0, target: 1, type: "josephson_junction", label: "JJ1", value: "1uA" },
        ],
      );
      const csv = exportAdjacencyCSV(adj, "binary");
      const lines = csv.split("\n");
      expect(lines[0]).toBe(",N0,N1");
      expect(lines[1]).toBe("N0,0,2");
      expect(lines[2]).toBe("N1,2,0");
    });

    it("handles single node", () => {
      const adj = makeAdjacency([[0]], ["N0"], []);
      const csv = exportAdjacencyCSV(adj, "binary");
      expect(csv).toBe(",N0\nN0,0");
    });

    it("handles 3x3 matrix", () => {
      const adj = makeAdjacency(
        [[0, 1, 0], [1, 0, 1], [0, 1, 0]], ["N0", "N1", "N2"],
        [
          { source: 0, target: 1, type: "capacitor", label: "C1", value: null },
          { source: 1, target: 2, type: "josephson_junction", label: "JJ1", value: null },
        ],
      );
      const csv = exportAdjacencyCSV(adj, "binary");
      const lines = csv.split("\n");
      expect(lines).toHaveLength(4); // header + 3 rows
    });
  });

  describe("types mode", () => {
    it("shows component type abbreviations", () => {
      const adj = makeAdjacency(
        [[0, 2], [2, 0]], ["N0", "N1"],
        [
          { source: 0, target: 1, type: "capacitor", label: "C1", value: null },
          { source: 0, target: 1, type: "josephson_junction", label: "JJ1", value: null },
        ],
      );
      const csv = exportAdjacencyCSV(adj, "types");
      const lines = csv.split("\n");
      expect(lines[1]).toBe("N0,0,C+JJ");
      expect(lines[2]).toBe("N1,C+JJ,0");
    });

    it("shows single type without plus", () => {
      const adj = makeAdjacency(
        [[0, 1], [1, 0]], ["N0", "N1"],
        [{ source: 0, target: 1, type: "capacitor", label: "C1", value: null }],
      );
      const csv = exportAdjacencyCSV(adj, "types");
      expect(csv).toContain("N0,0,C");
    });

    it("shows 0 for empty cells", () => {
      const adj = makeAdjacency(
        [[0, 0], [0, 0]], ["N0", "N1"], [],
      );
      const csv = exportAdjacencyCSV(adj, "types");
      expect(csv).toContain("N0,0,0");
    });
  });

  describe("separate mode", () => {
    it("produces two matrix sections", () => {
      const adj = makeAdjacency(
        [[0, 2], [2, 0]], ["N0", "N1"],
        [
          { source: 0, target: 1, type: "capacitor", label: "C1", value: "100fF" },
          { source: 0, target: 1, type: "josephson_junction", label: "JJ1", value: "10nA" },
        ],
      );
      const csv = exportAdjacencyCSV(adj, "separate");
      expect(csv).toContain("# Capacitance Matrix");
      expect(csv).toContain("# Josephson Energy Matrix");
      expect(csv).toContain("100fF");
      expect(csv).toContain("10nA");
    });

    it("capacitance section excludes JJ values", () => {
      const adj = makeAdjacency(
        [[0, 2], [2, 0]], ["N0", "N1"],
        [
          { source: 0, target: 1, type: "capacitor", label: "C1", value: "100fF" },
          { source: 0, target: 1, type: "josephson_junction", label: "JJ1", value: "10nA" },
        ],
      );
      const csv = exportAdjacencyCSV(adj, "separate");
      const sections = csv.split("\n\n");
      expect(sections[0]).not.toContain("10nA");
      expect(sections[1]).not.toContain("100fF");
    });

    it("uses 1 as default value when component value is null", () => {
      const adj = makeAdjacency(
        [[0, 1], [1, 0]], ["N0", "N1"],
        [{ source: 0, target: 1, type: "capacitor", label: "C1", value: null }],
      );
      const csv = exportAdjacencyCSV(adj, "separate");
      expect(csv).toContain(",1\n");
    });
  });

  it("defaults to binary mode for unknown mode", () => {
    const adj = makeAdjacency([[0, 1], [1, 0]], ["N0", "N1"], []);
    const csv = exportAdjacencyCSV(adj, "unknown_mode");
    expect(csv).toContain("N0,0,1");
  });
});
