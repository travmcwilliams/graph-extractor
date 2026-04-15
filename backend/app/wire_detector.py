from collections import deque
from math import pi
from typing import Dict, List, Tuple

import cv2
import numpy as np


class NodeDetector:

    def detect_circles(
        self,
        binary_image: np.ndarray,
        min_radius: int = 10,
        max_radius: int = 80,
    ) -> List[Dict]:
        blurred = cv2.GaussianBlur(binary_image, (9, 9), 2)
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=max(min_radius * 2, 30),
            param1=50,
            param2=30,
            minRadius=min_radius,
            maxRadius=max_radius,
        )
        if circles is None:
            return []
        results = []
        for i, (x, y, r) in enumerate(circles[0]):
            results.append(
                {
                    "id": i,
                    "center": (int(x), int(y)),
                    "radius": int(r),
                    "confidence": 0.8,
                    "method": "hough",
                }
            )
        return results

    def detect_contour_nodes(
        self,
        binary_image: np.ndarray,
        circularity_threshold: float = 0.65,
        min_area: int = 80,
    ) -> List[Dict]:
        contours, _ = cv2.findContours(
            binary_image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        results = []
        node_id = 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue
            circularity = 4 * pi * area / (perimeter * perimeter)

            M = cv2.moments(cnt)
            if M["m00"] == 0:
                continue
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])

            _, enc_radius = cv2.minEnclosingCircle(cnt)

            if circularity > circularity_threshold:
                results.append(
                    {
                        "id": node_id,
                        "center": (cx, cy),
                        "radius": int(enc_radius),
                        "confidence": min(circularity, 1.0),
                        "method": "contour",
                    }
                )
                node_id += 1
            elif area < 500 and circularity > 0.3:
                # Small filled region — possible junction point
                results.append(
                    {
                        "id": node_id,
                        "center": (cx, cy),
                        "radius": int(enc_radius),
                        "confidence": circularity * 0.6,
                        "method": "contour",
                    }
                )
                node_id += 1
        return results

    def detect_junctions(
        self, skeleton_image: np.ndarray, merge_radius: int = 15
    ) -> List[Dict]:
        skel_bool = (skeleton_image > 0).astype(np.float32)
        kernel = np.ones((3, 3), dtype=np.float32)
        kernel[1, 1] = 0
        neighbor_count = cv2.filter2D(skel_bool, cv2.CV_32F, kernel)
        junction_mask = (neighbor_count >= 3.0) & (skel_bool > 0)
        ys, xs = np.where(junction_mask)
        if len(xs) == 0:
            return []

        points = list(zip(xs.tolist(), ys.tolist()))
        clusters = self._cluster_points(points, merge_radius)

        results = []
        for i, cluster in enumerate(clusters):
            arr = np.array(cluster)
            cx = int(arr[:, 0].mean())
            cy = int(arr[:, 1].mean())
            results.append(
                {
                    "id": i,
                    "center": (cx, cy),
                    "radius": 5,
                    "confidence": 0.6,
                    "method": "junction",
                }
            )
        return results

    def merge_detections(
        self, detections_list: List[List[Dict]], merge_distance: int = 25
    ) -> List[Dict]:
        flat = [d for dlist in detections_list for d in dlist]
        if not flat:
            return []

        # Sort by confidence descending so higher-confidence nodes survive
        flat.sort(key=lambda d: d["confidence"], reverse=True)
        kept: List[Dict] = []
        used = [False] * len(flat)

        for i, det in enumerate(flat):
            if used[i]:
                continue
            kept.append(det)
            ci = np.array(det["center"], dtype=float)
            for j in range(i + 1, len(flat)):
                if used[j]:
                    continue
                cj = np.array(flat[j]["center"], dtype=float)
                if np.linalg.norm(ci - cj) < merge_distance:
                    used[j] = True

        for idx, node in enumerate(kept):
            node["id"] = idx
            if node["confidence"] < 0.5:
                node["flags"] = "uncertain"
        return kept

    def detect(
        self, binary_image: np.ndarray, skeleton_image: np.ndarray
    ) -> List[Dict]:
        circles = self.detect_circles(binary_image)
        contour_nodes = self.detect_contour_nodes(binary_image)
        junctions = self.detect_junctions(skeleton_image)
        return self.merge_detections([circles, contour_nodes, junctions])

    @staticmethod
    def _cluster_points(
        points: List[Tuple[int, int]], radius: int
    ) -> List[List[Tuple[int, int]]]:
        assigned = [False] * len(points)
        clusters: List[List[Tuple[int, int]]] = []
        for i, p in enumerate(points):
            if assigned[i]:
                continue
            cluster = [p]
            assigned[i] = True
            queue = deque([i])
            while queue:
                ci = queue.popleft()
                cp = points[ci]
                for j, q in enumerate(points):
                    if assigned[j]:
                        continue
                    if (cp[0] - q[0]) ** 2 + (cp[1] - q[1]) ** 2 <= radius ** 2:
                        assigned[j] = True
                        cluster.append(q)
                        queue.append(j)
            clusters.append(cluster)
        return clusters


