import logging

import cv2
import numpy as np
from skimage.morphology import skeletonize as _skeletonize

logger = logging.getLogger(__name__)


class Preprocessor:
    """Stage 1: raw whiteboard photo -> clean binary image for detection."""

    def __init__(self):
        self.glare_removed = None
        self.perspective_corrected = None
        self.grayscale = None
        self.binary = None
        self.cleaned = None
        self.skeleton = None

    # ------------------------------------------------------------------
    # Individual steps
    # ------------------------------------------------------------------

    def remove_glare(self, image: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        _, _, v = cv2.split(hsv)
        mask = (v > 200).astype(np.uint8) * 255
        # If glare covers most of the image, there is no localized glare to
        # fix — inpainting would destroy the content.
        if np.sum(mask > 0) > 0.5 * mask.size:
            return image
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.dilate(mask, kernel)
        inpainted = cv2.inpaint(image, mask, inpaintRadius=7, flags=cv2.INPAINT_NS)
        return inpainted

    def correct_perspective(
        self,
        image: np.ndarray,
        min_area_ratio: float = 0.50,
        min_dim_ratio: float = 0.40,
    ) -> np.ndarray:
        h, w = image.shape[:2]
        image_area = h * w

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)

        for cnt in contours:
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
            if len(approx) != 4:
                continue

            contour_area = cv2.contourArea(approx)
            area_ratio = contour_area / image_area

            # Check bounding dimensions of the contour
            pts = approx.reshape(4, 2)
            cnt_w = pts[:, 0].max() - pts[:, 0].min()
            cnt_h = pts[:, 1].max() - pts[:, 1].min()
            width_ratio = cnt_w / w
            height_ratio = cnt_h / h

            if area_ratio < min_area_ratio:
                logger.info(
                    "Perspective correction skipped: contour area %.1f%% < %.0f%% threshold",
                    area_ratio * 100,
                    min_area_ratio * 100,
                )
                continue

            if width_ratio < min_dim_ratio or height_ratio < min_dim_ratio:
                logger.info(
                    "Perspective correction skipped: contour dimensions %.1f%%w x %.1f%%h "
                    "below %.0f%% minimum",
                    width_ratio * 100,
                    height_ratio * 100,
                    min_dim_ratio * 100,
                )
                continue

            logger.info(
                "Perspective correction applied: contour covers %.1f%% area, %.1f%%w x %.1f%%h",
                area_ratio * 100,
                width_ratio * 100,
                height_ratio * 100,
            )
            return self._four_point_transform(image, pts)

        logger.info("Perspective correction skipped: no qualifying 4-point contour found")
        return image

    def to_grayscale(self, image: np.ndarray) -> np.ndarray:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    def binarize(
        self, image: np.ndarray, block_size: int = 11, constant: int = 2
    ) -> np.ndarray:
        thresh = cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, constant
        )
        return cv2.bitwise_not(thresh)

    def remove_noise(self, image: np.ndarray, kernel_size: int = 3) -> np.ndarray:
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        return cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel)

    def skeletonize(self, binary_image: np.ndarray) -> np.ndarray:
        bool_img = binary_image.astype(bool)
        skel = _skeletonize(bool_img)
        return (skel.astype(np.uint8)) * 255

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    def process(self, image: np.ndarray) -> dict:
        self.glare_removed = self.remove_glare(image)
        self.perspective_corrected = self.correct_perspective(self.glare_removed)
        self.grayscale = self.to_grayscale(self.perspective_corrected)
        self.binary = self.binarize(self.grayscale)
        self.cleaned = self.remove_noise(self.binary)
        self.skeleton = self.skeletonize(self.cleaned)
        return {
            "binary": self.cleaned,
            "skeleton": self.skeleton,
            "corrected": self.perspective_corrected,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _order_points(pts: np.ndarray) -> np.ndarray:
        """Order points: top-left, top-right, bottom-right, bottom-left."""
        rect = np.zeros((4, 2), dtype=np.float32)
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]
        d = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(d)]
        rect[3] = pts[np.argmax(d)]
        return rect

    def _four_point_transform(
        self, image: np.ndarray, pts: np.ndarray
    ) -> np.ndarray:
        rect = self._order_points(pts.astype(np.float32))
        tl, tr, br, bl = rect

        width_top = np.linalg.norm(tr - tl)
        width_bot = np.linalg.norm(br - bl)
        max_w = int(max(width_top, width_bot))

        height_left = np.linalg.norm(bl - tl)
        height_right = np.linalg.norm(br - tr)
        max_h = int(max(height_left, height_right))

        dst = np.array(
            [[0, 0], [max_w - 1, 0], [max_w - 1, max_h - 1], [0, max_h - 1]],
            dtype=np.float32,
        )
        M = cv2.getPerspectiveTransform(rect, dst)
        return cv2.warpPerspective(image, M, (max_w, max_h))
