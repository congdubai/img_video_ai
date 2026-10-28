import os
import shutil
import io
import json
import yaml
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from PIL import Image

from core.hash_utils import compute_file_hash, is_step_stale, atomic_write_text, atomic_write_json
from core.models import TimelineData, ScenesData, PromptsData

router = APIRouter(prefix="/api/projects", tags=["projects"])
PROJECTS_ROOT = os.path.abspath("projects")

class CreateProjectRequest(BaseModel):
    name: str
    script: Optional[str] = ""

class DuplicateProjectRequest(BaseModel):
    target_name: str

class UpdateFileRequest(BaseModel):
    content: Any

def get_project_dir(name: str) -> str:
    # Chống path traversal
    safe_name = os.path.basename(name.strip())
    p_dir = os.path.join(PROJECTS_ROOT, safe_name)
    return p_dir

def check_project_steps_status(p_dir: str) -> dict:
    """Kiểm tra trạng thái và tính lỗi thời của 5 bước trong dự án."""
    script_p = os.path.join(p_dir, "script.txt")
    timeline_p = os.path.join(p_dir, "timeline.json")
    voice_p = os.path.join(p_dir, "audio", "voice.wav")
    scenes_p = os.path.join(p_dir, "scenes.json")
    prompts_p = os.path.join(p_dir, "prompts.json")
    images_meta_p = os.path.join(p_dir, "images", "metadata.json")
    video_p = os.path.join(p_dir, "output", "video.mp4")

    script_exists = os.path.exists(script_p)
    script_hash = compute_file_hash(script_p) if script_exists else None

    # TTS status
    tts_done = os.path.exists(timeline_p) and os.path.exists(voice_p)
    tts_stale = is_step_stale(timeline_p, script_hash) if tts_done else False
    timeline_hash = compute_file_hash(timeline_p) if tts_done else None

    # Scenes status
    scenes_done = os.path.exists(scenes_p)
    scenes_stale = is_step_stale(scenes_p, timeline_hash) if scenes_done else False
    scenes_hash = compute_file_hash(scenes_p) if scenes_done else None

    # Prompts status
    prompts_done = os.path.exists(prompts_p)
    prompts_stale = is_step_stale(prompts_p, scenes_hash) if prompts_done else False
    prompts_hash = compute_file_hash(prompts_p) if prompts_done else None

    # Images status
    images_done = os.path.exists(images_meta_p)
    images_stale = is_step_stale(images_meta_p, prompts_hash) if images_done else False

    # Render status
    render_done = os.path.exists(video_p)

    # Thời lượng video ước lượng / thực tế
    duration = 0.0
    if os.path.exists(timeline_p):
        try:
            with open(timeline_p, "r", encoding="utf-8") as f:
                d = json.load(f)
                duration = d.get("total_duration", 0.0)
        except Exception:
            pass

    return {
        "script": {"exists": script_exists, "stale": False},
        "tts": {"exists": tts_done, "stale": tts_stale},
        "scenes": {"exists": scenes_done, "stale": scenes_stale},
        "prompts": {"exists": prompts_done, "stale": prompts_stale},
        "images": {"exists": images_done, "stale": images_stale},
        "render": {"exists": render_done, "stale": False},
        "total_duration": duration
    }

@router.get("")
def list_projects():
    os.makedirs(PROJECTS_ROOT, exist_ok=True)
    items = []
    for entry in os.listdir(PROJECTS_ROOT):
        p_dir = os.path.join(PROJECTS_ROOT, entry)
        if os.path.isdir(p_dir):
            status_info = check_project_steps_status(p_dir)
            items.append({
                "name": entry,
                "status": status_info,
                "total_duration": status_info["total_duration"]
            })
    return {"projects": items}

