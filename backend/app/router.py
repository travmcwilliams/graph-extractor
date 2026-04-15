import logging

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, Request, UploadFile

from app.schemas import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
async def health(request: Request):
    pipeline = getattr(request.app.state, "pipeline", None)
    model_loaded = pipeline.component_detector.is_available if pipeline else False
    return {"status": "ok", "version": "0.1.0", "model_loaded": model_loaded}


@router.post("/extract")
async def extract(
    request: Request,
    file: UploadFile = File(...),
    directed: bool = Form(False),
    include_ocr: bool = Form(True),
    confidence_threshold: float = Form(0.5),
    output_format: str = Form("json"),
    debug: bool = Form(False),
):
    try:
        contents = await file.read()
        arr = np.frombuffer(contents, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            return {"status": "error", "message": "Could not decode image"}

        options = {
            "directed": directed,
            "include_ocr": include_ocr,
            "confidence_threshold": confidence_threshold,
            "output_format": output_format,
            "debug": debug,
        }
        pipeline = request.app.state.pipeline
        result = pipeline.extract(image, options)
        return result
    except Exception as e:
        logger.exception("Extraction failed")
        return {"status": "error", "message": str(e)}


@router.post("/extract/preview")
async def extract_preview(
    request: Request,
    file: UploadFile = File(...),
):
    try:
        contents = await file.read()
        arr = np.frombuffer(contents, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            return {"status": "error", "message": "Could not decode image"}

        pipeline = request.app.state.pipeline
        b64 = pipeline.preview(image)
        return {"status": "ok", "preview_image": b64}
    except Exception as e:
        logger.exception("Preview failed")
        return {"status": "error", "message": str(e)}
