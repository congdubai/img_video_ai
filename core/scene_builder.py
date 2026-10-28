import os
from typing import List, Optional, Callable, Dict, Any

from core.models import TimelineData, Scene, ScenesData
from core.hash_utils import compute_file_hash, atomic_write_json
from core.config import load_project_config

def build_scenes(
    project_dir: str,
    target_min: Optional[float] = None,
    target_max: Optional[float] = None,
    force: bool = False,
    progress_callback: Optional[Callable[[float, str, Optional[Dict[str, Any]]], None]] = None
) -> ScenesData:
    """
    Thực hiện Bước 2 (Scenes):
    - Đọc timeline.json
    - Gộp các câu liên tiếp thành cảnh dài mục tiêu 5 đến 12 giây (hoặc cấu hình)
    - TUYỆT ĐỐI KHÔNG tách một câu thành hai cảnh
    - Tạo scenes.json kèm source_fingerprint của timeline.json
    """
    config = load_project_config(project_dir)
    scenes_cfg = config.get("scenes", {})
    min_dur = target_min or scenes_cfg.get("target_min_duration", 5.0)
    max_dur = target_max or scenes_cfg.get("target_max_duration", 12.0)
    
    timeline_path = os.path.join(project_dir, "timeline.json")
    if not os.path.exists(timeline_path):
        raise FileNotFoundError(f"Chưa có timeline.json. Vui lòng chạy bước TTS trước: {timeline_path}")
        
    timeline_hash = compute_file_hash(timeline_path)
    scenes_path = os.path.join(project_dir, "scenes.json")
    
    with open(timeline_path, "r", encoding="utf-8") as f:
        timeline_data = TimelineData.model_validate_json(f.read())
        
    sentences = timeline_data.sentences
    if not sentences:
        raise ValueError("timeline.json không chứa câu nào.")
        
    if progress_callback:
        progress_callback(0.1, f"Bắt đầu gom {len(sentences)} câu thành các cảnh (mục tiêu {min_dur}s - {max_dur}s)...", None)
        
    scenes_list: List[Scene] = []
    
    current_sentences = []
    current_scene_id = 1
    
    for i, s in enumerate(sentences):
        current_sentences.append(s)
        
        # Tính thời lượng hiện tại của cụm câu này
        group_start = current_sentences[0].start
        group_end = current_sentences[-1].end + current_sentences[-1].silence_after
        group_duration = round(group_end - group_start, 3)
        
        is_last = (i == len(sentences) - 1)
        
        if is_last:
            # Câu cuối cùng -> Đóng cảnh ngay
            scene_text = " ".join([cs.text for cs in current_sentences])
            scenes_list.append(Scene(
                scene_id=current_scene_id,
                start=round(group_start, 3),
                end=round(group_end, 3),
                duration=round(group_duration, 3),
                sentence_ids=[cs.id for cs in current_sentences],
                text=scene_text
            ))
            break
            
        # Xem trước câu tiếp theo
        next_s = sentences[i + 1]
        pot_duration = (next_s.end + next_s.silence_after) - group_start
        
        # Quyết định đóng cảnh nếu:
        # 1. Thời lượng hiện tại đã đạt tối thiểu (>= min_dur) VÀ nếu thêm câu tiếp theo sẽ vượt quá max_dur
        # 2. Hoặc thời lượng hiện tại đã chạm hoặc vượt max_dur (trường hợp câu dài)
        if group_duration >= min_dur and pot_duration > max_dur:
            scene_text = " ".join([cs.text for cs in current_sentences])
            scenes_list.append(Scene(
                scene_id=current_scene_id,
                start=round(group_start, 3),
                end=round(group_end, 3),
                duration=round(group_duration, 3),
                sentence_ids=[cs.id for cs in current_sentences],
                text=scene_text
            ))
            current_scene_id += 1
            current_sentences = []
        elif group_duration >= max_dur:
            scene_text = " ".join([cs.text for cs in current_sentences])
            scenes_list.append(Scene(
                scene_id=current_scene_id,
                start=round(group_start, 3),
                end=round(group_end, 3),
                duration=round(group_duration, 3),
                sentence_ids=[cs.id for cs in current_sentences],
                text=scene_text
            ))
            current_scene_id += 1
            current_sentences = []

    # Đảm bảo cảnh cuối cùng khớp với tổng thời lượng audio
    if scenes_list:
        scenes_list[-1].end = timeline_data.total_duration
        scenes_list[-1].duration = round(scenes_list[-1].end - scenes_list[-1].start, 3)

    scenes_data = ScenesData(
        source_fingerprint=timeline_hash or "",
        total_scenes=len(scenes_list),
        scenes=scenes_list
    )
    
    atomic_write_json(scenes_path, scenes_data.model_dump())
    
    if progress_callback:
        progress_callback(1.0, f"Đã gộp thành {len(scenes_list)} cảnh thành công!", {"total_scenes": len(scenes_list)})
        
    return scenes_data
