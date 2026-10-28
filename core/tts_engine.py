import os
import re
import math
import numpy as np
import soundfile as sf
from typing import List, Dict, Any, Optional, Callable, Tuple

from core.models import SentenceTimeline, TimelineData
from core.hash_utils import compute_file_hash, atomic_write_json
from core.config import load_project_config

def split_script_into_sentences(text: str) -> List[Dict[str, Any]]:
    """
    Tách kịch bản thành danh sách câu:
    - Giữ các câu riêng biệt, nhận biết ranh giới đoạn (xuống dòng kép).
    - Tách nhỏ các câu quá dài theo dấu chấm, chấm hỏi, chấm than, chấm phẩy.
    """
    raw_lines = text.splitlines()
    sentences = []
    
    current_para_index = 0
    for line in raw_lines:
        line_str = line.strip()
        if not line_str:
            current_para_index += 1
            continue
            
        # Tách tiếp nếu trong 1 dòng có nhiều câu lớn
        # Regex tách theo dấu kết thúc câu: ., !, ?, ; nhưng giữ lại nội dung
        parts = re.split(r'([.!?;\n]+)', line_str)
        temp_sentence = ""
        for i in range(0, len(parts), 2):
            text_part = parts[i].strip()
            punct = parts[i+1].strip() if i+1 < len(parts) else ""
            if not text_part:
                continue
            full_part = f"{text_part}{punct}".strip()
            sentences.append({
                "text": full_part,
                "paragraph_idx": current_para_index
            })
    return sentences

class KokoroEngine:
    """Wrapper quản lý Kokoro TTS và giải phóng bộ nhớ sau khi dùng."""
    def __init__(self, model_path: str, voices_path: str, voice_name: str = "Ngọc Huyền", sample_rate: int = 24000):
        self.model_path = model_path
        self.voices_path = voices_path
        self.voice_name = voice_name
        self.sample_rate = sample_rate
        self.kokoro_instance = None

    def load(self):
        # Hỗ trợ kokoro-onnx nếu có file model
        if os.path.exists(self.model_path):
            try:
                import kokoro_onnx
                self.kokoro_instance = kokoro_onnx.Kokoro(self.model_path, self.voices_path)
                return True
            except Exception as e:
                print(f"[KokoroEngine] Không thể load kokoro_onnx: {e}")
        return False

    def synthesize(self, text: str, speed: float = 1.0) -> Tuple[np.ndarray, int]:
        if self.kokoro_instance:
            samples, sr = self.kokoro_instance.create(text, voice=self.voice_name, speed=speed, lang="vi")
            return samples.astype(np.float32), sr
        raise RuntimeError("Kokoro chưa được khởi tạo hoặc thiếu file weights.")

    def release(self):
        self.kokoro_instance = None
        import gc
        gc.collect()

def generate_mock_speech_audio(text: str, sample_rate: int = 24000) -> Tuple[np.ndarray, int]:
    """
    Tạo audio phát âm mô phỏng (dùng khi máy chưa cài model Kokoro weights)
    Thời lượng tính toán chuẩn theo nhịp đọc tiếng Việt tự nhiên (~3-4 từ mỗi giây).
    Tạo âm thanh dạng chuỗi âm tần số tự nhiên (formant synthesis) không chói tai.
    """
    words = text.strip().split()
    word_count = max(len(words), 1)
    
    # Ước lượng thời lượng trung bình tiếng Việt: 0.28s mỗi từ + thời gian cho dấu câu
    char_count = len(text)
    duration = max(1.2, word_count * 0.28 + (char_count * 0.015))
    total_samples = int(duration * sample_rate)
    
    t = np.linspace(0, duration, total_samples, endpoint=False)
    # Tổng hợp các hài âm formant mô phỏng giọng nói nhẹ nhàng
    f0 = 180.0 # tần số cơ bản giọng nữ (khoảng Ngọc Huyền)
    harmonics = (
        0.35 * np.sin(2 * np.pi * f0 * t) +
        0.20 * np.sin(2 * np.pi * (f0 * 2) * t) +
        0.12 * np.sin(2 * np.pi * (f0 * 3) * t) +
        0.05 * np.sin(2 * np.pi * 2200 * t) # formant cao
    )
    # Envelope dao động theo từng từ
    word_freq = word_count / duration
    envelope = 0.5 * (1.0 + np.sin(2 * np.pi * word_freq * t - np.pi/2))
    # Fade in & out ở 2 đầu
    fade_len = int(0.05 * sample_rate)
    fade_in = np.linspace(0, 1, fade_len)
    fade_out = np.linspace(1, 0, fade_len)
    mod = envelope.copy()
    mod[:fade_len] *= fade_in
    mod[-fade_len:] *= fade_out
    
    audio = (harmonics * mod * 0.4).astype(np.float32)
    return audio, sample_rate

