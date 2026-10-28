import os
import sys
import time
import subprocess
import webbrowser
import threading

def start_backend():
    print("[Backend] Đang khởi động FastAPI tại http://127.0.0.1:8000...")
    # Chạy uvicorn
    import uvicorn
    uvicorn.run("api.app:app", host="127.0.0.1", port=8000, log_level="info")

def start_frontend():
    print("[Frontend] Đang khởi động Vite React tại http://127.0.0.1:5173...")
    web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
    # Trên Windows, chạy npm qua cmd.exe để tránh execution policy
    cmd = "cmd.exe /c npm run dev -- --host 127.0.0.1 --port 5173"
    proc = subprocess.Popen(cmd, cwd=web_dir, shell=True)
    return proc

def main():
    print("=============================================================")
    print("   HỆ THỐNG LÀM VIDEO YOUTUBE NGUỆCH NGOẠC (LOCAL STUDIO)    ")
    print("=============================================================\n")

    # 1. Chạy Backend trong background thread
    t_back = threading.Thread(target=start_backend, daemon=True)
    t_back.start()

    # 2. Chạy Frontend Vite
    proc_front = start_frontend()

    # Chờ 2.5 giây cho 2 server lắng nghe cổng
    time.sleep(2.5)
    url = "http://127.0.0.1:5173"
    print(f"\n🚀 Đang mở trình duyệt tại: {url}")
    webbrowser.open(url)

    print("\n👉 Hệ thống đang hoạt động! Nhấn Ctrl + C để dừng lại bất kỳ lúc nào.\n")

    try:
        proc_front.wait()
    except KeyboardInterrupt:
        print("\n[Đang tắt] Đang đóng hệ thống và giải phóng tài nguyên...")
        proc_front.terminate()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass
        print("✓ Đã tắt an toàn.")

if __name__ == "__main__":
    main()