@router.post("")
def create_project(req: CreateProjectRequest):
    p_dir = get_project_dir(req.name)
    if os.path.exists(p_dir):
        raise HTTPException(status_code=400, detail=f"Dự án '{req.name}' đã tồn tại.")
    os.makedirs(p_dir, exist_ok=True)
    os.makedirs(os.path.join(p_dir, "audio"), exist_ok=True)
    os.makedirs(os.path.join(p_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(p_dir, "output"), exist_ok=True)

    default_script = req.script if req.script else "Chào các bạn! Đây là kịch bản video đầu tiên của tôi.\nChúng ta sẽ cùng tìm hiểu một kiến thức vô cùng thú vị."
    atomic_write_text(os.path.join(p_dir, "script.txt"), default_script)
    return {"message": "Tạo dự án thành công", "name": os.path.basename(p_dir)}

@router.post("/{name}/duplicate")
def duplicate_project(name: str, req: DuplicateProjectRequest):
    src_dir = get_project_dir(name)
    if not os.path.exists(src_dir):
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án nguồn.")
    dst_dir = get_project_dir(req.target_name)
    if os.path.exists(dst_dir):
        raise HTTPException(status_code=400, detail="Tên dự án mới đã tồn tại.")
    shutil.copytree(src_dir, dst_dir)
    return {"message": "Nhân đôi dự án thành công", "name": req.target_name}

@router.delete("/{name}")
def delete_project(name: str):
    p_dir = get_project_dir(name)
    if not os.path.exists(p_dir):
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
    shutil.rmtree(p_dir)
    return {"message": f"Đã xóa vĩnh viễn dự án {name}"}

@router.get("/{name}/status")
def get_project_status(name: str):
    p_dir = get_project_dir(name)
    if not os.path.exists(p_dir):
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
    return check_project_steps_status(p_dir)

@router.get("/{name}/files/{file_type}")
def get_project_file(name: str, file_type: str):
    p_dir = get_project_dir(name)
    if not os.path.exists(p_dir):
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")

    file_mapping = {
        "script": ("script.txt", "text"),
        "timeline": ("timeline.json", "json"),
        "scenes": ("scenes.json", "json"),
        "prompts": ("prompts.json", "json"),
        "images_meta": (os.path.join("images", "metadata.json"), "json"),
        "config": ("config.yaml", "yaml")
    }

    if file_type not in file_mapping:
        raise HTTPException(status_code=400, detail="Loại file không hợp lệ.")

    rel_path, ftype = file_mapping[file_type]
    full_path = os.path.join(p_dir, rel_path)

    if not os.path.exists(full_path):
        if ftype == "json":
            return {"content": None, "exists": False}
        return {"content": "", "exists": False}

    try:
        with open(full_path, "r", encoding="utf-8") as f:
            if ftype == "json":
                return {"content": json.load(f), "exists": True}
            elif ftype == "yaml":
                return {"content": yaml.safe_load(f), "exists": True}
            else:
                return {"content": f.read(), "exists": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể đọc file: {e}")

@router.put("/{name}/files/{file_type}")
def update_project_file(name: str, file_type: str, req: UpdateFileRequest):
    p_dir = get_project_dir(name)
    if not os.path.exists(p_dir):
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")

    file_mapping = {
        "script": ("script.txt", "text"),
        "timeline": ("timeline.json", "json"),
        "scenes": ("scenes.json", "json"),
        "prompts": ("prompts.json", "json"),
        "config": ("config.yaml", "yaml")
    }

    if file_type not in file_mapping:
        raise HTTPException(status_code=400, detail="Loại file không được hỗ trợ sửa.")

    rel_path, ftype = file_mapping[file_type]
    full_path = os.path.join(p_dir, rel_path)

    try:
        if ftype == "text":
            atomic_write_text(full_path, str(req.content))
        elif ftype == "json":
            atomic_write_json(full_path, req.content)
        elif ftype == "yaml":
            with open(f"{full_path}.tmp", "w", encoding="utf-8") as f:
                yaml.dump(req.content, f, allow_unicode=True)
            if os.path.exists(full_path):
                os.replace(f"{full_path}.tmp", full_path)
            else:
                os.rename(f"{full_path}.tmp", full_path)
        return {"message": "Đã lưu file thành công", "file_type": file_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu file: {e}")

@router.get("/{name}/media/{subpath:path}")
def get_media_file(name: str, subpath: str, thumb: bool = False, w: int = 360):
    """Phục vụ file âm thanh, video, ảnh với hỗ trợ HTTP Range và tạo thumbnail cho ảnh."""
    p_dir = get_project_dir(name)
    safe_subpath = os.path.normpath(subpath).lstrip(os.path.sep)
    file_path = os.path.join(p_dir, safe_subpath)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Không tìm thấy file media.")

    # Nếu yêu cầu thumbnail cho ảnh
    if thumb and file_path.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        try:
            with Image.open(file_path) as img:
                aspect = img.height / float(img.width)
                target_h = int(w * aspect)
                img.thumbnail((w, target_h), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=82)
                buf.seek(0)
                return StreamingResponse(buf, media_type="image/jpeg")
        except Exception:
            pass

    # Phục vụ file thông thường (Starlette FileResponse tự động xử lý byte ranges cho audio/video)
    return FileResponse(file_path)
