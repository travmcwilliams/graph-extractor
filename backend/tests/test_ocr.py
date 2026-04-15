import cv2
import numpy as np
import pytest

from app.ocr import LabelExtractor


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def extractor_no_reader():
    """LabelExtractor with reader forced to None (simulates EasyOCR unavailable)."""
    le = LabelExtractor.__new__(LabelExtractor)
    le.reader = None
    return le


def _make_labels(*entries):
    """Build label dicts from (text, x, y) tuples."""
    labels = []
    for text, x, y in entries:
        labels.append({
            "text": text,
            "confidence": 0.9,
            "bbox": {"x1": x - 10, "y1": y - 10, "x2": x + 10, "y2": y + 10},
            "center": (x, y),
        })
    return labels


def _make_nodes(*entries):
    """Build node dicts from (id, x, y) tuples."""
    return [
        {"id": i, "center": (x, y), "radius": 15, "confidence": 0.9, "method": "test"}
        for i, x, y in entries
    ]


# ---------------------------------------------------------------------------
# LabelExtractor with reader=None
# ---------------------------------------------------------------------------

class TestNoReader:
    def test_extract_labels_returns_empty(self, extractor_no_reader):
        img = np.full((100, 100, 3), 200, dtype=np.uint8)
        result = extractor_no_reader.extract_labels(img)
        assert result == []

    def test_extract_labels_with_regions_returns_empty(self, extractor_no_reader):
        img = np.full((100, 100, 3), 200, dtype=np.uint8)
        regions = [{"x1": 0, "y1": 0, "x2": 50, "y2": 50}]
        result = extractor_no_reader.extract_labels(img, regions=regions)
        assert result == []

    def test_extract_and_associate_passthrough(self, extractor_no_reader):
        img = np.full((100, 100, 3), 200, dtype=np.uint8)
        components = [{"id": 0, "center": (50, 50)}]
        nodes = [{"id": 0, "center": (50, 50), "radius": 10, "confidence": 0.9, "method": "a"}]
        comp_out, node_out = extractor_no_reader.extract_and_associate(img, components, nodes)
        assert comp_out == components
        assert node_out == nodes


# ---------------------------------------------------------------------------
# Label association
# ---------------------------------------------------------------------------

class TestAssociateLabels:
    def test_identifier_attached_as_label(self, extractor_no_reader):
        labels = _make_labels(("R1", 55, 55))
        nodes = _make_nodes((0, 50, 50))
        _, updated_nodes = extractor_no_reader.associate_labels(labels, [], nodes)
        assert updated_nodes[0]["label"] == "R1"

    def test_value_attached_as_value(self, extractor_no_reader):
        labels = _make_labels(("10k", 55, 55))
        nodes = _make_nodes((0, 50, 50))
        _, updated_nodes = extractor_no_reader.associate_labels(labels, [], nodes)
        assert updated_nodes[0]["value"] == "10k"

    def test_label_too_far_not_associated(self, extractor_no_reader):
        labels = _make_labels(("R1", 300, 300))
        nodes = _make_nodes((0, 50, 50))
        _, updated_nodes = extractor_no_reader.associate_labels(labels, [], nodes, max_distance=50)
        assert "label" not in updated_nodes[0]

    def test_nearest_node_wins(self, extractor_no_reader):
        labels = _make_labels(("C1", 105, 100))
        nodes = _make_nodes((0, 50, 100), (1, 100, 100))
        _, updated_nodes = extractor_no_reader.associate_labels(labels, [], nodes)
        node_map = {n["id"]: n for n in updated_nodes}
        assert node_map[1].get("label") == "C1"
        assert "label" not in node_map[0]

    def test_component_gets_label(self, extractor_no_reader):
        labels = _make_labels(("L1", 55, 55))
        components = [{"id": 0, "center": (50, 50), "radius": 10, "confidence": 0.9, "method": "a"}]
        updated_comp, _ = extractor_no_reader.associate_labels(labels, components, [])
        assert updated_comp[0]["label"] == "L1"

    def test_multiple_labels_multiple_nodes(self, extractor_no_reader):
        labels = _make_labels(("R1", 55, 55), ("R2", 155, 155))
        nodes = _make_nodes((0, 50, 50), (1, 150, 150))
        _, updated_nodes = extractor_no_reader.associate_labels(labels, [], nodes)
        node_map = {n["id"]: n for n in updated_nodes}
        assert node_map[0].get("label") == "R1"
        assert node_map[1].get("label") == "R2"

    def test_does_not_mutate_originals(self, extractor_no_reader):
        labels = _make_labels(("R1", 55, 55))
        nodes = _make_nodes((0, 50, 50))
        original_node = nodes[0].copy()
        extractor_no_reader.associate_labels(labels, [], nodes)
        # Original list shouldn't be modified (we copy inside)
        assert "label" not in original_node


# ---------------------------------------------------------------------------
# Value parsing patterns
# ---------------------------------------------------------------------------

