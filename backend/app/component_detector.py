# Component detection using YOLOv8/YOLOv10 via ultralytics

import logging
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

DEFAULT_MODEL_PATH = str(Path(__file__).resolve().parent.parent / "models" / "circuit_components.pt")

# Map YOLO class names to simplified component categories used by the graph builder.
# Classes not listed here pass through as-is.
CLASS_CATEGORY_MAP = {
    "resistor": "resistor",
    "resistor.adjustable": "resistor",
    "resistor.photo": "resistor",
    "capacitor.unpolarized": "capacitor",
    "capacitor.polarized": "capacitor",
    "capacitor.adjustable": "capacitor",
    "inductor": "inductor",
    "inductor.ferrite": "inductor",
    "inductor.coupled": "inductor",
    "diode": "diode",
    "diode.light_emitting": "LED",
    "diode.thyrector": "diode",
    "diode.zener": "diode",
    "transistor.bjt": "transistor",
    "transistor.fet": "transistor",
    "transistor.photo": "transistor",
    "voltage.dc": "voltage_source",
    "voltage.ac": "voltage_source",
    "voltage.battery": "battery",
    "integrated_circuit": "IC",
    "integrated_circuit.ne555": "IC",
    "integrated_circuit.voltage_regulator": "IC",
    "operational_amplifier": "op_amp",
    "operational_amplifier.schmitt_trigger": "op_amp",
}


class ComponentDetector:

    def __init__(self, model_path: Optional[str] = None, device: str = "cpu"):
        self.model_path = model_path or DEFAULT_MODEL_PATH
        self.device = device
        self.model = None
        self._load_model()

    def _load_model(self):
        model_file = Path(self.model_path)
        if not model_file.exists():
            logger.warning("YOLO weights not found at %s — component detection disabled", self.model_path)
            return
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
            logger.info(
                "Loaded YOLO model: %d classes from %s",
                len(self.model.names),
                self.model_path,
            )
        except Exception as e:
            logger.warning("Failed to load YOLO model: %s", e)
            self.model = None

    @property
    def is_available(self) -> bool:
        return self.model is not None

    def detect(
        self,
        image: np.ndarray,
        confidence_threshold: float = 0.25,
    ) -> List[Dict]:
        if self.model is None:
            return []

        results = self.model(image, conf=confidence_threshold, device=self.device, verbose=False)
        components = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                class_name = self.model.names[cls_id]
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2
                category = CLASS_CATEGORY_MAP.get(class_name, class_name)

                components.append({
                    "id": len(components),
                    "class_name": class_name,
                    "category": category,
                    "confidence": conf,
                    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                    "center": (cx, cy),
                    "radius": max(x2 - x1, y2 - y1) // 2,
                })

        logger.info("Detected %d components", len(components))
        return components

    def detect_as_nodes(
        self,
        image: np.ndarray,
        confidence_threshold: float = 0.25,
        start_id: int = 0,
    ) -> List[Dict]:
        """Detect components and return them as node dicts compatible with the pipeline."""
        components = self.detect(image, confidence_threshold)
        nodes = []
        for i, comp in enumerate(components):
            # Skip text detections — those are handled by OCR
            if comp["class_name"] == "text":
                continue
            nodes.append({
                "id": start_id + i,
                "center": comp["center"],
                "radius": comp["radius"],
                "confidence": comp["confidence"],
                "method": "yolo",
                "label": comp["category"],
                "class_name": comp["class_name"],
            })
        return nodes
