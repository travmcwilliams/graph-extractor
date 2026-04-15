import base64
import logging
import time
from typing import Optional

import cv2
import numpy as np

from app.component_detector import ComponentDetector
from app.graph_builder import GraphBuilder
from app.ocr import LabelExtractor
from app.preprocessor import Preprocessor
from app.wire_detector import EdgeDetector, NodeDetector

logger = logging.getLogger(__name__)


class ExtractionPipeline:

    def __init__(self, model_path: Optional[str] = None):
        self.preprocessor = Preprocessor()
        self.component_detector = ComponentDetector(model_path=model_path)
        self.node_detector = NodeDetector()
        self.edge_detector = EdgeDetector()
        self.graph_builder = GraphBuilder()
        self.label_extractor = LabelExtractor()
        self.model_path = model_path
        self.model = self.component_detector.model

    def extract(self, image: np.ndarray, options: dict) -> dict:
        t0 = time.perf_counter()

        # Stage 1: Preprocessing
        preprocess_result = self.preprocessor.process(image)
        binary = preprocess_result["binary"]
        skeleton = preprocess_result["skeleton"]
        corrected = preprocess_result["corrected"]

        # Stage 2: Component detection (YOLO)
        conf_threshold = options.get("confidence_threshold", 0.5)
        components = self.component_detector.detect(corrected, conf_threshold)

        # Stage 3: Node and edge detection
        cv_nodes = self.node_detector.detect(binary, skeleton)
        yolo_nodes = self.component_detector.detect_as_nodes(
            corrected, conf_threshold, start_id=len(cv_nodes)
        )
        nodes = self.node_detector.merge_detections([cv_nodes, yolo_nodes])
        edges = self.edge_detector.detect(skeleton, nodes)

        # Stage 3.5: OCR label extraction (optional)
        if options.get("include_ocr", True) and self.label_extractor.reader is not None:
            components, nodes = self.label_extractor.extract_and_associate(
                corrected, components, nodes
            )

        # Stage 4: Graph construction
        directed = options.get("directed", False)
        graph = self.graph_builder.build_graph(nodes, edges, directed=directed)
        matrix, labels = self.graph_builder.adjacency_matrix(graph)
        warnings = self.graph_builder.validate(matrix, directed=directed)
        if warnings:
            for w in warnings:
                logger.warning("Graph validation: %s", w)

        # Render overlay
        overlay = self.graph_builder.render_overlay(corrected, nodes, edges)
        annotated_b64 = self._encode_image(overlay)

        elapsed_ms = (time.perf_counter() - t0) * 1000

        result = self.graph_builder.to_json(
            matrix,
            labels,
            edges,
            directed=directed,
            processing_time_ms=elapsed_ms,
            confidence_threshold=options.get("confidence_threshold", 0.5),
        )
        result["annotated_image"] = annotated_b64
        return result

    def preview(self, image: np.ndarray) -> str:
        preprocess_result = self.preprocessor.process(image)
        binary = preprocess_result["binary"]
        return self._encode_image(binary)

    @staticmethod
    def _encode_image(image: np.ndarray) -> str:
        _, buf = cv2.imencode(".png", image)
        return base64.b64encode(buf).decode("utf-8")
