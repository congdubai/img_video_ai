import os
import random
import time
import json
import math
from typing import Optional, Callable, Dict, Any, List
from PIL import Image, ImageDraw, ImageFont

from core.models import PromptsData, ImagesData, ImageMetaItem
from core.hash_utils import compute_file_hash, atomic_write_json
from core.config import load_project_config

def math_rad(deg: float) -> float:
    return math.radians(deg)

def math_cos(rad: float) -> float:
    return math.cos(rad)

def math_sin(rad: float) -> float:
    return math.sin(rad)

def draw_doodle_placeholder(
    scene_id: int,
    prompt_en: str,
    overlay_text: str,
    output_path: str,
    width: int = 1920,
    height: int = 1080,
    seed: int = 42
) -> str:
    """
    Vẽ ảnh phong cách Nguệch Ngoạc tối giản (Doodle Cartoon):
    - Nền kem nhạt ấm áp (#FBF8F1)
    - Nhân vật người que đầu tròn màu trắng với viền đen dày
    - Biểu cảm vui nhộn, khung viền vẽ tay
    - Đánh số cảnh và dòng prompt
    Độ phân giải mặc định 1920x1080 (hoặc cao hơn) giúp zoom không bị vỡ.
    """
    rng = random.Random(seed)
    img = Image.new("RGBA", (width, height), (251, 248, 241, 255))
    draw = ImageDraw.Draw(img)

    # Khung viền ngoài nét đậm kiểu vẽ tay (doodle frame)
    margin = int(width * 0.03)
    draw.rectangle(
        [(margin, margin), (width - margin, height - margin)],
        outline=(30, 30, 30, 255),
        width=6
    )

    # Vẽ nhân vật đầu tròn trắng ở trung tâm lệch nhẹ
    cx = int(width * (0.42 + rng.uniform(-0.04, 0.04)))
    cy = int(height * 0.48)
    head_r = int(height * 0.16)

    # Thân người que (Stick body)
    body_bottom = cy + head_r + int(height * 0.18)
    draw.line([(cx, cy + head_r), (cx, body_bottom)], fill=(30, 30, 30, 255), width=8)

    # 2 chân
    leg_len = int(height * 0.12)
    draw.line([(cx, body_bottom), (cx - int(head_r * 0.6), body_bottom + leg_len)], fill=(30, 30, 30, 255), width=8)
    draw.line([(cx, body_bottom), (cx + int(head_r * 0.6), body_bottom + leg_len)], fill=(30, 30, 30, 255), width=8)

    # 2 tay (doodle gesture)
    arm_y = cy + head_r + int(height * 0.06)
    hand_dx1 = -int(head_r * 1.1)
    hand_dy1 = -int(height * 0.05) if rng.random() > 0.5 else int(height * 0.05)
    hand_dx2 = int(head_r * 1.1)
    hand_dy2 = -int(height * 0.08) # Giơ tay chỉ trỏ
    draw.line([(cx, arm_y), (cx + hand_dx1, arm_y + hand_dy1)], fill=(30, 30, 30, 255), width=8)
    draw.line([(cx, arm_y), (cx + hand_dx2, arm_y + hand_dy2)], fill=(30, 30, 30, 255), width=8)

    # Đầu tròn màu trắng với viền đen dày
    draw.ellipse(
        [(cx - head_r, cy - head_r), (cx + head_r, cy + head_r)],
        fill=(255, 255, 255, 255),
        outline=(30, 30, 30, 255),
        width=8
    )

    # Mắt hoạt hình (2 chấm tròn đen)
    eye_offset_x = int(head_r * 0.32)
    eye_y = cy - int(head_r * 0.1)
    eye_r = int(head_r * 0.12)
    draw.ellipse([(cx - eye_offset_x - eye_r, eye_y - eye_r), (cx - eye_offset_x + eye_r, eye_y + eye_r)], fill=(30, 30, 30, 255))
    draw.ellipse([(cx + eye_offset_x - eye_r, eye_y - eye_r), (cx + eye_offset_x + eye_r, eye_y + eye_r)], fill=(30, 30, 30, 255))

    # Miệng cười hoặc ngạc nhiên
    smile_type = rng.choice(["smile", "open", "flat"])
    if smile_type == "smile":
        draw.arc(
            [(cx - int(head_r * 0.35), cy), (cx + int(head_r * 0.35), cy + int(head_r * 0.45))],
            start=0, end=180, fill=(30, 30, 30, 255), width=6
        )
    elif smile_type == "open":
        draw.ellipse(
            [(cx - int(head_r * 0.2), cy + int(head_r * 0.1)), (cx + int(head_r * 0.2), cy + int(head_r * 0.45))],
            fill=(30, 30, 30, 255)
        )
    else:
        draw.line(
            [(cx - int(head_r * 0.25), cy + int(head_r * 0.2)), (cx + int(head_r * 0.25), cy + int(head_r * 0.2))],
            fill=(30, 30, 30, 255), width=6
        )

    # Biểu tượng doodle phụ trợ (bóng đèn hoặc tia sáng)
    extra_x = cx + int(head_r * 1.5)
    extra_y = cy - int(head_r * 0.6)
    for angle in [0, 45, 90, 135, 180]:
        rad = math_rad(angle)
        r1, r2 = 30, 60
        x1 = extra_x + int(r1 * math_cos(rad))
        y1 = extra_y + int(r1 * math_sin(rad))
        x2 = extra_x + int(r2 * math_cos(rad))
        y2 = extra_y + int(r2 * math_sin(rad))
        draw.line([(x1, y1), (x2, y2)], fill=(230, 160, 40, 255), width=6)

    # Badge số cảnh ở góc trên bên trái
    badge_x, badge_y = margin + 25, margin + 25
    draw.rounded_rectangle(
        [(badge_x, badge_y), (badge_x + 220, badge_y + 60)],
        radius=12,
        fill=(235, 230, 220, 255),
        outline=(40, 40, 40, 255),
        width=3
    )
    
    try:
        font_large = ImageFont.truetype("arial.ttf", 36)
        font_sub = ImageFont.truetype("arial.ttf", 26)
    except Exception:
        font_large = font_sub = ImageFont.load_default()

    draw.text((badge_x + 25, badge_y + 12), f"SCENE #{scene_id:02d}", fill=(30, 30, 30, 255), font=font_large)

    clean_prompt = prompt_en[:80] + "..." if len(prompt_en) > 80 else prompt_en
    draw.text((margin + 25, height - margin - 50), f"Prompt: {clean_prompt}", fill=(120, 120, 120, 255), font=font_sub)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    rgb_img = img.convert("RGB")
    rgb_img.save(output_path, "PNG", quality=95)
    return output_path

