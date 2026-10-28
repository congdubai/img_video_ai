import os
import sys
import platform
import subprocess
import requests
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.task_queue import task_queue, TaskItem
from core.video_renderer import check_nvenc_support

router = APIRouter(prefix="/api", tags=["jobs_and_env"])

class JobRequest(BaseModel):
    sentence_id: Optional[int] = None
    scene_id: Optional[int] = None
    variants: Optional[int] = 1
    min_duration: Optional[float] = None
    max_duration: Optional[float] = None
    preview: Optional[bool] = False
    from_sec: Optional[float] = None
    to_sec: Optional[float] = None
    force: Optional[bool] = False
    all: Optional[bool] = False

@router.post("/projects/{name}/jobs/{step}")
def trigger_job(name: str, step: str, req: JobRequest):
    project_dir = os.path.abspath(os.path.join("projects", name))
    if not os.path.exists(project_dir):
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")

    valid_steps = ["tts", "scenes", "prompts", "images", "render", "all"]
    if step not in valid_steps:
        raise HTTPException(status_code=400, detail=f"Bước không hợp lệ. Chọn: {valid_steps}")

    params = req.model_dump(exclude_none=True)
    task = task_queue.enqueue(name, step, params)
    return {
        "message": f"Đã đưa bước {step.upper()} vào hàng đợi xử lý",
        "task_id": task.task_id,
        "status": task.status
    }

@router.delete("/jobs/{task_id}")
def cancel_job(task_id: str):
    success = task_queue.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy tác vụ hoặc tác vụ đã kết thúc.")
    return {"message": "Đã gửi yêu cầu hủy tác vụ và giải phóng bộ nhớ."}

@router.get("/jobs")
def get_jobs():
    return {
        "current_task": task_queue.current_task,
        "all_tasks": list(task_queue.tasks.values())[-20:] # 20 tác vụ gần nhất
    }

@router.get("/env")
def check_environment():
    """Kiểm tra môi trường và cấu hình hệ thống, giải thích bằng tiếng Việt dễ hiểu."""
    # GPU & VRAM
    gpu_info = {"has_gpu": False, "name": "Không có hoặc chưa cài driver", "vram_mb": 0, "status": "Dùng CPU"}
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            vram_bytes = torch.cuda.get_device_properties(0).total_memory
            vram_mb = int(vram_bytes / (1024 * 1024))
            gpu_info = {
                "has_gpu": True,
                "name": gpu_name,
                "vram_mb": vram_mb,
                "status": f"Sẵn sàng (Card {gpu_name} - {vram_mb} MB VRAM)"
            }
    except Exception:
        # Fallback nvidia-smi
        try:
            res = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"], stdout=subprocess.PIPE, text=True)
            if res.returncode == 0 and res.stdout.strip():
                parts = res.stdout.strip().split(",")
                gpu_info = {
                    "has_gpu": True,
                    "name": parts[0].strip(),
                    "vram_mb": int(parts[1].strip()),
                    "status": f"Sẵn sàng ({parts[0].strip()} - {parts[1].strip()} MB)"
                }
        except Exception:
            pass

    # FFmpeg & NVENC
    has_ffmpeg = shutil_which("ffmpeg") is not None
    has_nvenc = check_nvenc_support() if has_ffmpeg else False
    ffmpeg_status = "Đã cài đặt" if has_ffmpeg else "Chưa cài đặt (Cần cài để render video)"
    if has_nvenc:
        ffmpeg_status += " (Có hỗ trợ tăng tốc GPU NVENC siêu tốc)"

    # Kokoro TTS
    # Kiểm tra xem có file model kokoro không
    kokoro_ready = os.path.exists("models/kokoro/kokoro-v0_19.onnx")
    kokoro_status = "Đã có file weights model" if kokoro_ready else "Đang dùng chế độ tạo âm thanh mô phỏng (Đã sẵn sàng tải weights về máy nhà)"

    # Ollama
    ollama_ready = False
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=1)
        ollama_ready = (r.status_code == 200)
    except Exception:
        ollama_ready = False
    ollama_status = "Đang chạy (http://localhost:11434)" if ollama_ready else "Chưa bật (Bạn có thể tự điền/dán prompt tiếng Anh trên giao diện)"

    return {
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "python": sys.version.split()[0],
        "gpu": gpu_info,
        "ffmpeg": {"installed": has_ffmpeg, "nvenc": has_nvenc, "message": ffmpeg_status},
        "kokoro": {"ready": kokoro_ready, "message": kokoro_status},
        "ollama": {"ready": ollama_ready, "message": ollama_status}
    }

def shutil_which(cmd: str) -> Optional[str]:
    import shutil
    return shutil.which(cmd)