class EdgeDetector:

    def detect_lines(
        self,
        skeleton_image: np.ndarray,
        min_line_length: int = 20,
        max_line_gap: int = 10,
    ) -> List[Tuple]:
        lines = cv2.HoughLinesP(
            skeleton_image,
            rho=1,
            theta=np.pi / 180,
            threshold=20,
            minLineLength=min_line_length,
            maxLineGap=max_line_gap,
        )
        if lines is None:
            return []
        return [((int(l[0][0]), int(l[0][1])), (int(l[0][2]), int(l[0][3]))) for l in lines]

    def associate_edges(
        self,
        lines: List[Tuple],
        nodes: List[Dict],
        proximity_threshold: int = 30,
    ) -> List[Dict]:
        edges = []
        edge_id = 0
        for p1, p2 in lines:
            src = self._closest_node(p1, nodes, proximity_threshold)
            tgt = self._closest_node(p2, nodes, proximity_threshold)
            if src is not None and tgt is not None and src != tgt:
                dist_src = np.linalg.norm(
                    np.array(p1) - np.array(nodes[src]["center"])
                )
                dist_tgt = np.linalg.norm(
                    np.array(p2) - np.array(nodes[tgt]["center"])
                )
                avg_dist = (dist_src + dist_tgt) / 2
                conf = max(0.0, 1.0 - avg_dist / proximity_threshold)
                edges.append(
                    {
                        "id": edge_id,
                        "source": src,
                        "target": tgt,
                        "confidence": conf,
                        "method": "hough",
                    }
                )
                edge_id += 1
            elif src is not None or tgt is not None:
                matched = src if src is not None else tgt
                edges.append(
                    {
                        "id": edge_id,
                        "source": matched,
                        "target": -1 if tgt is None else tgt,
                        "confidence": 0.3,
                        "method": "hough",
                        "flags": "dangling",
                    }
                )
                edge_id += 1
        return edges

    def trace_paths(
        self,
        skeleton_image: np.ndarray,
        nodes: List[Dict],
        max_path_length: int = 1000,
    ) -> List[Dict]:
        if not nodes:
            return []
        h, w = skeleton_image.shape[:2]
        skel_bool = skeleton_image > 0
        node_map = {}
        for node in nodes:
            cx, cy = node["center"]
            r = node.get("radius", 5)
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        node_map[(nx, ny)] = node["id"]

        edges = []
        seen_pairs = set()
        directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

        for node in nodes:
            nid = node["id"]
            cx, cy = node["center"]
            r = node.get("radius", 5)
            # Collect skeleton pixels just outside the node radius as start points
            starts = []
            for dy in range(-(r + 3), r + 4):
                for dx in range(-(r + 3), r + 4):
                    nx_, ny_ = cx + dx, cy + dy
                    dist_sq = dx * dx + dy * dy
                    if dist_sq < r * r:
                        continue
                    if 0 <= ny_ < h and 0 <= nx_ < w and skel_bool[ny_, nx_]:
                        starts.append((nx_, ny_))

            for start in starts:
                target = self._trace_single_path(
                    start, nid, skel_bool, node_map, directions, h, w, max_path_length
                )
                if target is not None and target != nid:
                    pair = (min(nid, target), max(nid, target))
                    if pair not in seen_pairs:
                        seen_pairs.add(pair)
                        edges.append(
                            {
                                "id": len(edges),
                                "source": pair[0],
                                "target": pair[1],
                                "confidence": 0.7,
                                "method": "trace",
                            }
                        )
        return edges

    def merge_edges(self, edge_lists: List[List[Dict]]) -> List[Dict]:
        flat = [e for elist in edge_lists for e in elist]
        # Remove dangling edges for dedup purposes
        valid = [e for e in flat if e.get("flags") != "dangling"]
        dangling = [e for e in flat if e.get("flags") == "dangling"]

        best = {}
        for e in valid:
            pair = (min(e["source"], e["target"]), max(e["source"], e["target"]))
            if pair not in best or e["confidence"] > best[pair]["confidence"]:
                best[pair] = e

        result = list(best.values())
        # Keep dangling edges that don't overlap with valid edges
        for d in dangling:
            valid_node = d["source"] if d["target"] == -1 else d["target"]
            has_valid = any(
                valid_node in (e["source"], e["target"]) for e in result
            )
            if not has_valid:
                result.append(d)

        for idx, e in enumerate(result):
            e["id"] = idx
        return result

    def detect(
        self, skeleton_image: np.ndarray, nodes: List[Dict]
    ) -> List[Dict]:
        lines = self.detect_lines(skeleton_image)
        hough_edges = self.associate_edges(lines, nodes)
        trace_edges = self.trace_paths(skeleton_image, nodes)
        return self.merge_edges([hough_edges, trace_edges])

    @staticmethod
    def _closest_node(
        point: Tuple, nodes: List[Dict], threshold: int
    ) -> int | None:
        px, py = point
        best_id = None
        best_dist = float("inf")
        for node in nodes:
            cx, cy = node["center"]
            dist = ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5
            if dist < threshold and dist < best_dist:
                best_dist = dist
                best_id = node["id"]
        return best_id

    @staticmethod
    def _trace_single_path(
        start: Tuple[int, int],
        source_id: int,
        skel_bool: np.ndarray,
        node_map: dict,
        directions: list,
        h: int,
        w: int,
        max_path_length: int,
    ) -> int | None:
        visited = {start}
        queue = deque([start])
        steps = 0
        while queue and steps < max_path_length:
            x, y = queue.popleft()
            steps += 1
            for dx, dy in directions:
                nx, ny = x + dx, y + dy
                if (nx, ny) in visited:
                    continue
                if not (0 <= ny < h and 0 <= nx < w):
                    continue
                if not skel_bool[ny, nx]:
                    continue
                visited.add((nx, ny))
                target_id = node_map.get((nx, ny))
                if target_id is not None and target_id != source_id:
                    return target_id
                queue.append((nx, ny))
        return None
