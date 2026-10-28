import os
import sys
import argparse
from typing import Optional

# Thiết lập UTF-8 cho console Windows để in tiếng Việt chuẩn
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Thêm thư mục hiện tại vào sys.path để import core
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.tts_engine import process_tts
from core.scene_builder import build_scenes
from core.hash_utils import compute_file_hash, is_step_stale

def resolve_project_dir(project_name_or_path: str) -> str:
    """Xác định đường dẫn thư mục dự án."""
    if os.path.isabs(project_name_or_path) or os.path.exists(project_name_or_path):
        return os.path.abspath(project_name_or_path)
    # Tìm trong projects/
    proj_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "projects", project_name_or_path)
    return os.path.abspath(proj_dir)

def cli_progress_callback(percent: float, message: str, data: Optional[dict] = None):
    bar_len = 25
    filled = int(round(bar_len * percent))
    bar = "=" * filled + "-" * (bar_len - filled)
    pct_str = f"{int(percent * 100):3d}%"
    print(f"\r[{bar}] {pct_str} | {message}", end="", flush=True)
    if percent >= 1.0:
        print()

def cmd_tts(args):
    project_dir = resolve_project_dir(args.project)
    print(f"\n=== [BƯỚC 1: TTS & TIMELINE] - Dự án: {os.path.basename(project_dir)} ===")
    
    script_path = os.path.join(project_dir, "script.txt")
    if not os.path.exists(script_path):
        print(f"❌ Lỗi: Không tìm thấy file {script_path}")
        sys.exit(1)
        
    timeline_path = os.path.join(project_dir, "timeline.json")
    script_hash = compute_file_hash(script_path)
    
    if not args.force and not args.sentence and os.path.exists(timeline_path):
        if not is_step_stale(timeline_path, script_hash):
            print("✓ Bước TTS đã hoàn thành trước đó và file kịch bản không đổi. Dùng --force để ép chạy lại.")
            return

    try:
        data = process_tts(
            project_dir=project_dir,
            target_sentence_id=args.sentence,
            force=args.force,
            progress_callback=cli_progress_callback
        )
        print(f"✓ Đã xuất {len(data.sentences)} câu ra audio/ và {timeline_path}")
    except Exception as e:
        print(f"\n❌ Lỗi khi xử lý TTS: {e}")
        sys.exit(1)

def cmd_scenes(args):
    project_dir = resolve_project_dir(args.project)
    print(f"\n=== [BƯỚC 2: GỘP CẢNH] - Dự án: {os.path.basename(project_dir)} ===")
    
    timeline_path = os.path.join(project_dir, "timeline.json")
    if not os.path.exists(timeline_path):
        print(f"❌ Lỗi: Chưa có timeline.json. Hãy chạy lệnh 'python main.py tts --project {args.project}' trước.")
        sys.exit(1)
        
    timeline_hash = compute_file_hash(timeline_path)
    scenes_path = os.path.join(project_dir, "scenes.json")
    
    if not args.force and os.path.exists(scenes_path):
        if not is_step_stale(scenes_path, timeline_hash):
            print("✓ Bước Scenes đã hoàn thành trước đó và timeline không đổi. Dùng --force để ép chạy lại.")
            return

    try:
        data = build_scenes(
            project_dir=project_dir,
            target_min=args.min_duration,
            target_max=args.max_duration,
            force=args.force,
            progress_callback=cli_progress_callback
        )
        print(f"✓ Đã gom thành {data.total_scenes} cảnh, lưu tại {scenes_path}")
    except Exception as e:
        print(f"\n❌ Lỗi khi gộp cảnh: {e}")
        sys.exit(1)

