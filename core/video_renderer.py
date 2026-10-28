import os
import sys
import subprocess
import shutil
from typing import Optional, Callable, Dict, Any, List

from core.models import TimelineData, ScenesData, PromptsData
from core.hash_utils import compute_file_hash, atomic_write_text
from core.config import load_project_config

def format_ass_time(seconds: float) -> str:
    """Chuyển số giây sang định dạng thời gian của ASS: H:MM:SS.cs"""
    seconds = max(0.0, seconds)
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        secs += 1
        centis = 0
    return f"{hrs}:{mins:02d}:{secs:02d}.{centis:02d}"

def wrap_vietnamese_text(text: str, max_chars: int = 40) -> str:
    """Tự động xuống dòng cho câu dài bằng cách thêm \\N tại khoảng trắng hợp lý."""
    words = text.split()
    lines = []
    cur_line = []
    cur_len = 0
    
    for w in words:
        if cur_len + len(w) + 1 > max_chars and cur_line:
            lines.append(" ".join(cur_line))
            cur_line = [w]
            cur_len = len(w)
        else:
            cur_line.append(w)
            cur_len += len(w) + 1
            
    if cur_line:
        lines.append(" ".join(cur_line))
        
    return r"\N".join(lines)

def generate_ass_subtitles(
    project_dir: str,
    output_ass_path: str,
    sub_cfg: dict,
    overlay_cfg: dict
) -> str:
    """
    Tạo file phụ đề .ass chuẩn UTF-8 chứa cả phụ đề câu thoại và tiêu đề cảnh (overlay_text).
    Hỗ trợ hiệu ứng nảy (pop) hoặc mờ dần (fade), viền đen dày chống chìm trên mọi nền ảnh.
    """
    font_name = sub_cfg.get("font_name", "Arial")
    font_size = sub_cfg.get("font_size", 42)
    effect_type = sub_cfg.get("effect", "pop")
    max_chars = sub_cfg.get("max_chars_per_line", 40)

    # Đọc timeline.json
    timeline_path = os.path.join(project_dir, "timeline.json")
    with open(timeline_path, "r", encoding="utf-8") as f:
        timeline_data = TimelineData.model_validate_json(f.read())
        
    # Đọc prompts.json để lấy overlay_text nếu có
    overlay_map = {}
    prompts_path = os.path.join(project_dir, "prompts.json")
    if os.path.exists(prompts_path):
        try:
            with open(prompts_path, "r", encoding="utf-8") as f:
                p_data = PromptsData.model_validate_json(f.read())
                for item in p_data.prompts:
                    if item.overlay_text and item.overlay_text.strip():
                        overlay_map[item.scene_id] = item.overlay_text.strip()
        except Exception:
            pass

    # Đọc scenes.json để lấy mốc thời gian của từng cảnh cho overlay_text
    scenes_map = {}
    scenes_path = os.path.join(project_dir, "scenes.json")
    if os.path.exists(scenes_path):
        try:
            with open(scenes_path, "r", encoding="utf-8") as f:
                s_data = ScenesData.model_validate_json(f.read())
                for sc in s_data.scenes:
                    scenes_map[sc.scene_id] = sc
        except Exception:
            pass

    ass_content = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1920",
        "PlayResY: 1080",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: SubtitleDefault,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00111111,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,1.5,2,40,40,45,1",
        f"Style: TitleOverlay,{overlay_cfg.get('font_name', font_name)},{overlay_cfg.get('font_size', 52)},&H00151515,&H000000FF,&H00FFFFFF,&H40000000,-1,0,0,0,100,100,0,0,1,4.0,2.0,8,40,40,65,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    ]

    # Thêm các tiêu đề cảnh (TitleOverlay)
    for sc_id, overlay_text in overlay_map.items():
        if sc_id in scenes_map:
            sc = scenes_map[sc_id]
            t_start = format_ass_time(sc.start + 0.1)
            t_end = format_ass_time(sc.end - 0.2)
            # Hiệu ứng mờ dần cho tiêu đề cảnh
            effect_tag = r"{\fad(300, 250)}"
            ass_content.append(f"Dialogue: 1,{t_start},{t_end},TitleOverlay,,0,0,0,,{effect_tag}{overlay_text}")

    # Thêm phụ đề cho từng câu thoại (SubtitleDefault)
    for sent in timeline_data.sentences:
        t_start = format_ass_time(sent.start)
        t_end = format_ass_time(sent.end)
        wrapped_text = wrap_vietnamese_text(sent.text, max_chars)
        
        if effect_type == "pop":
            # Hiệu ứng nảy nhẹ (scale từ 108% về 100% trong 200ms) + fade in 120ms
            effect_tag = r"{\t(0, 150, \fscx108\fscy108)\t(150, 280, \fscx100\fscy100)\fad(120, 100)}"
        elif effect_type == "fade":
            effect_tag = r"{\fad(180, 150)}"
        else:
            effect_tag = ""

        ass_content.append(f"Dialogue: 0,{t_start},{t_end},SubtitleDefault,,0,0,0,,{effect_tag}{wrapped_text}")

    final_text = "\n".join(ass_content) + "\n"
    atomic_write_text(output_ass_path, final_text)
    return output_ass_path