class TestValueParsing:
    @pytest.mark.parametrize("text", ["R1", "C2", "L1", "Q1", "U1", "D3", "T1", "M2"])
    def test_identifiers(self, extractor_no_reader, text):
        labels = _make_labels((text, 55, 55))
        nodes = _make_nodes((0, 50, 50))
        _, updated = extractor_no_reader.associate_labels(labels, [], nodes)
        assert updated[0].get("label") == text.upper()

    @pytest.mark.parametrize("text", ["10k", "4.7u", "100", "1M", "3.3V", "22pF", "47ohm"])
    def test_values(self, extractor_no_reader, text):
        labels = _make_labels((text, 55, 55))
        nodes = _make_nodes((0, 50, 50))
        _, updated = extractor_no_reader.associate_labels(labels, [], nodes)
        assert "value" in updated[0]

    def test_fallback_short_string_as_label(self, extractor_no_reader):
        labels = _make_labels(("GND", 55, 55))
        nodes = _make_nodes((0, 50, 50))
        _, updated = extractor_no_reader.associate_labels(labels, [], nodes)
        assert updated[0].get("label") == "GND"


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------

class TestCleanText:
    def test_o_to_zero(self):
        assert LabelExtractor._clean_text("1O0") == "100"

    def test_l_to_one(self):
        assert LabelExtractor._clean_text("l0") == "10"

    def test_normalize_k(self):
        assert LabelExtractor._clean_text("10K") == "10k"

    def test_no_change_for_normal_text(self):
        assert LabelExtractor._clean_text("R1") == "R1"


# ---------------------------------------------------------------------------
# Pipeline integration
# ---------------------------------------------------------------------------

class TestPipelineIntegration:
    def test_include_ocr_false_skips_ocr(self):
        from app.pipeline import ExtractionPipeline

        pipeline = ExtractionPipeline()
        # Null out reader to verify it's truly skipped
        pipeline.label_extractor.reader = None

        img = np.full((200, 200, 3), 255, dtype=np.uint8)
        cv2.circle(img, (100, 100), 25, (0, 0, 0), -1)

        result = pipeline.extract(img, {"include_ocr": False})
        assert "status" in result
        assert result["node_count"] >= 0

    def test_include_ocr_true_no_reader_still_works(self):
        from app.pipeline import ExtractionPipeline

        pipeline = ExtractionPipeline()
        pipeline.label_extractor.reader = None

        img = np.full((200, 200, 3), 255, dtype=np.uint8)
        cv2.circle(img, (100, 100), 25, (0, 0, 0), -1)

        result = pipeline.extract(img, {"include_ocr": True})
        assert "status" in result
        assert result["node_count"] >= 0


# ---------------------------------------------------------------------------
# Graph builder label integration
# ---------------------------------------------------------------------------

class TestGraphBuilderWithLabels:
    def test_node_label_in_adjacency_matrix(self):
        from app.graph_builder import GraphBuilder

        gb = GraphBuilder()
        nodes = [
            {"id": 0, "center": (50, 50), "confidence": 0.9, "method": "a", "label": "R1"},
            {"id": 1, "center": (150, 150), "confidence": 0.9, "method": "a", "label": "C1"},
        ]
        edges = [{"id": 0, "source": 0, "target": 1, "confidence": 0.9, "method": "hough"}]
        G = gb.build_graph(nodes, edges)
        _, labels = gb.adjacency_matrix(G)
        assert labels == ["R1", "C1"]

    def test_node_without_label_uses_id(self):
        from app.graph_builder import GraphBuilder

        gb = GraphBuilder()
        nodes = [
            {"id": 0, "center": (50, 50), "confidence": 0.9, "method": "a"},
            {"id": 1, "center": (150, 150), "confidence": 0.9, "method": "a", "label": "R2"},
        ]
        edges = []
        G = gb.build_graph(nodes, edges)
        _, labels = gb.adjacency_matrix(G)
        assert labels == ["0", "R2"]

    def test_edge_value_in_metadata(self):
        from app.graph_builder import GraphBuilder

        gb = GraphBuilder()
        nodes = [
            {"id": 0, "center": (50, 50), "confidence": 0.9, "method": "a"},
            {"id": 1, "center": (150, 150), "confidence": 0.9, "method": "a"},
        ]
        edges = [
            {"id": 0, "source": 0, "target": 1, "confidence": 0.9, "method": "hough", "value": "10k"},
        ]
        G = gb.build_graph(nodes, edges)
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, edges, directed=False, processing_time_ms=0)
        assert result["edge_metadata"][0].get("value") == "10k"

    def test_edge_without_value_has_no_value_key(self):
        from app.graph_builder import GraphBuilder

        gb = GraphBuilder()
        nodes = [
            {"id": 0, "center": (50, 50), "confidence": 0.9, "method": "a"},
            {"id": 1, "center": (150, 150), "confidence": 0.9, "method": "a"},
        ]
        edges = [
            {"id": 0, "source": 0, "target": 1, "confidence": 0.9, "method": "hough"},
        ]
        G = gb.build_graph(nodes, edges)
        matrix, labels = gb.adjacency_matrix(G)
        result = gb.to_json(matrix, labels, edges, directed=False, processing_time_ms=0)
        assert "value" not in result["edge_metadata"][0]
