# Quantum Circuit Designer

A browser-based circuit designer for superconducting quantum circuits. Draw circuits with capacitors and Josephson junctions, connect them with wires, and export the adjacency matrix as CSV for quantum computing simulators.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. No backend needed — the designer runs entirely in the browser.

### Docker

```bash
docker compose up --build
```

Builds the React app and serves it via nginx on http://localhost:3000.

## Usage

- **Place components**: Drag from the left palette, or press **C** (capacitor) / **J** (Josephson junction)
- **Connect**: Switch to Wire tool (**W**), click a terminal, click another terminal
- **Move**: Drag components on the canvas (snaps to grid)
- **Rotate**: Select a component, press **R**
- **Delete**: Select and press **Delete** / **Backspace**
- **Pan/Zoom**: Drag empty canvas to pan, scroll to zoom
- **Undo/Redo**: **Ctrl+Z** / **Ctrl+Shift+Z**
- **Save**: **Ctrl+S** downloads JSON, or auto-saves to localStorage
- **Export**: **Ctrl+E** exports adjacency matrix as CSV

### CSV Export Modes

| Mode | Description |
|------|-------------|
| Binary (0/1) | Simple connectivity matrix |
| Component Types | Cells show C, JJ, or C+JJ |
| Separate Matrices | Two sections: capacitance matrix + Josephson energy matrix with values |

### Validation

The designer warns you about:
- **Floating components** — not connected to any wire (yellow dashed border)
- **Disconnected subgraphs** — circuit has separate sections
- **Missing values** — components without capacitance/Ic values

## Project Structure

```
graph-extractor/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── designer/
│   │       ├── DesignerApp.jsx       # Main layout, keyboard shortcuts
│   │       ├── Canvas.jsx            # Konva canvas with pan/zoom/grid
│   │       ├── ComponentPalette.jsx  # Left sidebar — drag components
│   │       ├── PropertiesPanel.jsx   # Right sidebar — properties, export
│   │       ├── Toolbar.jsx           # Top toolbar — tools, undo, counts
│   │       ├── MatrixPreview.jsx     # Live adjacency matrix table
│   │       ├── useCircuitGraph.js    # Core hook — state, undo, graph math
│   │       ├── circuitState.js       # Grid snap, terminal math, helpers
│   │       ├── exportCSV.js          # CSV export (3 modes)
│   │       ├── exportJSON.js         # JSON save/load
│   │       ├── symbols/
│   │       │   ├── Capacitor.jsx     # Konva capacitor symbol
│   │       │   ├── JosephsonJunction.jsx
│   │       │   ├── Terminal.jsx      # Connection point circles
│   │       │   └── Wire.jsx          # Wire with Manhattan routing
│   │       └── __tests__/
│   │           ├── useCircuitGraph.test.js
│   │           └── exportCSV.test.js
│   └── package.json
├── backend/                          # CV/ML pipeline (optional)
├── training/                         # YOLO training scripts
├── docker-compose.yml
├── Dockerfile.frontend
├── Dockerfile.backend
└── nginx.conf
```

## Graph Engine

The circuit graph uses **union-find** to compute electrical nodes:
- Each component has two terminals (left, right)
- Wires merge terminals into the same electrical node
- The adjacency matrix has one row/column per unique node
- Each component connecting two distinct nodes creates a matrix entry

## Tests

```bash
cd frontend && npm test        # 20+ vitest tests (graph, export)
cd backend && pytest tests/    # 142 pytest tests (CV pipeline)
```

## Backend (Optional)

The backend provides a CV/ML pipeline that converts photos of hand-drawn circuits to adjacency matrices. It's not needed for the circuit designer but can be started with:

```bash
docker compose --profile backend up
```

Or manually:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
