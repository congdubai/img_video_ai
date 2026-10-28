import os
import sys

# Thiết lập UTF-8 cho console Windows
if sys.platform == "win32":
    import io
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Thêm đường dẫn gốc vào sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.task_queue import task_queue
from api.routes_projects import router as projects_router
from api.routes_jobs import router as jobs_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi động worker loop cho hàng đợi tác vụ GPU
    task_queue.start()
    yield
    # Dọn dẹp VRAM khi tắt server
    task_queue.free_gpu_vram()

app = FastAPI(
    title="Hệ thống làm video YouTube Nguệch Ngoạc API",
    description="API cung cấp dịch vụ tổng hợp giọng đọc, gom cảnh, sinh ảnh và render video MP4 phong cách doodle",
    version="1.0.0",
    lifespan=lifespan
)

# Cấu hình CORS để frontend React / Vite kết nối mượt mà từ localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép localhost:5173 và các cổng dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các router
app.include_router(projects_router)
app.include_router(jobs_router)

@app.websocket("/api/ws/progress")
async def websocket_progress_endpoint(websocket: WebSocket):
    """WebSocket stream tiến độ phần trăm, log, lỗi từng cảnh trong thời gian thực."""
    await websocket.accept()
    await task_queue.register_ws(websocket)
    try:
        while True:
            # Lắng nghe ping/pong từ frontend
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        task_queue.unregister_ws(websocket)
    except Exception:
        task_queue.unregister_ws(websocket)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "nguech_ngoac_core_api"}
