import base64

import cv2
import numpy as np
import pytest

from app.pipeline import ExtractionPipeline


@pytest.fixture
def pipeline():
    return ExtractionPipeline()


def _make_circuit(width=500, height=400):
    """Three filled circles connected by thick lines on a white background (BGR)."""
    img = np.full((height, width, 3), 255, dtype=np.uint8)
    centers = [(100, 200), (250, 80), (400, 200)]
    for c in centers:
        cv2.circle(img, c, 25, (0, 0, 0), -1)
    cv2.line(img, (125, 190), (230, 90), (0, 0, 0), 4)
    cv2.line(img, (270, 90), (380, 190), (0, 0, 0), 4)
    cv2.line(img, (125, 210), (380, 210), (0, 0, 0), 4)
    return img, centers


def _default_options(**overrides):
    opts = {
        "directed": False,
        "include_ocr": True,
        "confidence_threshold": 0.5,
        "output_format": "json",
        "debug": False,
    }
    opts.update(overrides)
    return opts


class TestExtractionPipelineInit:
    def test_default_init(self):
        p = ExtractionPipeline()
        assert p.model is None
        assert p.model_path is None
        assert p.preprocessor is not None
        assert p.node_detector is not None
        assert p.edge_detector is not None
        assert p.graph_builder is not None

    def test_init_with_model_path(self):
        p = ExtractionPipeline(model_path="/fake/model.pt")
        assert p.model_path == "/fake/model.pt"
        assert p.model is None


class TestExtract:
    def test_returns_all_required_fields(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        required = {
            "status", "node_count", "edge_count", "directed",
            "node_index", "adjacency_matrix", "edge_metadata",
            "uncertain", "annotated_image", "processing_time_ms",
        }
        assert required.issubset(result.keys())

    def test_node_count_reasonable(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        assert result["node_count"] >= 1

    def test_adjacency_matrix_dimensions(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        n = result["node_count"]
        matrix = result["adjacency_matrix"]
        assert len(matrix) == n
        for row in matrix:
            assert len(row) == n

    def test_processing_time_positive(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        assert result["processing_time_ms"] > 0

    def test_annotated_image_is_base64_png(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        b64 = result["annotated_image"]
        assert isinstance(b64, str)
        decoded = base64.b64decode(b64)
        # PNG magic bytes
        assert decoded[:4] == b"\x89PNG"

    def test_directed_option(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options(directed=True))
        assert result["directed"] is True

    def test_undirected_option(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options(directed=False))
        assert result["directed"] is False

    def test_status_is_string(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        assert result["status"] in ("success", "partial")

    def test_edge_metadata_list(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        assert isinstance(result["edge_metadata"], list)
        assert result["edge_count"] == len(result["edge_metadata"])

    def test_node_index_is_dict(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        assert isinstance(result["node_index"], dict)
        assert len(result["node_index"]) == result["node_count"]

    def test_adjacency_matrix_values_are_ints(self, pipeline):
        img, _ = _make_circuit()
        result = pipeline.extract(img, _default_options())
        for row in result["adjacency_matrix"]:
            for v in row:
                assert isinstance(v, int)


class TestPreview:
    def test_returns_base64_png(self, pipeline):
        img, _ = _make_circuit()
        b64 = pipeline.preview(img)
        assert isinstance(b64, str)
        decoded = base64.b64decode(b64)
        assert decoded[:4] == b"\x89PNG"

    def test_decodable_to_image(self, pipeline):
        img, _ = _make_circuit()
        b64 = pipeline.preview(img)
        decoded = base64.b64decode(b64)
        arr = np.frombuffer(decoded, dtype=np.uint8)
        result_img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        assert result_img is not None
        assert result_img.ndim == 2


class TestEncodeImage:
    def test_roundtrip(self):
        img = np.full((50, 50, 3), 128, dtype=np.uint8)
        b64 = ExtractionPipeline._encode_image(img)
        decoded = base64.b64decode(b64)
        arr = np.frombuffer(decoded, dtype=np.uint8)
        result = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        assert result.shape == img.shape


class TestWithEmptyImage:
    def test_no_crash_on_blank(self, pipeline):
        img = np.full((200, 200, 3), 255, dtype=np.uint8)
        result = pipeline.extract(img, _default_options())
        assert "status" in result
        assert result["node_count"] >= 0
        assert result["adjacency_matrix"] is not None
