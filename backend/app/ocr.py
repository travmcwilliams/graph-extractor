import logging
import re
from typing import Dict, List, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Pattern for component identifiers like R1, C2, L1, Q1, U1, D1
_IDENTIFIER_RE = re.compile(r"^[RCLQUDJTM]\d+$", re.IGNORECASE)

# Pattern for component values like 10k, 4.7u, 100pF, 1M, 3.3V
_VALUE_RE = re.compile(
    r"^\d+\.?\d*\s*[kKmMuUnNpP]?\s*"
    r"(?:[oO]hm|[Ωω]|[fF]|[hH]|[vV]|[aA])?\s*$"
)


class LabelExtractor:

    def __init__(self, languages: List[str] = None, gpu: bool = False):
        if languages is None:
            languages = ["en"]
        self.reader = None
        try:
            import easyocr

            self.reader = easyocr.Reader(languages, gpu=gpu, verbose=False)
        except Exception as e:
            logger.warning("EasyOCR initialization failed: %s", e)

    def extract_labels(
        self, image: np.ndarray, regions: List[Dict] = None
    ) -> List[Dict]:
        if self.reader is None:
            return []

        if regions:
            return self._extract_from_regions(image, regions)
        return self._extract_from_image(image)

    def associate_labels(
        self,
        labels: List[Dict],
        components: List[Dict],
        nodes: List[Dict],
        max_distance: int = 50,
    ) -> Tuple[List[Dict], List[Dict]]:
        components = [c.copy() for c in components]
        nodes = [n.copy() for n in nodes]
        targets = components + nodes

        for lbl in labels:
            lc = np.array(lbl["center"], dtype=float)
            best_target = None
            best_dist = float("inf")
            for t in targets:
                tc = np.array(t["center"], dtype=float)
                d = float(np.linalg.norm(lc - tc))
                if d < best_dist:
                    best_dist = d
                    best_target = t

            if best_target is None or best_dist > max_distance:
                continue

            text = lbl["text"]
            if _IDENTIFIER_RE.match(text):
                best_target["label"] = text.upper()
            elif _VALUE_RE.match(text):
                best_target["value"] = text.strip()
            else:
                # Fallback: short strings as labels, longer as values
                if len(text) <= 4:
                    best_target.setdefault("label", text)
                else:
                    best_target.setdefault("value", text)

        n_comp = len(components)
        return targets[:n_comp], targets[n_comp:]

    def extract_and_associate(
        self,
        image: np.ndarray,
        components: List[Dict],
        nodes: List[Dict],
    ) -> Tuple[List[Dict], List[Dict]]:
        if self.reader is None:
            return components, nodes
        labels = self.extract_labels(image)
        return self.associate_labels(labels, components, nodes)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _extract_from_image(self, image: np.ndarray) -> List[Dict]:
        results = self.reader.readtext(image)
        return self._parse_results(results, offset_x=0, offset_y=0)

    def _extract_from_regions(
        self, image: np.ndarray, regions: List[Dict]
    ) -> List[Dict]:
        h, w = image.shape[:2]
        all_labels = []
        for region in regions:
            x1 = max(0, region.get("x1", 0))
            y1 = max(0, region.get("y1", 0))
            x2 = min(w, region.get("x2", w))
            y2 = min(h, region.get("y2", h))
            if x2 <= x1 or y2 <= y1:
                continue
            crop = image[y1:y2, x1:x2]
            results = self.reader.readtext(crop)
            all_labels.extend(
                self._parse_results(results, offset_x=x1, offset_y=y1)
            )
        return all_labels

    def _parse_results(
        self, results: list, offset_x: int, offset_y: int
    ) -> List[Dict]:
        labels = []
        for bbox, text, conf in results:
            if conf < 0.3:
                continue
            text = self._clean_text(text.strip())
            if not text:
                continue
            xs = [int(p[0]) + offset_x for p in bbox]
            ys = [int(p[1]) + offset_y for p in bbox]
            x1, x2 = min(xs), max(xs)
            y1, y2 = min(ys), max(ys)
            labels.append(
                {
                    "text": text,
                    "confidence": float(conf),
                    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                    "center": ((x1 + x2) // 2, (y1 + y2) // 2),
                }
            )
        return labels

    @staticmethod
    def _clean_text(text: str) -> str:
        # Common OCR substitutions for circuit values
        cleaned = text
        # Fix O/0 confusion: if it looks like a number with O, replace O -> 0
        if re.match(r"^\d*O\d*$", cleaned):
            cleaned = cleaned.replace("O", "0")
        # Fix l/1 confusion: if it looks like a number with l, replace l -> 1
        if re.match(r"^\d*l\d*$", cleaned):
            cleaned = cleaned.replace("l", "1")
        # Normalize k/K for kilo
        if re.match(r"^\d+\.?\d*k$", cleaned, re.IGNORECASE):
            cleaned = cleaned[:-1] + "k"
        return cleaned