def cmd_prompts(args):
    from core.prompt_generator import generate_prompts_template
    project_dir = resolve_project_dir(args.project)
    print(f"\n=== [BƯỚC 3: LỆNH SINH ẢNH] - Dự án: {os.path.basename(project_dir)} ===")
    try:
        data = generate_prompts_template(
            project_dir=project_dir,
            force=args.force,
            progress_callback=cli_progress_callback
        )
        print(f"✓ Đã tạo/cập nhật khung prompts.json ({len(data.prompts)} cảnh).")
        print("💡 Bạn có thể mở prompts.json hoặc giao diện web để dán lệnh tiếng Anh và bấm duyệt (approved).")
    except Exception as e:
        print(f"\n❌ Lỗi khi tạo prompts: {e}")
        sys.exit(1)

def cmd_images(args):
    from core.image_generator import generate_images
    project_dir = resolve_project_dir(args.project)
    print(f"\n=== [BƯỚC 4: SINH ẢNH] - Dự án: {os.path.basename(project_dir)} ===")
    try:
        data = generate_images(
            project_dir=project_dir,
            scene_id=args.scene,
            variants=args.variants or 1,
            force=args.force,
            ignore_approval=args.all,
            progress_callback=cli_progress_callback
        )
        print(f"✓ Đã xử lý ảnh cho {len(data.items)} cảnh tại thư mục images/")
    except Exception as e:
        print(f"\n❌ Lỗi khi sinh ảnh: {e}")
        sys.exit(1)

def cmd_render(args):
    from core.video_renderer import render_video
    project_dir = resolve_project_dir(args.project)
    print(f"\n=== [BƯỚC 5: XUẤT VIDEO MP4] - Dự án: {os.path.basename(project_dir)} ===")
    try:
        out_path = render_video(
            project_dir=project_dir,
            preview=args.preview,
            from_sec=args.from_sec,
            to_sec=args.to_sec,
            progress_callback=cli_progress_callback
        )
        print(f"\n🎉 Xuất video thành công: {out_path}")
    except Exception as e:
        print(f"\n❌ Lỗi khi render video: {e}")
        sys.exit(1)

def cmd_all(args):
    project_dir = resolve_project_dir(args.project)
    print(f"\n=======================================================")
    print(f"🚀 CHẠY TỰ ĐỘNG QUY TRÌNH - Dự án: {os.path.basename(project_dir)}")
    print(f"=======================================================\n")
    
    # Bước 1: TTS
    cmd_tts(args)
    # Bước 2: Scenes
    cmd_scenes(args)
    # Bước 3: Prompts
    cmd_prompts(args)
    
    # Kiểm tra xem các prompts đã được approved chưa
    prompts_path = os.path.join(project_dir, "prompts.json")
    all_approved = False
    if os.path.exists(prompts_path):
        import json
        with open(prompts_path, "r", encoding="utf-8") as f:
            p_data = json.load(f)
            items = p_data.get("prompts", [])
            all_approved = len(items) > 0 and all(p.get("status") == "approved" for p in items)
            
    if not all_approved and not getattr(args, "all", False):
        print("\n⏸️  ĐÃ DỪNG LẠI SAU BƯỚC PROMPTS ĐỂ BẠN DUYỆT:")
        print(f"👉 Vui lòng mở {prompts_path} hoặc giao diện web để duyệt/sửa prompts tiếng Anh.")
        print("👉 Sau khi duyệt xong (status: 'approved'), chạy lại 'python main.py all' hoặc 'python main.py images' để tiếp tục.")
        return

    # Nếu đã duyệt hoặc có cờ --all, làm tiếp images & render
    cmd_images(args)
    cmd_render(args)

