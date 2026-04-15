import csv
import io
import json

import cv2
import numpy as np
import pytest

from app.graph_builder import GraphBuilder


@pytest.fixture
def gb():
    return GraphBuilder()


# -- Fixtures for a known diamond graph: A(0)-B(1), A(0)-C(2), B(1)-D(3), C(2)-D(3) --

def _diamond_nodes():
    return [
        {"id": 0, "center": (50, 100), "radius": 15, "confidence": 0.9, "method": "hough"},
        {"id": 1, "center": (150, 50), "radius": 15, "confidence": 0.85, "method": "contour"},
        {"id": 2, "center": (150, 150), "radius": 15, "confidence": 0.8, "method": "contour"},
        {"id": 3, "center": (250, 100), "radius": 15, "confidence": 0.95, "method": "hough"},
    ]


def _diamond_edges():
    return [
        {"id": 0, "source": 0, "target": 1, "confidence": 0.9, "method": "hough"},
        {"id": 1, "source": 0, "target": 2, "confidence": 0.85, "method": "trace"},
        {"id": 2, "source": 1, "target": 3, "confidence": 0.88, "method": "hough"},
        {"id": 3, "source": 2, "target": 3, "confidence": 0.7, "method": "trace"},
    ]


# ---------------------------------------------------------------------------
# build_graph
# ---------------------------------------------------------------------------

