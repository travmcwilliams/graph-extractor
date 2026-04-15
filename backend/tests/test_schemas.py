from app.schemas import ExtractionOptions, HealthResponse


def test_extraction_options_defaults():
    opts = ExtractionOptions()
    assert opts.directed is False
    assert opts.include_ocr is True
    assert opts.confidence_threshold == 0.5
    assert opts.output_format == "json"
    assert opts.debug is False


def test_health_response():
    resp = HealthResponse(status="ok", version="0.1.0", model_loaded=False)
    assert resp.status == "ok"
