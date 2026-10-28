"""
Package lõi (core) chứa toàn bộ logic 5 bước của hệ thống làm video Nguệch Ngoạc:
- tts: Tổng hợp âm thanh & timeline mốc thời gian từng câu
- scenes: Gộp câu thành cảnh 5-12s
- prompts: Tạo khung lệnh sinh ảnh tiếng Anh & overlay text
- images: Sinh ảnh local (ComfyUI / Diffusers / Placeholder)
- render: Xuất video MP4 (zoom, pan, crossfade, phụ đề .ass, tiêu đề)
"""

from core.models import TimelineData, ScenesData, PromptsData, ImagesData
from core.tts_engine import process_tts
from core.scene_builder import build_scenes
from core.prompt_generator import generate_prompts_template
from core.image_generator import generate_images
from core.video_renderer import render_video

__all__ = [
    "TimelineData",
    "ScenesData",
    "PromptsData",
    "ImagesData",
    "process_tts",
    "build_scenes",
    "generate_prompts_template",
    "generate_images",
    "render_video"
]
