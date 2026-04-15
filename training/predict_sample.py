#!/usr/bin/env python3
"""Run inference on a single image for quick visual sanity checks."""

import argparse
from pathlib import Path

import cv2


def main():
    parser = argparse.ArgumentParser(description="Run YOLOv8 inference on a single image")
    parser.add_argument("image", help="Path to input image")
    parser.add_argument(
        "--weights",
        default=str(Path(__file__).parent / "runs" / "circuit-components" / "weights" / "best.pt"),
        help="Path to trained weights",
    )
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size (default: 640)")
    parser.add_argument(
        "--output",
        default=str(Path(__file__).parent / "runs" / "predictions"),
        help="Output directory for annotated image",
    )
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"ERROR: Image not found: {image_path}")
        return

    weights_path = Path(args.weights)
    if not weights_path.exists():
        print(f"ERROR: Weights not found at {weights_path.resolve()}")
        print("Train a model first:")
        print("  python training/train.py")
        return

    from ultralytics import YOLO

    print(f"Loading model: {weights_path.name}")
    model = YOLO(str(weights_path))

    print(f"Running inference on: {image_path.name}")
    results = model.predict(
        source=str(image_path),
        conf=args.conf,
        imgsz=args.imgsz,
        verbose=False,
    )

    result = results[0]
    names = result.names

    # Print detections
    print(f"\nDetected {len(result.boxes)} components:")
    print(f"{'Class':<20} {'Conf':>6} {'BBox (x1,y1,x2,y2)'}")
    print("-" * 55)

    for box in result.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        cls_name = names[cls_id]
        print(f"{cls_name:<20} {conf:>5.2f}  ({x1:.0f}, {y1:.0f}, {x2:.0f}, {y2:.0f})")

    # Save annotated image
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    annotated = result.plot()
    output_path = output_dir / f"pred_{image_path.name}"
    cv2.imwrite(str(output_path), annotated)
    print(f"\nAnnotated image saved to: {output_path.resolve()}")


if __name__ == "__main__":
    main()
