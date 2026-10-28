import os
import re
from typing import Optional, Callable, Dict, Any, List

from core.models import ScenesData, PromptItem, PromptsData
from core.hash_utils import compute_file_hash, atomic_write_json
from core.config import load_project_config

def suggest_doodle_prompt(vietnamese_text: str, scene_id: int) -> str:
    """
    Gợi ý lệnh tiếng Anh phong cách doodle đơn giản cho nhân vật đầu tròn
    dựa trên ngữ cảnh câu thoại tiếng Việt để làm điểm xuất phát cho người dùng.
    """
    txt_lower = vietnamese_text.lower()
    
    # Một số từ khóa thông dụng để gợi ý hành động/bối cảnh doodle
    if any(k in txt_lower for k in ["bầu trời", "màu xanh", "mặt trời", "ánh sáng", "cầu vồng"]):
        return "round white head character looking up at the bright sky and sun, pointing finger at the blue atmosphere, simple stick figure"
    elif any(k in txt_lower for k in ["tại sao", "câu hỏi", "thắc mắc", "nghĩ"]):
        return "curious round white head stick figure with a giant question mark floating above head, scratching chin thoughtfully"
    elif any(k in txt_lower for k in ["bước sóng", "đỏ", "xanh lam", "tím", "ngắn nhất", "dài nhất"]):
        return "round white head character holding a magnifying glass examining colorful wave lines, scientific doodle chart"
    elif any(k in txt_lower for k in ["khí quyển", "oxy", "nitơ", "phân tử", "tán xạ"]):
        return "round white head character surrounded by floating tiny bouncing particles, air molecules doodle concept"
    elif any(k in txt_lower for k in ["mắt", "nhìn thấy", "nhạy cảm", "dịu mát"]):
        return "happy round white head character wearing cool sunglasses, wide cheerful smile, thumbs up doodle"
    else:
        return f"round white head stick figure explaining concept scene {scene_id}, expressive doodle gesture"

def extract_overlay_title(vietnamese_text: str) -> str:
    """Đề xuất chữ tiêu đề ngắn gọn (overlay_text) nếu có cụm từ nổi bật."""
    txt = vietnamese_text.strip()
    if "tại sao bầu trời" in txt.lower():
        return "TẠI SAO BẦU TRỜI XANH?"
    if "bảy sắc cầu vồng" in txt.lower():
        return "7 SẮC CẦU VỒNG"
    if "tán xạ rayleigh" in txt.lower():
        return "TÁN XẠ RAYLEIGH"
    return ""

def generate_prompts_template(
    project_dir: str,
    force: bool = False,
    progress_callback: Optional[Callable[[float, str, Optional[Dict[str, Any]]], None]] = None
) -> PromptsData:
    """
    Thực hiện Bước 3 (Prompts):
    - Đọc scenes.json
    - Tạo khung prompts.json: scene_id, scene_type, prompt_en, overlay_text, status='draft'
    - Lưu giữ lại các prompt_en và status mà người dùng đã sửa/duyệt trước đó nếu đã có file
    - Lưu source_fingerprint của scenes.json
    """
    config = load_project_config(project_dir)
    p_cfg = config.get("prompts", {})
    style_prefix = p_cfg.get("style_prefix", "")
    negative_prompt = p_cfg.get("negative_prompt", "")
    
    scenes_path = os.path.join(project_dir, "scenes.json")
    if not os.path.exists(scenes_path):
        raise FileNotFoundError(f"Chưa có scenes.json. Vui lòng chạy bước Scenes trước: {scenes_path}")
        
    scenes_hash = compute_file_hash(scenes_path)
    prompts_path = os.path.join(project_dir, "prompts.json")
    
    with open(scenes_path, "r", encoding="utf-8") as f:
        scenes_data = ScenesData.model_validate_json(f.read())
        
    existing_items_map = {}
    if os.path.exists(prompts_path) and not force:
        try:
            with open(prompts_path, "r", encoding="utf-8") as f:
                old_p = PromptsData.model_validate_json(f.read())
                for item in old_p.prompts:
                    existing_items_map[item.scene_id] = item
        except Exception:
            pass

    prompt_items: List[PromptItem] = []
    total = len(scenes_data.scenes)
    
    if progress_callback:
        progress_callback(0.1, f"Bắt đầu tạo khung lệnh ảnh cho {total} cảnh...", None)

    for idx, sc in enumerate(scenes_data.scenes, start=1):
        if sc.scene_id in existing_items_map:
            # Giữ nguyên prompt và status người dùng đã nhập
            item = existing_items_map[sc.scene_id]
        else:
            # Tạo mới gợi ý ban đầu
            prompt_en = suggest_doodle_prompt(sc.text, sc.scene_id)
            overlay = extract_overlay_title(sc.text)
            item = PromptItem(
                scene_id=sc.scene_id,
                scene_type="character",
                prompt_en=prompt_en,
                overlay_text=overlay,
                status="draft"
            )
        prompt_items.append(item)
        if progress_callback:
            progress_callback(0.1 + 0.8 * (idx / total), f"Khung cảnh {sc.scene_id}/{total}", {"scene_id": sc.scene_id})

    prompts_data = PromptsData(
        source_fingerprint=scenes_hash or "",
        style_prefix=style_prefix,
        negative_prompt=negative_prompt,
        prompts=prompt_items
    )
    
    atomic_write_json(prompts_path, prompts_data.model_dump())
    
    if progress_callback:
        progress_callback(1.0, f"Đã chuẩn bị khung prompts.json ({total} cảnh). Bạn có thể duyệt hoặc sửa lệnh!", {"total": total})
        
    return prompts_data
