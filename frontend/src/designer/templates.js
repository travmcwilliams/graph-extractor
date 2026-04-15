/**
 * Pre-built circuit templates for common quantum circuit topologies.
 * Each template is a JSON object matching the useCircuitGraph state format.
 */

export const TEMPLATES = [
  {
    name: "Single Transmon",
    description: "1 JJ || 1 capacitor, grounded",
    data: {
      circuitName: "Single Transmon",
      components: [
        { id: 1, type: "capacitor", label: "C1", x: 200, y: 160, rotation: 0, capacitance: "65 fF" },
        { id: 2, type: "josephson_junction", label: "JJ1", x: 200, y: 260, rotation: 0, ic: "30 nA" },
        { id: 3, type: "ground", label: "GND", x: 320, y: 260, rotation: 0 },
      ],
      wires: [
        { id: 10, sourceComp: 1, sourceSide: "left", targetComp: 2, targetSide: "left" },
        { id: 11, sourceComp: 1, sourceSide: "right", targetComp: 2, targetSide: "right" },
        { id: 12, sourceComp: 2, sourceSide: "right", targetComp: 3, targetSide: "top" },
      ],
    },
  },
  {
    name: "Coupled Transmons",
    description: "2 transmons connected by coupling capacitor",
    data: {
      circuitName: "Coupled Transmons",
      components: [
        { id: 1, type: "capacitor", label: "C1", x: 120, y: 140, rotation: 90, capacitance: "65 fF" },
        { id: 2, type: "josephson_junction", label: "JJ1", x: 220, y: 140, rotation: 90, ic: "30 nA" },
        { id: 3, type: "capacitor", label: "Cc", x: 280, y: 80, rotation: 0, capacitance: "5 fF" },
        { id: 4, type: "capacitor", label: "C2", x: 380, y: 140, rotation: 90, capacitance: "65 fF" },
        { id: 5, type: "josephson_junction", label: "JJ2", x: 480, y: 140, rotation: 90, ic: "28 nA" },
        { id: 6, type: "ground", label: "GND", x: 300, y: 260, rotation: 0 },
      ],
      wires: [
        { id: 10, sourceComp: 1, sourceSide: "left", targetComp: 2, targetSide: "left" },
        { id: 11, sourceComp: 1, sourceSide: "right", targetComp: 2, targetSide: "right" },
        { id: 12, sourceComp: 1, sourceSide: "left", targetComp: 3, targetSide: "left" },
        { id: 13, sourceComp: 3, sourceSide: "right", targetComp: 4, targetSide: "left" },
        { id: 14, sourceComp: 4, sourceSide: "left", targetComp: 5, targetSide: "left" },
        { id: 15, sourceComp: 4, sourceSide: "right", targetComp: 5, targetSide: "right" },
        { id: 16, sourceComp: 2, sourceSide: "right", targetComp: 6, targetSide: "top" },
        { id: 17, sourceComp: 5, sourceSide: "right", targetComp: 6, targetSide: "top" },
      ],
    },
  },
  {
    name: "SQUID",
    description: "2 JJs in a loop with shunt capacitor",
    data: {
      circuitName: "SQUID Loop",
      components: [
        { id: 1, type: "josephson_junction", label: "JJ1", x: 200, y: 140, rotation: 0, ic: "20 nA" },
        { id: 2, type: "josephson_junction", label: "JJ2", x: 200, y: 260, rotation: 0, ic: "20 nA" },
        { id: 3, type: "capacitor", label: "Cs", x: 340, y: 200, rotation: 90, capacitance: "50 fF" },
        { id: 4, type: "ground", label: "GND", x: 420, y: 300, rotation: 0 },
      ],
      wires: [
        { id: 10, sourceComp: 1, sourceSide: "left", targetComp: 2, targetSide: "left" },
        { id: 11, sourceComp: 1, sourceSide: "right", targetComp: 2, targetSide: "right" },
        { id: 12, sourceComp: 1, sourceSide: "right", targetComp: 3, targetSide: "left" },
        { id: 13, sourceComp: 2, sourceSide: "right", targetComp: 3, targetSide: "right" },
        { id: 14, sourceComp: 3, sourceSide: "right", targetComp: 4, targetSide: "top" },
      ],
    },
  },
];
