from pydantic import BaseModel


class ExtractionOptions(BaseModel):
    directed: bool = False
    include_ocr: bool = True
    confidence_threshold: float = 0.5
    output_format: str = "json"
    debug: bool = False


class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool


class EdgeMetadata(BaseModel):
    source: int
    target: int
    label: str | None = None
    confidence: float = 1.0


class ExtractionResult(BaseModel):
    status: str
    node_count: int
    edge_count: int
    directed: bool
    node_index: dict[int, str]
    adjacency_matrix: list[list[int]]
    edge_metadata: list[EdgeMetadata]
    uncertain: list[dict] = []
    annotated_image: str | None = None
    processing_time_ms: float
