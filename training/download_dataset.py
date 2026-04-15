#!/usr/bin/env python3
"""Download the CGHD-1152 circuit component dataset from Roboflow in YOLOv8 format."""

import argparse
import os
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Download CGHD-1152 dataset from Roboflow")
    parser.add_argument(
        "--api-key",
        default=os.environ.get("ROBOFLOW_API_KEY"),
        help="Roboflow API key (or set ROBOFLOW_API_KEY env var)",
    )
    parser.add_argument(
        "--version",
        type=int,
        default=1,
        help="Dataset version to download (default: 1)",
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).parent / "datasets" / "cghd"),
        help="Output directory (default: training/datasets/cghd/)",
    )
    args = parser.parse_args()

    if not args.api_key:
        print("ERROR: Roboflow API key not provided.\n")
        print("To get a free API key:")
        print("  1. Sign up at https://roboflow.com (free tier works)")
        print("  2. Go to Settings > API Keys")
        print("  3. Copy your Private API Key\n")
        print("Then run:")
        print(f"  export ROBOFLOW_API_KEY=your_key_here")
        print(f"  python {sys.argv[0]}\n")
        print("Or pass it directly:")
        print(f"  python {sys.argv[0]} --api-key your_key_here")
        sys.exit(1)

    try:
        from roboflow import Roboflow
    except ImportError:
        print("ERROR: roboflow package not installed.\n")
        print("Install it with:")
        print("  pip install roboflow")
        sys.exit(1)

    print("Connecting to Roboflow...")
    rf = Roboflow(api_key=args.api_key)

    print("Fetching workspace 'development-tohnm', project 'cghd-1152'...")
    project = rf.workspace("development-tohnm").project("cghd-1152")
    version = project.version(args.version)

    print(f"Downloading dataset v{args.version} in YOLOv8 format...")
    dataset = version.download("yolov8", location=args.output)

    # Print dataset stats
    output_path = Path(args.output)
    print(f"\nDataset saved to: {output_path.resolve()}")

    for split in ("train", "valid", "test"):
        split_dir = output_path / split / "images"
        if split_dir.exists():
            count = len(list(split_dir.iterdir()))
            print(f"  {split}: {count} images")
        else:
            print(f"  {split}: not found")

    data_yaml = output_path / "data.yaml"
    if data_yaml.exists():
        print(f"\ndata.yaml: {data_yaml.resolve()}")
        import yaml

        with open(data_yaml) as f:
            data = yaml.safe_load(f)
        names = data.get("names", [])
        print(f"Classes ({len(names)}):")
        for i, name in enumerate(names):
            print(f"  {i}: {name}")
    else:
        print("\nWARNING: data.yaml not found — check the download output")

    print("\nDone. Next step:")
    print(f"  python training/train.py --data {data_yaml}")


if __name__ == "__main__":
    main()
