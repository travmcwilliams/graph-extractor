import cv2
import numpy as np
import pytest
from skimage.morphology import skeletonize as _skeletonize

from app.wire_detector import EdgeDetector, NodeDetector


@pytest.fixture
def node_det():
    return NodeDetector()


@pytest.fixture
def edge_det():
    return EdgeDetector()


# ---------------------------------------------------------------------------
# Helpers to build synthetic test images
# ---------------------------------------------------------------------------

def _make_binary(h=400, w=400):
    return np.zeros((h, w), dtype=np.uint8)


def _skeleton_of(binary: np.ndarray) -> np.ndarray:
    return (_skeletonize(binary.astype(bool)).astype(np.uint8)) * 255


def _draw_circles_with_lines():
    """Two circles connected by a straight horizontal line."""
    img = _make_binary()
    cv2.circle(img, (80, 200), 25, 255, 2)
    cv2.circle(img, (320, 200), 25, 255, 2)
    cv2.line(img, (105, 200), (295, 200), 255, 2)
    return img


def _draw_circles_with_angled_line():
    """Two circles connected by an angled / curved path."""
    img = _make_binary()
    cv2.circle(img, (80, 80), 25, 255, 2)
    cv2.circle(img, (320, 320), 25, 255, 2)
    # Draw a polyline to simulate a curved path
    pts = np.array([[105, 80], [180, 120], [240, 260], [300, 320]], dtype=np.int32)
    cv2.polylines(img, [pts], isClosed=False, color=255, thickness=2)
    return img


def _draw_t_intersection():
    """Skeleton-ready T-intersection."""
    img = _make_binary(200, 200)
    cv2.line(img, (20, 100), (180, 100), 255, 2)
    cv2.line(img, (100, 100), (100, 180), 255, 2)
    return img


def _draw_cross_intersection():
    """Skeleton-ready cross (+) intersection."""
    img = _make_binary(200, 200)
    cv2.line(img, (20, 100), (180, 100), 255, 2)
    cv2.line(img, (100, 20), (100, 180), 255, 2)
    return img


def _draw_three_node_graph():
    """Triangle: three filled circles at vertices, lines between them."""
    img = _make_binary(400, 400)
    centers = [(100, 100), (300, 100), (200, 300)]
    for c in centers:
        cv2.circle(img, c, 20, 255, -1)  # filled
    cv2.line(img, (120, 100), (280, 100), 255, 2)
    cv2.line(img, (100, 120), (190, 280), 255, 2)
    cv2.line(img, (300, 120), (210, 280), 255, 2)
    return img, centers


# ---------------------------------------------------------------------------
# NodeDetector tests
# ---------------------------------------------------------------------------

class TestDetectCircles:
    def test_finds_circles(self, node_det):
        img = _draw_circles_with_lines()
        nodes = node_det.detect_circles(img, min_radius=15, max_radius=40)
        assert len(nodes) >= 1  # Hough is non-deterministic; at least 1
        for n in nodes:
            assert "center" in n
            assert "radius" in n
            assert n["method"] == "hough"

    def test_empty_image(self, node_det):
        img = _make_binary()
        nodes = node_det.detect_circles(img)
        assert nodes == []

    def test_returns_list_of_dicts(self, node_det):
        img = _draw_circles_with_lines()
        nodes = node_det.detect_circles(img)
        assert isinstance(nodes, list)
        for n in nodes:
            assert isinstance(n, dict)
            assert isinstance(n["id"], int)
            assert isinstance(n["confidence"], float)


class TestDetectContourNodes:
    def test_finds_filled_circles(self, node_det):
        img = _make_binary()
        cv2.circle(img, (100, 100), 25, 255, -1)
        cv2.circle(img, (300, 100), 25, 255, -1)
        nodes = node_det.detect_contour_nodes(img)
        assert len(nodes) >= 2
        for n in nodes:
            assert n["method"] == "contour"

    def test_empty_image(self, node_det):
        img = _make_binary()
        nodes = node_det.detect_contour_nodes(img)
        assert nodes == []

    def test_filters_by_circularity(self, node_det):
        img = _make_binary()
        # Long thin rectangle — low circularity
        cv2.rectangle(img, (10, 10), (200, 15), 255, -1)
        # Circle — high circularity
        cv2.circle(img, (300, 300), 30, 255, -1)
        nodes = node_det.detect_contour_nodes(img, circularity_threshold=0.7)
        centers_x = [n["center"][0] for n in nodes]
        # The circle should be detected; the rectangle should not (as a high-confidence node)
        assert any(250 < x < 350 for x in centers_x)


