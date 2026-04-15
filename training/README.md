# YOLOv8 Training for Circuit Component Detection

Train a YOLOv8 model to detect circuit components (resistors, capacitors, inductors, etc.) in hand-drawn diagrams.

## Prerequisites

```bash
cd training
pip install -r requirements.txt
```

## Step 1: Get a Roboflow API Key

1. Sign up at [roboflow.com](https://roboflow.com) (free tier works)
2. Go to **Settings > API Keys**
3. Copy your **Private API Key**

```bash
export ROBOFLOW_API_KEY=your_key_here
```

## Step 2: Download the Dataset

```bash
python training/download_dataset.py
```

This downloads the [CGHD-1152](https://universe.roboflow.com/development-tohnm/cghd-1152) dataset (~1,152 annotated circuit images) in YOLOv8 format to `training/datasets/cghd/`.

## Step 3: Train

```bash
# Quick training (CPU, ~2-4 hours)
python training/train.py --epochs 50 --batch 8 --device cpu

# GPU training (~15-30 minutes on a single modern GPU)
python training/train.py --epochs 50 --batch 16

# Longer training for better accuracy
python training/train.py --epochs 100 --batch 16 --imgsz 640
```

### Expected Training Times

| Hardware           | Epochs | Batch | Approx. Time |
|--------------------|--------|-------|--------------|
| CPU (M1/M2 Mac)   | 50     | 8     | 2-4 hours    |
| CPU (x86)          | 50     | 8     | 3-6 hours    |
| Single GPU (T4)    | 50     | 16    | 15-30 min    |
| Single GPU (A100)  | 50     | 32    | 5-10 min     |
| Apple MPS (M1/M2)  | 50     | 16    | 30-60 min    |

Apple Silicon Macs: ultralytics auto-detects MPS. Pass `--device mps` to force it.

Results are saved to `training/runs/circuit-components/`. The best weights are automatically copied to `backend/models/circuit_components.pt`.

## Step 4: Evaluate

```bash
python training/evaluate.py
```

Prints per-class precision, recall, and mAP. Saves confusion matrix to `training/runs/evaluation/`.

## Step 5: Quick Visual Check

```bash
python training/predict_sample.py path/to/image.png
```

Draws bounding boxes on the image and saves to `training/runs/predictions/`.

## Using Custom Training Data

### Add images to the existing dataset

1. Add images to `training/datasets/cghd/train/images/`
2. Add matching YOLO-format label files to `training/datasets/cghd/train/labels/`
3. Re-run training

### YOLO label format

One `.txt` file per image, each line:

```
class_id center_x center_y width height
```

All values are normalized (0-1) relative to image dimensions.

### Use a completely different dataset

1. Organize your data:
   ```
   training/datasets/my_data/
   ├── train/images/
   ├── train/labels/
   ├── valid/images/
   ├── valid/labels/
   └── data.yaml
   ```

2. Create `data.yaml`:
   ```yaml
   train: train/images
   val: valid/images
   nc: 5
   names: ['resistor', 'capacitor', 'inductor', 'diode', 'ground']
   ```

3. Train:
   ```bash
   python training/train.py --data training/datasets/my_data/data.yaml
   ```

## Adding New Component Classes

1. Update `data.yaml` — increase `nc` and add the class name to `names`
2. Add annotated images with the new class to train/valid splits
3. Re-train from scratch (or fine-tune from your previous best.pt):
   ```bash
   python training/train.py --weights training/runs/circuit-components/weights/best.pt
   ```

## Integrating with the Backend

After training, the best weights land at `backend/models/circuit_components.pt`. The backend pipeline (`backend/app/component_detector.py`) will load this model automatically once Phase 2 is implemented.