def main():
    parser = argparse.ArgumentParser(description="Hệ thống làm video YouTube giải thích kiến thức kiểu Nguệch Ngoạc")
    subparsers = parser.add_subparsers(dest="command", required=True, help="Các bước xử lý")

    # tts
    p_tts = subparsers.add_parser("tts", help="Bước 1: Đọc kịch bản và xuất timeline mốc thời gian")
    p_tts.add_argument("--project", "-p", required=True, help="Tên hoặc đường dẫn thư mục dự án")
    p_tts.add_argument("--sentence", "-s", type=int, default=None, help="Chỉ sinh lại riêng một câu theo ID")
    p_tts.add_argument("--force", "-f", action="store_true", help="Bắt buộc chạy lại dù đã có đầu ra")

    # scenes
    p_scenes = subparsers.add_parser("scenes", help="Bước 2: Gộp câu thành cảnh (mục tiêu 5-12s)")
    p_scenes.add_argument("--project", "-p", required=True, help="Tên hoặc đường dẫn dự án")
    p_scenes.add_argument("--min-duration", type=float, default=None, help="Thời lượng tối thiểu mục tiêu một cảnh")
    p_scenes.add_argument("--max-duration", type=float, default=None, help="Thời lượng tối đa mục tiêu một cảnh")
    p_scenes.add_argument("--force", "-f", action="store_true", help="Ép gộp lại cảnh")

    # prompts
    p_prompts = subparsers.add_parser("prompts", help="Bước 3: Tạo khung lệnh sinh ảnh tiếng Anh để bạn điền/duyệt")
    p_prompts.add_argument("--project", "-p", required=True, help="Tên hoặc đường dẫn dự án")
    p_prompts.add_argument("--force", "-f", action="store_true", help="Tạo lại file prompts.json")

    # images
    p_images = subparsers.add_parser("images", help="Bước 4: Sinh ảnh từ các lệnh đã duyệt")
    p_images.add_argument("--project", "-p", required=True, help="Tên hoặc đường dẫn dự án")
    p_images.add_argument("--scene", type=int, default=None, help="Chỉ sinh lại một cảnh cụ thể")
    p_images.add_argument("--variants", type=int, default=1, help="Số biến thể ảnh sinh ra để chọn")
    p_images.add_argument("--all", action="store_true", help="Bỏ qua kiểm tra status approved, sinh cho tất cả")
    p_images.add_argument("--force", "-f", action="store_true", help="Ép sinh lại ảnh")

    # render
    p_render = subparsers.add_parser("render", help="Bước 5: Ghép video MP4 hoàn chỉnh với zoom, chuyển cảnh, phụ đề")
    p_render.add_argument("--project", "-p", required=True, help="Tên hoặc đường dẫn dự án")
    p_render.add_argument("--preview", action="store_true", help="Xuất video xem thử chất lượng thấp nhanh")
    p_render.add_argument("--from", dest="from_sec", type=float, default=None, help="Chỉ render từ giây thứ X")
    p_render.add_argument("--to", dest="to_sec", type=float, default=None, help="Chỉ render đến giây thứ Y")

    # all
    p_all = subparsers.add_parser("all", help="Chạy tự động các bước (dừng lại sau prompts để bạn duyệt)")
    p_all.add_argument("--project", "-p", required=True, help="Tên hoặc đường dẫn dự án")
    p_all.add_argument("--sentence", type=int, default=None)
    p_all.add_argument("--min-duration", type=float, default=None)
    p_all.add_argument("--max-duration", type=float, default=None)
    p_all.add_argument("--scene", type=int, default=None)
    p_all.add_argument("--variants", type=int, default=1)
    p_all.add_argument("--all", action="store_true", help="Bỏ qua dừng chờ duyệt prompt, làm trọn quy trình")
    p_all.add_argument("--preview", action="store_true")
    p_all.add_argument("--from", dest="from_sec", type=float, default=None)
    p_all.add_argument("--to", dest="to_sec", type=float, default=None)
    p_all.add_argument("--force", "-f", action="store_true")

    args = parser.parse_args()

    dispatch = {
        "tts": cmd_tts,
        "scenes": cmd_scenes,
        "prompts": cmd_prompts,
        "images": cmd_images,
        "render": cmd_render,
        "all": cmd_all
    }
    
    dispatch[args.command](args)

if __name__ == "__main__":
    main()