class DiffusersEngine:
    """
    Bộ sinh ảnh cục bộ bằng Diffusers, tối ưu đặc biệt cho GPU 6GB VRAM (RTX 4050):
    - Dùng float16
    - Bật enable_attention_slicing() và enable_model_cpu_offload() để chỉ tốn ~2GB VRAM
    - Giải phóng toàn bộ bộ nhớ ngay sau khi sinh xong
    """
    def __init__(self, model_id: str = "runwayml/stable-diffusion-v1-5", use_cpu_offload: bool = True):
        self.model_id = model_id
        self.use_cpu_offload = use_cpu_offload
        self.pipe = None

    def load(self) -> bool:
        try:
            import torch
            from diffusers import StableDiffusionPipeline
            
            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            
            if os.path.exists(self.model_id) and self.model_id.endswith((".safetensors", ".ckpt")):
                self.pipe = StableDiffusionPipeline.from_single_file(
                    self.model_id,
                    torch_dtype=dtype,
                    use_safetensors=True
                )
            else:
                self.pipe = StableDiffusionPipeline.from_pretrained(
                    self.model_id,
                    torch_dtype=dtype,
                    safety_checker=None
                )

            if torch.cuda.is_available():
                if self.use_cpu_offload:
                    self.pipe.enable_model_cpu_offload()
                else:
                    self.pipe.to("cuda")
                self.pipe.enable_attention_slicing()
            return True
        except ImportError:
            print("[DiffusersEngine] Chua cai torch/diffusers. Hay chay: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121 diffusers transformers accelerate")
            return False
        except Exception as e:
            print(f"[DiffusersEngine] Loi khoi tao Diffusers: {e}")
            return False

    def generate(self, prompt: str, negative_prompt: str, width: int = 1024, height: int = 576, seed: int = 42, steps: int = 25) -> Image.Image:
        import torch
        gen = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu").manual_seed(seed)
        
        gen_w = min(width, 768)
        gen_w = (gen_w // 8) * 8
        gen_h = int((gen_w * (height / float(width))) // 8) * 8

        result = self.pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=gen_w,
            height=gen_h,
            num_inference_steps=steps,
            guidance_scale=7.5,
            generator=gen
        )
        img = result.images[0]
        if (img.width, img.height) != (width, height):
            img = img.resize((width, height), Image.Resampling.LANCZOS)
        return img

    def release(self):
        self.pipe = None
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass
        import gc
        gc.collect()

def generate_images(
    project_dir: str,
    scene_id: Optional[int] = None,
    variants: int = 1,
    force: bool = False,
    ignore_approval: bool = False,
    progress_callback: Optional[Callable[[float, str, Optional[Dict[str, Any]]], None]] = None
) -> ImagesData:
    """
    Thực hiện Bước 4 (Images):
    - Đọc prompts.json
    - Chỉ sinh cho các cảnh đã 'approved' (hoặc tất cả nếu ignore_approval / --all)
    - Tự động chuyển đổi giữa 'diffusers' hoặc 'placeholder' theo config
    - Lưu seed từng ảnh vào metadata.json để tái hiện
    - Hỗ trợ giải phóng VRAM nghiêm ngặt sau mỗi tác vụ
    """
    config = load_project_config(project_dir)
    img_cfg = config.get("images", {})
    engine = img_cfg.get("engine", "diffusers")
    width = img_cfg.get("width", 1920)
    height = img_cfg.get("height", 1080)
    base_seed = img_cfg.get("seed", -1)
    model_id = img_cfg.get("diffusers_model", "runwayml/stable-diffusion-v1-5")
    
    prompts_path = os.path.join(project_dir, "prompts.json")
    if not os.path.exists(prompts_path):
        raise FileNotFoundError(f"Chưa có prompts.json. Vui lòng chạy bước Prompts trước: {prompts_path}")
        
    prompts_hash = compute_file_hash(prompts_path)
    images_dir = os.path.join(project_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    metadata_path = os.path.join(images_dir, "metadata.json")
    
    with open(prompts_path, "r", encoding="utf-8") as f:
        prompts_data = PromptsData.model_validate_json(f.read())
        
    old_items_map = {}
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                m_data = json.load(f)
                for it in m_data.get("items", []):
                    old_items_map[it["scene_id"]] = it
        except Exception:
            pass

    targets = prompts_data.prompts
    if scene_id is not None:
        targets = [p for p in targets if p.scene_id == scene_id]
        if not targets:
            raise ValueError(f"Không tìm thấy cảnh #{scene_id} trong prompts.json")

    total = len(targets)
    if progress_callback:
        progress_callback(0.05, f"Bắt đầu chuẩn bị sinh ảnh ({engine}) cho {total} cảnh...", None)

    diff_engine = None
    if engine == "diffusers":
        diff_engine = DiffusersEngine(model_id=model_id, use_cpu_offload=True)
        is_ready = diff_engine.load()
        if not is_ready:
            diff_engine = None

    active_items: List[ImageMetaItem] = []
    
    try:
        for idx, p_item in enumerate(targets, start=1):
            sc_id = p_item.scene_id
            
            if p_item.status != "approved" and not ignore_approval:
                if sc_id in old_items_map:
                    active_items.append(ImageMetaItem(**old_items_map[sc_id]))
                continue
                
            img_filename = f"scene_{sc_id:03d}.png"
            img_filepath = os.path.join(images_dir, img_filename)
            
            should_generate = True
            if not force and os.path.exists(img_filepath) and sc_id in old_items_map:
                should_generate = False
                
            if should_generate:
                if progress_callback:
                    pct = 0.05 + 0.85 * (idx / total)
                    progress_callback(pct, f"Đang sinh ảnh cảnh {sc_id}...", {"scene_id": sc_id})
                    
                seed = random.randint(100000, 999999) if base_seed == -1 else (base_seed + sc_id)
                full_prompt = f"{prompts_data.style_prefix}, {p_item.prompt_en}".strip(", ")
                neg_prompt = prompts_data.negative_prompt
                
                if diff_engine is not None:
                    try:
                        img = diff_engine.generate(
                            prompt=full_prompt,
                            negative_prompt=neg_prompt,
                            width=width,
                            height=height,
                            seed=seed
                        )
                        img.save(img_filepath, "PNG")
                    except Exception as err:
                        print(f"Diffusers lỗi ở cảnh {sc_id}: {err}, dùng fallback doodle...")
                        draw_doodle_placeholder(sc_id, p_item.prompt_en, p_item.overlay_text, img_filepath, width, height, seed)
                else:
                    draw_doodle_placeholder(sc_id, p_item.prompt_en, p_item.overlay_text, img_filepath, width, height, seed)

                meta = ImageMetaItem(
                    scene_id=sc_id,
                    image_file=img_filename,
                    seed=seed,
                    prompt_full=full_prompt,
                    is_active=True,
                    created_at=time.strftime("%Y-%m-%d %H:%M:%S")
                )
                active_items.append(meta)
            else:
                active_items.append(ImageMetaItem(**old_items_map[sc_id]))
    finally:
        if diff_engine:
            diff_engine.release()

    # Lưu danh sách ảnh metadata
    images_data = ImagesData(
        source_fingerprint=prompts_hash or "",
        items=active_items
    )
    atomic_write_json(metadata_path, images_data.model_dump())
    
    if progress_callback:
        progress_callback(1.0, f"Đã sinh và lưu ảnh cho {len(active_items)} cảnh thành công!", {"count": len(active_items)})
        
    return images_data
