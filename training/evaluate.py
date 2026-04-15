#!/usr/bin/env python3
"""Evaluate a trained YOLOv8 model on the test set."""

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Evaluate trained YOLOv8 model")
    parser.add_argument(
        "--weights",
        default=str(Path(__file__).parent / "runs" / "circuit-components" / "weights" / "best.pt"),
        help="Path to trained weights",
    )
    parser.add_argument(
        "--data",
        default=str(Path(__file__).parent / "datasets" / "cghd" / "data.yaml"),
        help="Path to data.yaml",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Image size (default: 640)",
    )
    parser.add_argument(
        "--device",
        default="",
        help="Device: '' for auto, 'cpu', '0' for GPU",
    )
    args = parser.parse_args()

    weights_path = Path(args.weights)
    if not weights_path.exists():
        print(f"ERROR: Weights not found at {weights_path.resolve()}")
        print("Train a model first:")
        print("  python training/train.py")
        return

    from ultralytics import YOLO

    output_dir = str(Path(__file__).parent / "runs" / "evaluation")

    print(f"Loading model: {weights_path.resolve()}")
    model = YOLO(str(weights_path))

    print(f"Evaluating on: {args.data}")
    print(f"  Image size: {args.imgsz}")
    print()

    results = model.val(
        data=args.data,
        imgsz=args.imgsz,
        device=args.device or None,
        project=output_dir,
        name="test",
        exist_ok=True,
        plots=True,
    )

    # Print per-class metrics
    print("\n" + "=" * 60)
    print("Evaluation Results")
    print("=" * 60)
    print(f"{'Class':<25} {'P':>8} {'R':>8} {'mAP50':>8} {'mAP50-95':>10}")
    print("-" * 60)

    names = results.names
    box = results.box

    # Overall metrics
    mp, mr, map50, map5095 = (
        box.mp,
        box.mr,
        box.map50,
        box.map,
    )
    print(f"{'all':<25} {mp:>8.3f} {mr:>8.3f} {map50:>8.3f} {map5095:>10.3f}")

    # Per-class metrics
    if hasattr(box, "p") and len(box.p) > 0:
        for i, name in names.items():
            if i < len(box.p):
                print(
                    f"{name:<25} {box.p[i]:>8.3f} {box.r[i]:>8.3f} "
                    f"{box.ap50[i]:>8.3f} {box.ap[i]:>10.3f}"
                )

    print(f"\nConfusion matrix and plots saved to: {output_dir}/test/")


if __name__ == "__main__":
    main()
