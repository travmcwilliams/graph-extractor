#!/usr/bin/env python3
"""Train a YOLOv8 model on the CGHD circuit component dataset."""

import argparse
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Train YOLOv8 on circuit component data")
    parser.add_argument(
        "--data",
        default=str(Path(__file__).parent / "datasets" / "cghd" / "data.yaml"),
        help="Path to data.yaml (default: training/datasets/cghd/data.yaml)",
    )
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs (default: 50)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size (default: 640)")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (default: 16)")
    parser.add_argument(
        "--device",
        default="",
        help="Device: '' for auto, 'cpu', '0' for GPU 0, '0,1' for multi-GPU",
    )
    parser.add_argument(
        "--name",
        default="circuit-components",
        help="Experiment name (default: circuit-components)",
    )
    parser.add_argument(
        "--weights",
        default="yolov8n.pt",
        help="Pretrained weights (default: yolov8n.pt, downloads automatically)",
    )
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"ERROR: data.yaml not found at {data_path.resolve()}")
        print("Run download_dataset.py first:")
        print("  python training/download_dataset.py --api-key YOUR_KEY")
        return

    from ultralytics import YOLO

    project_dir = str(Path(__file__).parent / "runs")

    print(f"Loading pretrained weights: {args.weights}")
    model = YOLO(args.weights)

    print(f"Training on: {data_path.resolve()}")
    print(f"  Epochs: {args.epochs}")
    print(f"  Image size: {args.imgsz}")
    print(f"  Batch size: {args.batch}")
    print(f"  Device: {args.device or 'auto'}")
    print(f"  Results: {project_dir}/{args.name}/")
    print()

    results = model.train(
        data=str(data_path.resolve()),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device or None,
        project=project_dir,
        name=args.name,
        exist_ok=True,
        verbose=True,
    )

    # Print final metrics
    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)

    metrics = results.results_dict
    for key in ("metrics/precision(B)", "metrics/recall(B)", "metrics/mAP50(B)", "metrics/mAP50-95(B)"):
        if key in metrics:
            print(f"  {key}: {metrics[key]:.4f}")

    # Copy best weights to backend
    best_pt = Path(project_dir) / args.name / "weights" / "best.pt"
    dest = Path(__file__).parent.parent / "backend" / "models" / "circuit_components.pt"
    if best_pt.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best_pt, dest)
        print(f"\nBest weights copied to: {dest.resolve()}")
        print("The backend will load this model on next startup.")
    else:
        print(f"\nWARNING: best.pt not found at {best_pt}")

    print(f"\nFull results: {Path(project_dir).resolve() / args.name}/")


if __name__ == "__main__":
    main()