class TestBuildGraph:
    def test_undirected(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges(), directed=False)
        assert not G.is_directed()
        assert G.number_of_nodes() == 4
        assert G.number_of_edges() == 4

    def test_directed(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges(), directed=True)
        assert G.is_directed()
        assert G.number_of_nodes() == 4
        assert G.number_of_edges() == 4

    def test_node_attributes(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        assert G.nodes[0]["center"] == (50, 100)
        assert G.nodes[0]["radius"] == 15
        assert G.nodes[0]["method"] == "hough"
        assert G.nodes[0]["confidence"] == 0.9

    def test_edge_attributes(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        data = G.edges[0, 1]
        assert data["confidence"] == 0.9
        assert data["method"] == "hough"
        assert data["component"] == "wire"
        assert data["value"] is None

    def test_skips_dangling_edges(self, gb):
        edges = _diamond_edges() + [
            {"id": 4, "source": 0, "target": -1, "confidence": 0.3, "method": "hough", "flags": "dangling"},
        ]
        G = gb.build_graph(_diamond_nodes(), edges)
        assert G.number_of_edges() == 4

    def test_empty_graph(self, gb):
        G = gb.build_graph([], [])
        assert G.number_of_nodes() == 0
        assert G.number_of_edges() == 0

    def test_flags_attribute(self, gb):
        nodes = [{"id": 0, "center": (0, 0), "confidence": 0.3, "method": "a", "flags": "uncertain"}]
        G = gb.build_graph(nodes, [])
        assert G.nodes[0]["flags"] == "uncertain"


# ---------------------------------------------------------------------------
# adjacency_matrix
# ---------------------------------------------------------------------------

class TestAdjacencyMatrix:
    def test_diamond_matrix(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        matrix, labels = gb.adjacency_matrix(G)
        expected = np.array([
            [0, 1, 1, 0],
            [1, 0, 0, 1],
            [1, 0, 0, 1],
            [0, 1, 1, 0],
        ])
        np.testing.assert_array_equal(matrix, expected)
        assert labels == ["0", "1", "2", "3"]

    def test_directed_diamond_matrix(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges(), directed=True)
        matrix, labels = gb.adjacency_matrix(G)
        # Directed: only entries where source->target
        assert matrix[0, 1] == 1  # 0->1
        assert matrix[1, 0] == 0  # no 1->0
        assert labels == ["0", "1", "2", "3"]

    def test_empty_graph(self, gb):
        G = gb.build_graph([], [])
        matrix, labels = gb.adjacency_matrix(G)
        assert matrix.shape == (0, 0)
        assert labels == []

    def test_single_node(self, gb):
        nodes = [{"id": 0, "center": (0, 0), "confidence": 1.0, "method": "a"}]
        G = gb.build_graph(nodes, [])
        matrix, labels = gb.adjacency_matrix(G)
        np.testing.assert_array_equal(matrix, np.array([[0]]))
        assert labels == ["0"]


# ---------------------------------------------------------------------------
# validate
# ---------------------------------------------------------------------------

class TestValidate:
    def test_valid_undirected(self, gb):
        matrix = np.array([[0, 1, 1, 0], [1, 0, 0, 1], [1, 0, 0, 1], [0, 1, 1, 0]])
        warnings = gb.validate(matrix, directed=False)
        assert warnings == []

    def test_non_square(self, gb):
        matrix = np.array([[0, 1], [1, 0], [0, 0]])
        warnings = gb.validate(matrix)
        assert any("not square" in w for w in warnings)

    def test_self_loops(self, gb):
        matrix = np.array([[1, 1], [1, 0]])
        warnings = gb.validate(matrix)
        assert any("Self-loops" in w for w in warnings)

    def test_asymmetric_undirected(self, gb):
        matrix = np.array([[0, 1], [0, 0]])
        warnings = gb.validate(matrix, directed=False)
        assert any("not symmetric" in w for w in warnings)

    def test_asymmetric_ok_for_directed(self, gb):
        matrix = np.array([[0, 1], [0, 0]])
        warnings = gb.validate(matrix, directed=True)
        assert not any("not symmetric" in w for w in warnings)

    def test_isolated_node(self, gb):
        matrix = np.array([[0, 1, 0], [1, 0, 0], [0, 0, 0]])
        warnings = gb.validate(matrix)
        assert any("Node 2 is isolated" in w for w in warnings)

    def test_no_isolated_in_complete(self, gb):
        matrix = np.array([[0, 1, 1], [1, 0, 1], [1, 1, 0]])
        warnings = gb.validate(matrix)
        assert not any("isolated" in w for w in warnings)


# ---------------------------------------------------------------------------
# to_json
# ---------------------------------------------------------------------------

class TestToJson:
    def test_all_required_fields(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, _diamond_edges(), directed=False, processing_time_ms=42.5)
        required = {
            "status", "node_count", "edge_count", "directed", "node_index",
            "adjacency_matrix", "edge_metadata", "uncertain", "annotated_image",
            "processing_time_ms",
        }
        assert required.issubset(result.keys())

    def test_values(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, _diamond_edges(), directed=False, processing_time_ms=100)
        assert result["node_count"] == 4
        assert result["edge_count"] == 4
        assert result["directed"] is False
        assert result["processing_time_ms"] == 100
        assert result["status"] == "success"

    def test_status_partial_with_uncertain(self, gb):
        edges = _diamond_edges() + [
            {"id": 4, "source": 0, "target": 3, "confidence": 0.2, "method": "trace"},
        ]
        G = gb.build_graph(_diamond_nodes(), edges)
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, edges, directed=False, processing_time_ms=50)
        assert result["status"] == "partial"
        assert len(result["uncertain"]) >= 1

    def test_node_index_mapping(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, _diamond_edges(), directed=False, processing_time_ms=0)
        assert result["node_index"] == {0: "0", 1: "1", 2: "2", 3: "3"}

    def test_adjacency_matrix_is_list_of_lists(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, _diamond_edges(), directed=False, processing_time_ms=0)
        assert isinstance(result["adjacency_matrix"], list)
        assert all(isinstance(row, list) for row in result["adjacency_matrix"])
        assert all(isinstance(v, int) for row in result["adjacency_matrix"] for v in row)

    def test_serializable(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, _diamond_edges(), directed=False, processing_time_ms=0)
        serialized = json.dumps(result)
        assert isinstance(serialized, str)

    def test_dangling_edges_excluded_from_metadata(self, gb):
        edges = _diamond_edges() + [
            {"id": 4, "source": 0, "target": -1, "confidence": 0.3, "method": "hough", "flags": "dangling"},
        ]
        G = gb.build_graph(_diamond_nodes(), edges)
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, edges, directed=False, processing_time_ms=0)
        assert result["edge_count"] == 4
        sources = [e["source"] for e in result["edge_metadata"]]
        targets = [e["target"] for e in result["edge_metadata"]]
        assert -1 not in targets


# ---------------------------------------------------------------------------
# to_csv
# ---------------------------------------------------------------------------

class TestToCsv:
    def test_roundtrip(self, gb):
        G = gb.build_graph(_diamond_nodes(), _diamond_edges())
        matrix, labels = gb.adjacency_matrix(G)
        csv_str = gb.to_csv(matrix, labels)

        reader = csv.reader(io.StringIO(csv_str))
        rows = list(reader)

        # header row
        assert rows[0] == ["", "0", "1", "2", "3"]
        # data rows
        assert rows[1][0] == "0"
        parsed = np.array([[int(v) for v in row[1:]] for row in rows[1:]])
        np.testing.assert_array_equal(parsed, matrix)

    def test_single_node(self, gb):
        nodes = [{"id": 0, "center": (0, 0), "confidence": 1.0, "method": "a"}]
        G = gb.build_graph(nodes, [])
        matrix, labels = gb.adjacency_matrix(G)
        csv_str = gb.to_csv(matrix, labels)
        reader = csv.reader(io.StringIO(csv_str))
        rows = list(reader)
        assert rows[0] == ["", "0"]
        assert rows[1] == ["0", "0"]

    def test_empty(self, gb):
        G = gb.build_graph([], [])
        matrix, labels = gb.adjacency_matrix(G)
        csv_str = gb.to_csv(matrix, labels)
        reader = csv.reader(io.StringIO(csv_str))
        rows = list(reader)
        assert rows[0] == [""]  # header with just the empty corner


# ---------------------------------------------------------------------------
# render_overlay
# ---------------------------------------------------------------------------

class TestRenderOverlay:
    def test_returns_same_dimensions(self, gb):
        img = np.full((300, 400, 3), 200, dtype=np.uint8)
        result = gb.render_overlay(img, _diamond_nodes(), _diamond_edges())
        assert result.shape == img.shape

    def test_does_not_modify_original(self, gb):
        img = np.full((300, 400, 3), 200, dtype=np.uint8)
        original = img.copy()
        gb.render_overlay(img, _diamond_nodes(), _diamond_edges())
        np.testing.assert_array_equal(img, original)

    def test_grayscale_input(self, gb):
        img = np.full((300, 400), 200, dtype=np.uint8)
        result = gb.render_overlay(img, _diamond_nodes(), _diamond_edges())
        assert result.ndim == 3
        assert result.shape == (300, 400, 3)

    def test_empty_graph(self, gb):
        img = np.full((100, 100, 3), 128, dtype=np.uint8)
        result = gb.render_overlay(img, [], [])
        assert result.shape == img.shape

    def test_uncertain_nodes_colored_differently(self, gb):
        img = np.full((200, 200, 3), 255, dtype=np.uint8)
        nodes = [
            {"id": 0, "center": (50, 50), "radius": 15, "confidence": 0.9, "method": "a"},
            {"id": 1, "center": (150, 150), "radius": 15, "confidence": 0.3, "method": "a"},
        ]
        result = gb.render_overlay(img, nodes, [])
        # Just verify it doesn't crash and produces an image
        assert result.dtype == np.uint8

    def test_skips_dangling_edges(self, gb):
        img = np.full((200, 200, 3), 255, dtype=np.uint8)
        nodes = [{"id": 0, "center": (50, 50), "radius": 10, "confidence": 0.9, "method": "a"}]
        edges = [{"id": 0, "source": 0, "target": -1, "confidence": 0.3, "method": "hough", "flags": "dangling"}]
        result = gb.render_overlay(img, nodes, edges)
        assert result.shape == img.shape
