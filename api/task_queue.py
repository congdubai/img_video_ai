import os
import sys
import asyncio
import uuid
import time
import traceback
from typing import Dict, Any, Optional, Callable, List
from pydantic import BaseModel

class TaskItem(BaseModel):
    task_id: str
    project_name: str
    step: str
    params: Dict[str, Any]
    status: str = "queued" # queued, running, completed, failed, cancelled
    percent: float = 0.0
    message: str = "Đang chờ trong hàng đợi..."
    data: Optional[Dict[str, Any]] = None
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None

class TaskQueue:
    """
    Hàng đợi tác vụ nền:
    - Đảm bảo chỉ DUY NHẤT 1 tác vụ GPU/nặng chạy tại một thời điểm
    - Tối ưu giải phóng VRAM cho GPU (RTX 4050 6GB) ngay khi xong hoặc hủy
    - Báo tiến độ thời gian thực qua callback/WebSockets
    """
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.tasks: Dict[str, TaskItem] = {}
        self.current_task: Optional[TaskItem] = None
        self.active_websockets: List[Any] = []
        self._worker_task: Optional[asyncio.Task] = None
        self._cancel_requested: bool = False

    def start(self):
        if self._worker_task is None:
            self._worker_task = asyncio.create_task(self._worker_loop())

    async def register_ws(self, websocket):
        self.active_websockets.append(websocket)

    def unregister_ws(self, websocket):
        if websocket in self.active_websockets:
            self.active_websockets.remove(websocket)

    async def broadcast_progress(self, task: TaskItem):
        msg = {
            "type": "progress",
            "task_id": task.task_id,
            "project_name": task.project_name,
            "step": task.step,
            "status": task.status,
            "percent": task.percent,
            "message": task.message,
            "data": task.data,
            "error": task.error
        }
        dead_ws = []
        for ws in self.active_websockets:
            try:
                await ws.send_json(msg)
            except Exception:
                dead_ws.append(ws)
        for ws in dead_ws:
            self.unregister_ws(ws)

    def enqueue(self, project_name: str, step: str, params: Dict[str, Any]) -> TaskItem:
        task_id = str(uuid.uuid4())[:8]
        task = TaskItem(
            task_id=task_id,
            project_name=project_name,
            step=step,
            params=params,
            created_at=time.time()
        )
        self.tasks[task_id] = task
        self.queue.put_nowait(task)
        return task

    def cancel_task(self, task_id: str) -> bool:
        if task_id not in self.tasks:
            return False
        task = self.tasks[task_id]
        if task.status == "queued":
            task.status = "cancelled"
            task.message = "Đã hủy khi đang trong hàng đợi."
            task.completed_at = time.time()
            asyncio.create_task(self.broadcast_progress(task))
            return True
        elif task.status == "running":
            self._cancel_requested = True
            task.status = "cancelled"
            task.message = "Đã yêu cầu hủy tác vụ đang chạy..."
            task.completed_at = time.time()
            asyncio.create_task(self.broadcast_progress(task))
            self.free_gpu_vram()
            return True
        return False

    def free_gpu_vram(self):
        """Giải phóng triệt để VRAM cho GPU."""
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass
        import gc
        gc.collect()

    async def _worker_loop(self):
        while True:
            task: TaskItem = await self.queue.get()
            if task.status == "cancelled":
                self.queue.task_done()
                continue

            self.current_task = task
            self._cancel_requested = False
            task.status = "running"
            task.started_at = time.time()
            task.message = f"Bắt đầu thực hiện bước {task.step.upper()}..."
            await self.broadcast_progress(task)

            # Hàm callback cập nhật tiến độ
            def sync_progress_callback(percent: float, message: str, data: Optional[Dict[str, Any]] = None):
                if self._cancel_requested:
                    raise asyncio.CancelledError("Tác vụ đã bị người dùng hủy.")
                task.percent = round(percent, 3)
                task.message = message
                task.data = data
                asyncio.run_coroutine_threadsafe(self.broadcast_progress(task), asyncio.get_event_loop())

            try:
                # Chạy task trong thread pool để không block asyncio loop
                await asyncio.to_thread(self._execute_step, task, sync_progress_callback)
                if not self._cancel_requested:
                    task.status = "completed"
                    task.percent = 1.0
                    task.message = f"Hoàn thành xuất sắc bước {task.step.upper()}!"
                    task.completed_at = time.time()
            except asyncio.CancelledError:
                task.status = "cancelled"
                task.message = "Tác vụ đã được hủy thành công."
                task.completed_at = time.time()
            except Exception as e:
                task.status = "failed"
                task.error = str(e)
                task.message = f"Lỗi ở bước {task.step}: {e}"
                task.completed_at = time.time()
                traceback.print_exc()
            finally:
                # Luôn giải phóng VRAM sau mỗi tác vụ dù thành công hay lỗi
                self.free_gpu_vram()
                await self.broadcast_progress(task)
                self.current_task = None
                self.queue.task_done()

    def _execute_step(self, task: TaskItem, progress_cb: Callable):
        from core.tts_engine import process_tts
        from core.scene_builder import build_scenes
        from core.prompt_generator import generate_prompts_template
        from core.image_generator import generate_images
        from core.video_renderer import render_video

        project_dir = os.path.abspath(os.path.join("projects", task.project_name))
        step = task.step
        p = task.params

        if step == "tts":
            process_tts(
                project_dir=project_dir,
                target_sentence_id=p.get("sentence_id"),
                force=p.get("force", False),
                progress_callback=progress_cb
            )
        elif step == "scenes":
            build_scenes(
                project_dir=project_dir,
                target_min=p.get("min_duration"),
                target_max=p.get("max_duration"),
                force=p.get("force", False),
                progress_callback=progress_cb
            )
        elif step == "prompts":
            generate_prompts_template(
                project_dir=project_dir,
                force=p.get("force", False),
                progress_callback=progress_cb
            )
        elif step == "images":
            generate_images(
                project_dir=project_dir,
                scene_id=p.get("scene_id"),
                variants=p.get("variants", 1),
                force=p.get("force", False),
                ignore_approval=p.get("all", False),
                progress_callback=progress_cb
            )
        elif step == "render":
            render_video(
                project_dir=project_dir,
                preview=p.get("preview", False),
                from_sec=p.get("from_sec"),
                to_sec=p.get("to_sec"),
                progress_callback=progress_cb
            )
        elif step == "all":
            # Chạy tự động: tts -> scenes -> prompts
            progress_cb(0.1, "Bước 1/3: Đang tạo TTS & timeline...")
            process_tts(project_dir=project_dir, force=p.get("force", False), progress_callback=progress_cb)
            
            progress_cb(0.4, "Bước 2/3: Đang gộp câu thành cảnh...")
            build_scenes(project_dir=project_dir, force=p.get("force", False), progress_callback=progress_cb)
            
            progress_cb(0.7, "Bước 3/3: Đang tạo khung prompts...")
            generate_prompts_template(project_dir=project_dir, force=p.get("force", False), progress_callback=progress_cb)
            
            progress_cb(1.0, "Đã xong 3 bước đầu. Hãy duyệt prompts trên giao diện để sinh tiếp ảnh & video!")
        else:
            raise ValueError(f"Không nhận diện được bước: {step}")

# Khởi tạo singleton task_queue
task_queue = TaskQueue()
