import csv
import io
from typing import Dict, List, Tuple

import cv2
import networkx as nx
import numpy as np


class GraphBuilder:

    def build_graph(
        self, nodes: List[Dict], edges: List[Dict], directed: bool = False
    ) -> nx.Graph:
        G = nx.DiGraph() if directed else nx.Graph()
        for node in nodes:
            attrs = {}
            for key in ("center", "radius", "method", "confidence", "flags", "label", "value"):
                if key in node:
                    attrs[key] = node[key]
            G.add_node(node["id"], **attrs)
        for edge in edges:
            if edge.get("flags") == "dangling":
                continue
            attrs = {
                "confidence": edge.get("confidence", 1.0),
                "method": edge.get("method", "unknown"),
                "component": edge.get("component", "wire"),
                "value": edge.get("value"),
            }
            G.add_edge(edge["source"], edge["target"], **attrs)
        return G

    def adjacency_matrix(
        self, graph: nx.Graph
    ) -> Tuple[np.ndarray, List[str]]:
        node_order = list(graph.nodes())
        labels = []
        for n in node_order:
            node_label = graph.nodes[n].get("label")
            labels.append(node_label if node_label else str(n))
        matrix = nx.to_numpy_array(graph, nodelist=node_order, dtype=int)
        return matrix, labels

    def validate(
        self, matrix: np.ndarray, directed: bool = False
    ) -> List[str]:
        warnings = []
        if matrix.ndim != 2 or matrix.shape[0] != matrix.shape[1]:
            warnings.append("Matrix is not square")
            return warnings
        n = matrix.shape[0]
        if np.any(np.diag(matrix) != 0):
            warnings.append("Self-loops detected on diagonal")
        if not directed and not np.array_equal(matrix, matrix.T):
            warnings.append("Undirected matrix is not symmetric")
        for i in range(n):
            if np.all(matrix[i, :] == 0) and np.all(matrix[:, i] == 0):
                warnings.append(f"Node {i} is isolated")
        return warnings

    def to_json(
        self,
        matrix: np.ndarray,
        node_labels: List[str],
        edges: List[Dict],
        directed: bool,
        processing_time_ms: float,
        confidence_threshold: float = 0.5,
    ) -> dict:
        uncertain = [
            e for e in edges if e.get("confidence", 1.0) < confidence_threshold
        ]
        status = "partial" if uncertain else "success"
        node_index = {i: label for i, label in enumerate(node_labels)}
        edge_metadata = []
        for e in edges:
            if e.get("flags") == "dangling":
                continue
            entry = {
                "source": e["source"],
                "target": e["target"],
                "label": e.get("label"),
                "confidence": e.get("confidence", 1.0),
            }
            if e.get("value") is not None:
                entry["value"] = e["value"]
            if e.get("component") and e["component"] != "wire":
                entry["component"] = e["component"]
            edge_metadata.append(entry)
        return {
            "status": status,
            "node_count": len(node_labels),
            "edge_count": len(edge_metadata),
            "directed": directed,
            "node_index": node_index,
            "adjacency_matrix": matrix.astype(int).tolist(),
            "edge_metadata": edge_metadata,
            "uncertain": uncertain,
            "annotated_image": None,
            "processing_time_ms": processing_time_ms,
        }

    def to_csv(self, matrix: np.ndarray, node_labels: List[str]) -> str:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([""] + node_labels)
        for i, label in enumerate(node_labels):
            writer.writerow([label] + [int(v) for v in matrix[i]])
        return buf.getvalue()

    def render_overlay(
        self,
        original_image: np.ndarray,
        nodes: List[Dict],
        edges: List[Dict],
        confidence_threshold: float = 0.5,
    ) -> np.ndarray:
        img = original_image.copy()
        if img.ndim == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

        node_map = {n["id"]: n for n in nodes}

        for edge in edges:
            if edge.get("flags") == "dangling":
                continue
            src = node_map.get(edge["source"])
            tgt = node_map.get(edge["target"])
            if src is None or tgt is None:
                continue
            conf = edge.get("confidence", 1.0)
            color = (0, 200, 0) if conf >= confidence_threshold else (0, 220, 220)
            cv2.line(img, src["center"], tgt["center"], color, 2)

        for node in nodes:
            conf = node.get("confidence", 1.0)
            color = (0, 220, 0) if conf >= confidence_threshold else (0, 220, 220)
            cx, cy = node["center"]
            r = node.get("radius", 10)
            cv2.circle(img, (cx, cy), r, color, 2)
            cv2.putText(
                img,
                str(node["id"]),
                (cx - 6, cy - r - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                1,
            )

        return img