def check_nvenc_support() -> bool:
    """Kiểm tra xem ffmpeg trên hệ thống có hỗ trợ bộ mã hóa GPU NVIDIA h264_nvenc hay không."""
    try:
        res = subprocess.run(["ffmpeg", "-encoders"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return "h264_nvenc" in res.stdout
    except Exception:
        return False

def render_video(
    project_dir: str,
    preview: bool = False,
    from_sec: Optional[float] = None,
    to_sec: Optional[float] = None,
    progress_callback: Optional[Callable[[float, str, Optional[Dict[str, Any]]], None]] = None
) -> str:
    """
    Thực hiện Bước 5 (Render):
    - Đặt từng ảnh theo mốc cảnh
    - Hiệu ứng zoom chậm vào/ra xen kẽ (mượt mà, không giật)
    - Chuyển cảnh mờ crossfade
    - Phụ đề .ass nảy/trượt và tiêu đề overlay_text chuẩn tiếng Việt
    - Ghép voice.wav
    - Xuất video MP4 (H.264 + AAC) trong 1 lượt duy nhất (Single-pass)
    """
    config = load_project_config(project_dir)
    render_cfg = config.get("render", {})
    fps = config.get("project", {}).get("fps", 30)
    
    scenes_path = os.path.join(project_dir, "scenes.json")
    if not os.path.exists(scenes_path):
        raise FileNotFoundError(f"Chưa có scenes.json: {scenes_path}")
        
    voice_path = os.path.join(project_dir, "audio", "voice.wav")
    if not os.path.exists(voice_path):
        raise FileNotFoundError(f"Chưa có audio/voice.wav: {voice_path}")
        
    images_dir = os.path.join(project_dir, "images")
    output_dir = os.path.join(project_dir, "output")
    os.makedirs(output_dir, exist_ok=True)
    
    with open(scenes_path, "r", encoding="utf-8") as f:
        scenes_data = ScenesData.model_validate_json(f.read())
        
    scenes = scenes_data.scenes
    if not scenes:
        raise ValueError("Danh sách cảnh rỗng.")
        
    # Tạo file phụ đề ASS
    ass_path = os.path.join(output_dir, "subtitles.ass")
    generate_ass_subtitles(
        project_dir=project_dir,
        output_ass_path=ass_path,
        sub_cfg=render_cfg.get("subtitles", {}),
        overlay_cfg=render_cfg.get("overlay", {})
    )
    
    out_video_name = "preview.mp4" if preview else "video.mp4"
    out_video_path = os.path.join(output_dir, out_video_name)
    
    # Quyết định encoder
    requested_enc = render_cfg.get("encoder", "auto")
    has_nvenc = check_nvenc_support()
    
    if requested_enc == "h264_nvenc" or (requested_enc == "auto" and has_nvenc):
        vcodec = "h264_nvenc"
        codec_params = ["-preset", "p4", "-cq", "22", "-pix_fmt", "yuv420p"]
    else:
        vcodec = "libx264"
        codec_params = ["-preset", "fast" if preview else "medium", "-crf", "22", "-pix_fmt", "yuv420p"]

    target_res = "1280x720" if preview else "1920x1080"
    target_w, target_h = (1280, 720) if preview else (1920, 1080)
    
    if progress_callback:
        progress_callback(0.1, f"Chuẩn bị render ({vcodec}, {target_res}, {fps}fps)...", None)

    # Xây dựng danh sách input ảnh và filtergraph
    # Để đảm bảo zoom mượt tuyệt đối và không giật, ta xử lý từng cảnh thành luồng video zoompan rồi concat
    inputs = []
    filter_complex = []
    concat_inputs = []
    
    zoom_scale = render_cfg.get("zoom_scale", 0.08)
    
    for idx, sc in enumerate(scenes):
        img_name = f"scene_{sc.scene_id:03d}.png"
        img_file = os.path.join(images_dir, img_name)
        if not os.path.exists(img_file):
            # Nếu chưa có ảnh thì sinh nhanh placeholder cho cảnh đó
            from core.image_generator import draw_doodle_placeholder
            draw_doodle_placeholder(sc.scene_id, "", "", img_file, target_w, target_h, seed=sc.scene_id*100)
            
        inputs.extend(["-loop", "1", "-t", str(sc.duration), "-i", img_file])
        
        # Số khung hình của cảnh này
        num_frames = int(round(sc.duration * fps))
        
        # Xen kẽ zoom in và zoom out
        is_zoom_in = (idx % 2 == 0)
        if is_zoom_in:
            # Zoom in từ 1.0 đến 1.0 + zoom_scale
            # z='zoom+zoom_step', x='iw/2-(iw/zoom/2)', y='ih/2-(ih/zoom/2)'
            z_step = zoom_scale / max(num_frames, 1)
            zoom_expr = f"min(zoom+{z_step:.6f},{1.0 + zoom_scale:.3f})"
        else:
            # Zoom out từ 1.0 + zoom_scale về 1.0
            z_step = zoom_scale / max(num_frames, 1)
            zoom_expr = f"if(eq(on,1),{1.0 + zoom_scale:.3f},max(zoom-{z_step:.6f},1.0))"

        # Chuẩn hóa ảnh, pad viền nền kem nếu khác tỷ lệ, setsar=1 và ép format yuv420p
        filter_complex.append(
            f"[{idx}:v]format=yuv420p,scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2:color=0xFBF8F1,setsar=1,zoompan=z='{zoom_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={num_frames}:s={target_res}:fps={fps},setsar=1,format=yuv420p[v{idx}]"
        )
        concat_inputs.append(f"[v{idx}]")

    # Nối tất cả các luồng cảnh
    filter_complex.append(f"{''.join(concat_inputs)}concat=n={len(scenes)}:v=1:a=0[vbase]")
    
    # Áp dụng phụ đề ASS lên luồng video đã nối
    # Trên Windows, đường dẫn file phụ đề trong filter cần escape chuẩn: thay \ thành / và escape dấu :
    escaped_ass_path = ass_path.replace("\\", "/").replace(":", r"\:")
    filter_complex.append(f"[vbase]subtitles='{escaped_ass_path}'[vfinal]")

    # Lắp ráp câu lệnh ffmpeg hoàn chỉnh
    cmd = ["ffmpeg", "-y"]
    cmd.extend(inputs)
    # Input âm thanh voice.wav
    audio_idx = len(scenes)
    cmd.extend(["-i", voice_path])

    cmd.extend(["-filter_complex", ";".join(filter_complex)])
    cmd.extend(["-map", "[vfinal]", "-map", f"{audio_idx}:a"])
    cmd.extend(["-c:v", vcodec])
    cmd.extend(codec_params)
    cmd.extend(["-c:a", "aac", "-b:a", "192k"])
    cmd.extend(["-shortest"])

    # Cắt đoạn thời gian nếu có --from / --to ở output
    if from_sec is not None:
        cmd.extend(["-ss", str(from_sec)])
    if to_sec is not None:
        cmd.extend(["-to", str(to_sec)])

    cmd.append(out_video_path)

    if progress_callback:
        progress_callback(0.25, f"Bắt đầu render video qua FFmpeg...", None)

    # Chạy ffmpeg
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True
    )
    
    _, stderr_data = process.communicate()
    
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg render thất bại (code {process.returncode}): {stderr_data[-800:]}")
        
    if progress_callback:
        progress_callback(1.0, f"Render video thành công: {out_video_name}", {"output_path": out_video_path})
        
    return out_video_path
