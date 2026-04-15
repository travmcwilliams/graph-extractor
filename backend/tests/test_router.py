import io

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_png_bytes():
    """Create a minimal valid PNG image in memory."""
    img = np.full((100, 100, 3), 200, dtype=np.uint8)
    cv2.circle(img, (50, 50), 20, (0, 0, 0), -1)
    _, buf = cv2.imencode(".png", img)
    return io.BytesIO(buf.tobytes())


def test_extract_returns_result(client):
    response = client.post(
        "/api/extract",
        files={"file": ("test.png", _make_png_bytes(), "image/png")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("success", "partial")
    assert "adjacency_matrix" in data
    assert "node_count" in data


def test_extract_with_bad_image(client):
    fake = io.BytesIO(b"not an image")
    response = client.post(
        "/api/extract",
        files={"file": ("bad.png", fake, "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "error"


def test_extract_preview_returns_base64(client):
    response = client.post(
        "/api/extract/preview",
        files={"file": ("test.png", _make_png_bytes(), "image/png")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "preview_image" in data


def test_extract_preview_with_bad_image(client):
    fake = io.BytesIO(b"not an image")
    response = client.post(
        "/api/extract/preview",
        files={"file": ("bad.png", fake, "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "error"
