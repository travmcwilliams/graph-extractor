import cv2
import numpy as np
import pytest

from app.preprocessor import Preprocessor


@pytest.fixture
def preprocessor():
    return Preprocessor()


def _make_whiteboard(width=400, height=300):
    """Synthetic whiteboard: white background with black circles and lines."""
    img = np.full((height, width, 3), 255, dtype=np.uint8)
    cv2.circle(img, (100, 100), 30, (0, 0, 0), 2)
    cv2.circle(img, (300, 100), 30, (0, 0, 0), 2)
    cv2.circle(img, (200, 220), 30, (0, 0, 0), 2)
    cv2.line(img, (130, 100), (270, 100), (0, 0, 0), 2)
    cv2.line(img, (100, 130), (185, 195), (0, 0, 0), 2)
    cv2.line(img, (300, 130), (215, 195), (0, 0, 0), 2)
    return img


def _make_whiteboard_with_glare(width=400, height=300):
    """Whiteboard image with a bright glare spot."""
    img = _make_whiteboard(width, height)
    cv2.circle(img, (200, 150), 40, (255, 255, 255), -1)
    # Simulate overexposed area by pushing V channel high
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hsv[130:170, 180:220, 2] = 240
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)


def _make_board_with_border():
    """Image with a clear rectangular board contour on a dark background."""
    img = np.full((500, 600, 3), 50, dtype=np.uint8)
    # Draw a white rectangle representing the whiteboard
    pts = np.array([[50, 50], [550, 60], [540, 440], [60, 430]], dtype=np.int32)
    cv2.fillPoly(img, [pts], (255, 255, 255))
    # Draw some content inside the board
    cv2.circle(img, (300, 250), 30, (0, 0, 0), 2)
    return img, pts.astype(np.float32)


class TestRemoveGlare:
    def test_returns_same_shape(self, preprocessor):
        img = _make_whiteboard()
        result = preprocessor.remove_glare(img)
        assert result.shape == img.shape
        assert result.dtype == np.uint8

    def test_no_glare_image(self, preprocessor):
        """Should not crash on an image with no overexposed pixels."""
        img = np.full((100, 100, 3), 128, dtype=np.uint8)
        result = preprocessor.remove_glare(img)
        assert result.shape == img.shape

    def test_reduces_bright_spots(self, preprocessor):
        img = _make_whiteboard_with_glare()
        result = preprocessor.remove_glare(img)
        hsv_before = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        hsv_after = cv2.cvtColor(result, cv2.COLOR_BGR2HSV)
        bright_before = np.sum(hsv_before[:, :, 2] > 200)
        bright_after = np.sum(hsv_after[:, :, 2] > 200)
        assert bright_after <= bright_before


class TestCorrectPerspective:
    def test_no_contour_returns_original(self, preprocessor):
        """Plain image with no board edges should return unchanged."""
        img = np.full((200, 200, 3), 180, dtype=np.uint8)
        result = preprocessor.correct_perspective(img)
        np.testing.assert_array_equal(result, img)

    def test_with_board_contour(self, preprocessor):
        img, _ = _make_board_with_border()
        result = preprocessor.correct_perspective(img)
        assert result.ndim == 3
        assert result.dtype == np.uint8
        # The warped result should be roughly the size of the inner board
        assert result.shape[0] > 0 and result.shape[1] > 0


class TestToGrayscale:
    def test_output_is_single_channel(self, preprocessor):
        img = _make_whiteboard()
        result = preprocessor.to_grayscale(img)
        assert result.ndim == 2
        assert result.dtype == np.uint8


class TestBinarize:
    def test_output_is_binary(self, preprocessor):
        gray = cv2.cvtColor(_make_whiteboard(), cv2.COLOR_BGR2GRAY)
        result = preprocessor.binarize(gray)
        unique = set(np.unique(result))
        assert unique <= {0, 255}

    def test_ink_is_white(self, preprocessor):
        """After binarize, drawn lines (ink) should be white on black bg."""
        gray = cv2.cvtColor(_make_whiteboard(), cv2.COLOR_BGR2GRAY)
        result = preprocessor.binarize(gray)
        # The circle at (100,100) with radius 30 — check pixels on the arc
        # and along the drawn line from (130,100) to (270,100)
        assert np.any(result[68:132, 68:132] == 255)


class TestRemoveNoise:
    def test_removes_small_blobs(self, preprocessor):
        binary = np.zeros((100, 100), dtype=np.uint8)
        # Add a small 1-pixel noise speck
        binary[50, 50] = 255
        # Add a bigger blob that should survive
        binary[20:30, 20:30] = 255
        result = preprocessor.remove_noise(binary)
        assert result[50, 50] == 0
        assert result[25, 25] == 255


class TestSkeletonize:
    def test_output_is_thinner(self, preprocessor):
        binary = np.zeros((100, 100), dtype=np.uint8)
        cv2.rectangle(binary, (30, 45), (70, 55), 255, -1)
        result = preprocessor.skeletonize(binary)
        assert result.dtype == np.uint8
        assert set(np.unique(result)) <= {0, 255}
        assert np.sum(result == 255) < np.sum(binary == 255)

    def test_empty_image(self, preprocessor):
        binary = np.zeros((50, 50), dtype=np.uint8)
        result = preprocessor.skeletonize(binary)
        assert np.sum(result) == 0


class TestProcess:
    def test_returns_expected_keys(self, preprocessor):
        img = _make_whiteboard()
        result = preprocessor.process(img)
        assert "binary" in result
        assert "skeleton" in result
        assert "corrected" in result

    def test_binary_is_binary(self, preprocessor):
        img = _make_whiteboard()
        result = preprocessor.process(img)
        unique = set(np.unique(result["binary"]))
        assert unique <= {0, 255}

    def test_skeleton_is_binary(self, preprocessor):
        img = _make_whiteboard()
        result = preprocessor.process(img)
        unique = set(np.unique(result["skeleton"]))
        assert unique <= {0, 255}

    def test_intermediate_vars_stored(self, preprocessor):
        img = _make_whiteboard()
        preprocessor.process(img)
        assert preprocessor.glare_removed is not None
        assert preprocessor.perspective_corrected is not None
        assert preprocessor.grayscale is not None
        assert preprocessor.binary is not None
        assert preprocessor.cleaned is not None
        assert preprocessor.skeleton is not None

    def test_corrected_is_bgr(self, preprocessor):
        img = _make_whiteboard()
        result = preprocessor.process(img)
        assert result["corrected"].ndim == 3
        assert result["corrected"].shape[2] == 3