class TestDetectJunctions:
    def test_t_intersection(self, node_det):
        binary = _draw_t_intersection()
        skel = _skeleton_of(binary)
        junctions = node_det.detect_junctions(skel)
        assert len(junctions) >= 1
        # Junction should be near (100, 100)
        for j in junctions:
            assert j["method"] == "junction"

    def test_cross_intersection(self, node_det):
        binary = _draw_cross_intersection()
        skel = _skeleton_of(binary)
        junctions = node_det.detect_junctions(skel)
        assert len(junctions) >= 1

    def test_no_junctions_on_straight_line(self, node_det):
        img = _make_binary(100, 300)
        cv2.line(img, (10, 50), (290, 50), 255, 2)
        skel = _skeleton_of(img)
        junctions = node_det.detect_junctions(skel)
        assert len(junctions) == 0

    def test_empty_image(self, node_det):
        img = _make_binary(100, 100)
        junctions = node_det.detect_junctions(img)
        assert junctions == []


class TestMergeDetections:
    def test_deduplicates_nearby_nodes(self, node_det):
        d1 = [{"id": 0, "center": (100, 100), "radius": 20, "confidence": 0.9, "method": "hough"}]
        d2 = [{"id": 0, "center": (105, 102), "radius": 18, "confidence": 0.7, "method": "contour"}]
        merged = node_det.merge_detections([d1, d2], merge_distance=25)
        assert len(merged) == 1
        assert merged[0]["confidence"] == 0.9  # kept higher confidence

    def test_keeps_distant_nodes(self, node_det):
        d1 = [{"id": 0, "center": (100, 100), "radius": 20, "confidence": 0.9, "method": "hough"}]
        d2 = [{"id": 0, "center": (300, 300), "radius": 20, "confidence": 0.8, "method": "contour"}]
        merged = node_det.merge_detections([d1, d2])
        assert len(merged) == 2

    def test_sequential_ids(self, node_det):
        d1 = [
            {"id": 5, "center": (100, 100), "radius": 20, "confidence": 0.9, "method": "a"},
            {"id": 9, "center": (300, 300), "radius": 20, "confidence": 0.8, "method": "b"},
        ]
        merged = node_det.merge_detections([d1])
        ids = [n["id"] for n in merged]
        assert ids == [0, 1]

    def test_uncertain_flag(self, node_det):
        d1 = [{"id": 0, "center": (100, 100), "radius": 20, "confidence": 0.3, "method": "a"}]
        merged = node_det.merge_detections([d1])
        assert merged[0].get("flags") == "uncertain"

    def test_empty_input(self, node_det):
        merged = node_det.merge_detections([[], []])
        assert merged == []


class TestNodeDetectorIntegration:
    def test_detect_runs_full_pipeline(self, node_det):
        binary = _draw_circles_with_lines()
        skel = _skeleton_of(binary)
        nodes = node_det.detect(binary, skel)
        assert isinstance(nodes, list)
        # Should find at least 1 node
        assert len(nodes) >= 1


# ---------------------------------------------------------------------------
# EdgeDetector tests
# ---------------------------------------------------------------------------

class TestDetectLines:
    def test_finds_straight_line(self, edge_det):
        img = _make_binary()
        cv2.line(img, (50, 200), (350, 200), 255, 2)
        skel = _skeleton_of(img)
        lines = edge_det.detect_lines(skel)
        assert len(lines) >= 1
        for l in lines:
            assert len(l) == 2
            assert len(l[0]) == 2

    def test_empty_image(self, edge_det):
        img = _make_binary()
        lines = edge_det.detect_lines(img)
        assert lines == []


class TestAssociateEdges:
    def test_associates_both_endpoints(self, edge_det):
        nodes = [
            {"id": 0, "center": (50, 200), "radius": 20, "confidence": 0.9, "method": "test"},
            {"id": 1, "center": (350, 200), "radius": 20, "confidence": 0.9, "method": "test"},
        ]
        lines = [((60, 200), (340, 200))]
        edges = edge_det.associate_edges(lines, nodes, proximity_threshold=30)
        connected = [e for e in edges if e.get("flags") != "dangling"]
        assert len(connected) >= 1
        assert connected[0]["source"] != connected[0]["target"]

    def test_dangling_edge(self, edge_det):
        nodes = [
            {"id": 0, "center": (50, 200), "radius": 20, "confidence": 0.9, "method": "test"},
        ]
        lines = [((60, 200), (340, 200))]
        edges = edge_det.associate_edges(lines, nodes, proximity_threshold=30)
        dangling = [e for e in edges if e.get("flags") == "dangling"]
        assert len(dangling) >= 1

    def test_no_match_discarded(self, edge_det):
        nodes = [
            {"id": 0, "center": (50, 50), "radius": 10, "confidence": 0.9, "method": "test"},
        ]
        lines = [((300, 300), (350, 350))]
        edges = edge_det.associate_edges(lines, nodes, proximity_threshold=20)
        assert len(edges) == 0


