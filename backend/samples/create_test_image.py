"""Generate a synthetic whiteboard circuit image for testing the extraction API.

Creates an 800x600 image simulating a whiteboard photo with:
- 5 component nodes (circles with imperfect hand-drawn jitter)
- Lines connecting them as edges
- Component labels (R1, R2, C1, C2, L1)
- Gaussian noise to simulate camera grain
- A fake glare spot to test preprocessing
"""

import cv2
import numpy as np


def _jittered_circle(img, center, radius, color, thickness, rng, jitter=3):
    """Draw a slightly imperfect circle by perturbing points along the arc."""
    n_points = 60
    angles = np.linspace(0, 2 * np.pi, n_points, endpoint=False)
    pts = []
    for a in angles:
        x = int(center[0] + radius * np.cos(a) + rng.integers(-jitter, jitter + 1))
        y = int(center[1] + radius * np.sin(a) + rng.integers(-jitter, jitter + 1))
        pts.append([x, y])
    pts = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
    cv2.polylines(img, [pts], isClosed=True, color=color, thickness=thickness)


def _jittered_line(img, p1, p2, color, thickness, rng, jitter=2):
    """Draw a slightly wobbly line between two points."""
    n_segments = 8
    pts = []
    for i in range(n_segments + 1):
        t = i / n_segments
        x = int(p1[0] + t * (p2[0] - p1[0]) + rng.integers(-jitter, jitter + 1))
        y = int(p1[1] + t * (p2[1] - p1[1]) + rng.integers(-jitter, jitter + 1))
        pts.append([x, y])
    pts = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
    cv2.polylines(img, [pts], isClosed=False, color=color, thickness=thickness)


def create_test_circuit(path="samples/test_circuit.png"):
    rng = np.random.default_rng(42)
    img = np.full((600, 800, 3), 245, dtype=np.uint8)

    # --- Background texture (whiteboard grain) ---
    noise = rng.integers(-8, 8, img.shape, dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # --- Nodes ---
    nodes = {
        "R1": (130, 150),
        "R2": (380, 110),
        "C1": (630, 160),
        "C2": (200, 440),
        "L1": (520, 460),
    }

    # --- Edges (draw first so nodes overlap on top) ---
    edges = [
        ("R1", "R2"),
        ("R2", "C1"),
        ("R1", "C2"),
        ("R2", "L1"),
        ("C1", "L1"),
        ("C2", "L1"),
    ]
    ink = (20, 20, 20)
    for src, tgt in edges:
        _jittered_line(img, nodes[src], nodes[tgt], ink, 3, rng)

    # --- Draw nodes (filled circles with hand-drawn outline) ---
    for label, center in nodes.items():
        cv2.circle(img, center, 28, ink, -1)
        _jittered_circle(img, center, 28, (5, 5, 5), 3, rng)
        # White label inside the circle
        text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)[0]
        tx = center[0] - text_size[0] // 2
        ty = center[1] + text_size[1] // 2
        cv2.putText(img, label, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

    # --- Fake glare spot (top-right area) ---
    glare_center = (680, 80)
    for r in range(60, 0, -1):
        alpha = int(255 * (r / 60) ** 2)
        overlay = img.copy()
        cv2.circle(overlay, glare_center, r, (255, 255, 255), -1)
        cv2.addWeighted(overlay, alpha / 255, img, 1 - alpha / 255, 0, img)

    # --- Camera-like Gaussian noise ---
    cam_noise = rng.normal(0, 4, img.shape).astype(np.int16)
    img = np.clip(img.astype(np.int16) + cam_noise, 0, 255).astype(np.uint8)

    # --- Slight Gaussian blur to simulate lens softness ---
    img = cv2.GaussianBlur(img, (3, 3), 0.5)

    cv2.imwrite(path, img)
    print(f"Test circuit image saved to {path}")
    print(f"  {len(nodes)} nodes: {list(nodes.keys())}")
    print(f"  {len(edges)} edges: {edges}")
    print(f"  Image size: {img.shape[1]}x{img.shape[0]}")
    print(f"  Includes: Gaussian noise, fake glare spot, hand-drawn jitter")


if __name__ == "__main__":
    create_test_circuit()