def process_tts(
    project_dir: str,
    target_sentence_id: Optional[int] = None,
    force: bool = False,
    progress_callback: Optional[Callable[[float, str, Optional[Dict[str, Any]]], None]] = None
) -> TimelineData:
    """
    Thực hiện Bước 1 (TTS):
    - Đọc script.txt
    - Sinh âm thanh từng câu riêng biệt
    - Tính thời lượng = len(samples) / sample_rate
    - Chèn khoảng lặng và cộng dồn mốc start/end
    - Ghép thành audio/voice.wav
    - Xuất timeline.json kèm source_fingerprint
    - Hỗ trợ tái tạo riêng 1 câu (target_sentence_id) và dịch mốc tự động
    """
    config = load_project_config(project_dir)
    tts_cfg = config.get("tts", {})
    sample_rate = tts_cfg.get("sample_rate", 24000)
    silence_sentence_sec = tts_cfg.get("silence_between_sentences", 0.4)
    silence_para_sec = tts_cfg.get("silence_between_paragraphs", 0.8)
    speed = tts_cfg.get("speed", 1.0)
    
    script_path = os.path.join(project_dir, "script.txt")
    if not os.path.exists(script_path):
        raise FileNotFoundError(f"Không tìm thấy file kịch bản: {script_path}")
        
    script_hash = compute_file_hash(script_path)
    audio_dir = os.path.join(project_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)
    timeline_path = os.path.join(project_dir, "timeline.json")
    voice_wav_path = os.path.join(audio_dir, "voice.wav")
    
    with open(script_path, "r", encoding="utf-8") as f:
        script_content = f.read()
        
    parsed_sentences = split_script_into_sentences(script_content)
    if not parsed_sentences:
        raise ValueError("File script.txt rỗng hoặc không có nội dung hợp lệ.")
        
    # Chuẩn bị engine Kokoro nếu có
    kokoro = KokoroEngine(
        model_path=os.path.join(project_dir, tts_cfg.get("kokoro_model_path", "")),
        voices_path=os.path.join(project_dir, tts_cfg.get("kokoro_voices_path", "")),
        voice_name=tts_cfg.get("voice", "Ngọc Huyền"),
        sample_rate=sample_rate
    )
    has_kokoro = kokoro.load()
    
    # Kiểm tra xem có timeline.json cũ hay không để hỗ trợ tái sinh 1 câu
    old_sentences_map = {}
    if os.path.exists(timeline_path):
        try:
            with open(timeline_path, "r", encoding="utf-8") as f:
                old_data = TimelineData.model_validate_json(f.read())
                for s in old_data.sentences:
                    old_sentences_map[s.id] = s
        except Exception:
            pass

    sentence_items: List[SentenceTimeline] = []
    audio_buffers: List[np.ndarray] = []
    current_time = 0.0
    total_count = len(parsed_sentences)
    
    if progress_callback:
        progress_callback(0.05, f"Bắt đầu tổng hợp âm thanh cho {total_count} câu...", None)

    try:
        for idx, item in enumerate(parsed_sentences, start=1):
            sent_text = item["text"]
            para_idx = item["paragraph_idx"]
            is_para_end = (idx < total_count and parsed_sentences[idx]["paragraph_idx"] != para_idx)
            silence_after = silence_para_sec if is_para_end else silence_sentence_sec
            
            filename = f"sentence_{idx:03d}.wav"
            filepath = os.path.join(audio_dir, filename)
            
            should_synth = True
            # Nếu chỉ sinh lại 1 câu duy nhất và câu này không phải mục tiêu và file đã có
            if target_sentence_id is not None and idx != target_sentence_id and os.path.exists(filepath):
                should_synth = False
            # Nếu không force và file đã có với nội dung câu cũ giống hệt
            elif not force and target_sentence_id is None and os.path.exists(filepath) and idx in old_sentences_map:
                if old_sentences_map[idx].text == sent_text:
                    should_synth = False
                    
            if should_synth:
                if progress_callback:
                    pct = 0.05 + 0.80 * (idx / total_count)
                    progress_callback(pct, f"Đang đọc câu {idx}/{total_count}: '{sent_text[:30]}...'", {"sentence_id": idx})
                
                # Sinh audio
                if has_kokoro:
                    try:
                        samples, sr = kokoro.synthesize(sent_text, speed=speed)
                    except Exception as err:
                        print(f"Kokoro lỗi ở câu {idx}, chuyển sang fallback: {err}")
                        samples, sr = generate_mock_speech_audio(sent_text, sample_rate)
                else:
                    samples, sr = generate_mock_speech_audio(sent_text, sample_rate)
                    
                sf.write(filepath, samples, sr)
            else:
                samples, sr = sf.read(filepath, dtype='float32')
                
            duration = round(len(samples) / float(sr), 3)
            start_time = round(current_time, 3)
            end_time = round(start_time + duration, 3)
            
            st = SentenceTimeline(
                id=idx,
                start=start_time,
                end=end_time,
                duration=duration,
                silence_after=silence_after,
                text=sent_text,
                audio_file=filename
            )
            sentence_items.append(st)
            
            # Đưa vào buffer để ghép voice.wav
            audio_buffers.append(samples)
            # Thêm khoảng im lặng
            silence_samples_count = int(silence_after * sample_rate)
            if silence_samples_count > 0:
                silence_arr = np.zeros(silence_samples_count, dtype=np.float32)
                audio_buffers.append(silence_arr)
                
            current_time = end_time + silence_after

        # Ghép thành voice.wav hoàn chỉnh
        if progress_callback:
            progress_callback(0.90, "Đang ghép nối toàn bộ âm thanh thành voice.wav...", None)
            
        full_voice = np.concatenate(audio_buffers, axis=0) if audio_buffers else np.zeros(0, dtype=np.float32)
        sf.write(voice_wav_path, full_voice, sample_rate)
        
        # Kiểm tra tổng thời lượng
        actual_total_duration = round(len(full_voice) / float(sample_rate), 3)
        expected_total_duration = round(current_time, 3)
        # Chênh lệch không quá vài phần nghìn giây
        assert abs(actual_total_duration - expected_total_duration) < 0.05, f"Tổng thời lượng lệch: actual {actual_total_duration} vs expected {expected_total_duration}"
        
        timeline_data = TimelineData(
            source_fingerprint=script_hash or "",
            sample_rate=sample_rate,
            total_duration=actual_total_duration,
            sentences=sentence_items
        )
        
        atomic_write_json(timeline_path, timeline_data.model_dump())
        
        if progress_callback:
            progress_callback(1.0, f"Hoàn thành TTS! Tổng thời lượng: {actual_total_duration}s ({total_count} câu).", {"total_duration": actual_total_duration})
            
        return timeline_data
    finally:
        kokoro.release()
