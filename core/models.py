from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class SentenceTimeline(BaseModel):
    id: int
    start: float = Field(..., description="Thời điểm bắt đầu (giây, làm tròn 3 chữ số)")
    end: float = Field(..., description="Thời điểm kết thúc câu (giây)")
    duration: float = Field(..., description="Thời lượng giọng đọc (giây)")
    silence_after: float = Field(0.4, description="Khoảng im lặng chèn sau câu (giây)")
    text: str = Field(..., description="Nguyên văn câu thoại tiếng Việt")
    audio_file: str = Field(..., description="Tên file audio thành phần")

class TimelineData(BaseModel):
    version: str = "1.0"
    source_fingerprint: str = Field(..., description="SHA-256 của script.txt")
    sample_rate: int = 24000
    total_duration: float
    sentences: List[SentenceTimeline]

class Scene(BaseModel):
    scene_id: int
    start: float
    end: float
    duration: float
    sentence_ids: List[int]
    text: str

class ScenesData(BaseModel):
    version: str = "1.0"
    source_fingerprint: str = Field(..., description="SHA-256 của timeline.json")
    total_scenes: int
    scenes: List[Scene]

SceneType = Literal["character", "compare", "object"]
PromptStatus = Literal["draft", "approved"]

class PromptItem(BaseModel):
    scene_id: int
    scene_type: SceneType = "character"
    prompt_en: str = Field("", description="Lệnh sinh ảnh tiếng Anh (không bao gồm style_prefix)")
    overlay_text: str = Field("", description="Chữ tiêu đề cần chèn lên video nếu có")
    status: PromptStatus = "draft"

class PromptsData(BaseModel):
    version: str = "1.0"
    source_fingerprint: str = Field(..., description="SHA-256 của scenes.json")
    style_prefix: str = ""
    negative_prompt: str = ""
    prompts: List[PromptItem]

class ImageMetaItem(BaseModel):
    scene_id: int
    image_file: str
    seed: int
    prompt_full: str
    is_active: bool = True
    created_at: str

class ImagesData(BaseModel):
    version: str = "1.0"
    source_fingerprint: str = Field(..., description="SHA-256 của prompts.json")
    items: List[ImageMetaItem]