class TestTracePaths:
    def test_traces_straight_connection(self, edge_det):
        img = _make_binary()
        cv2.circle(img, (80, 200), 20, 255, -1)
        cv2.circle(img, (320, 200), 20, 255, -1)
        cv2.line(img, (100, 200), (300, 200), 255, 2)
        skel = _skeleton_of(img)
        nodes = [
            {"id": 0, "center": (80, 200), "radius": 20, "confidence": 0.9, "method": "test"},
            {"id": 1, "center": (320, 200), "radius": 20, "confidence": 0.9, "method": "test"},
        ]
        edges = edge_det.trace_paths(skel, nodes)
        assert len(edges) >= 1
        pairs = {(e["source"], e["target"]) for e in edges}
        assert (0, 1) in pairs

    def test_traces_angled_connection(self, edge_det):
        img = _draw_circles_with_angled_line()
        skel = _skeleton_of(img)
        nodes = [
            {"id": 0, "center": (80, 80), "radius": 25, "confidence": 0.9, "method": "test"},
            {"id": 1, "center": (320, 320), "radius": 25, "confidence": 0.9, "method": "test"},
        ]
        edges = edge_det.trace_paths(skel, nodes)
        assert len(edges) >= 1
        for e in edges:
            assert e["method"] == "trace"

    def test_no_nodes_returns_empty(self, edge_det):
        img = _make_binary()
        cv2.line(img, (50, 50), (350, 350), 255, 2)
        skel = _skeleton_of(img)
        edges = edge_det.trace_paths(skel, [])
        assert edges == []

    def test_max_path_length_respected(self, edge_det):
        """With max_path_length=1, trace should not reach a distant node."""
        img = _make_binary()
        cv2.circle(img, (80, 200), 15, 255, -1)
        cv2.circle(img, (320, 200), 15, 255, -1)
        cv2.line(img, (95, 200), (305, 200), 255, 2)
        skel = _skeleton_of(img)
        nodes = [
            {"id": 0, "center": (80, 200), "radius": 15, "confidence": 0.9, "method": "test"},
            {"id": 1, "center": (320, 200), "radius": 15, "confidence": 0.9, "method": "test"},
        ]
        edges = edge_det.trace_paths(skel, nodes, max_path_length=1)
        assert len(edges) == 0


class TestMergeEdges:
    def test_deduplicates_same_pair(self, edge_det):
        e1 = [{"id": 0, "source": 0, "target": 1, "confidence": 0.8, "method": "hough"}]
        e2 = [{"id": 0, "source": 1, "target": 0, "confidence": 0.9, "method": "trace"}]
        merged = edge_det.merge_edges([e1, e2])
        valid = [e for e in merged if e.get("flags") != "dangling"]
        assert len(valid) == 1
        assert valid[0]["confidence"] == 0.9

    def test_keeps_different_pairs(self, edge_det):
        e1 = [{"id": 0, "source": 0, "target": 1, "confidence": 0.8, "method": "hough"}]
        e2 = [{"id": 0, "source": 1, "target": 2, "confidence": 0.9, "method": "trace"}]
        merged = edge_det.merge_edges([e1, e2])
        assert len(merged) == 2

    def test_sequential_ids(self, edge_det):
        e1 = [
            {"id": 7, "source": 0, "target": 1, "confidence": 0.8, "method": "a"},
            {"id": 9, "source": 2, "target": 3, "confidence": 0.7, "method": "b"},
        ]
        merged = edge_det.merge_edges([e1])
        ids = [e["id"] for e in merged]
        assert ids == [0, 1]

    def test_empty_input(self, edge_det):
        merged = edge_det.merge_edges([[], []])
        assert merged == []


class TestEdgeDetectorIntegration:
    def test_detect_runs_full_pipeline(self, edge_det):
        binary = _draw_circles_with_lines()
        skel = _skeleton_of(binary)
        nodes = [
            {"id": 0, "center": (80, 200), "radius": 25, "confidence": 0.9, "method": "test"},
            {"id": 1, "center": (320, 200), "radius": 25, "confidence": 0.9, "method": "test"},
        ]
        edges = edge_det.detect(skel, nodes)
        assert isinstance(edges, list)

    def test_detect_empty_image(self, edge_det):
        img = _make_binary()
        edges = edge_det.detect(img, [])
        assert edges == []


class TestEndToEnd:
    def test_three_node_triangle(self, node_det, edge_det):
        binary, centers = _draw_three_node_graph()
        skel = _skeleton_of(binary)
        nodes = node_det.detect(binary, skel)
        assert len(nodes) >= 2  # should find at least 2 of the 3

        edges = edge_det.detect(skel, nodes)
        assert isinstance(edges, list)
        # No duplicate source-target pairs
        pairs = [(e["source"], e["target"]) for e in edges if e.get("flags") != "dangling"]
        normalized = [(min(s, t), max(s, t)) for s, t in pairs]
        assert len(normalized) == len(set(normalized))
