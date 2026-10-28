import os
import shutil
import pytest
from core.hash_utils import compute_string_hash, atomic_write_json, is_step_stale
from core.tts_engine import split_script_into_sentences
from core.scene_builder import build_scenes
from core.models import TimelineData, SentenceTimeline
from core.video_renderer import format_ass_time, wrap_vietnamese_text

def test_hash_and_staleness(tmp_path):
    f_in = tmp_path / "script.txt"
    f_in.write_text("Câu 1. Câu 2.", encoding="utf-8")
    
    hash1 = compute_string_hash(f_in.read_text(encoding="utf-8"))
    out_json = tmp_path / "timeline.json"
    
    # Chưa tạo file -> stale
    assert is_step_stale(str(out_json), hash1) is True
    
    atomic_write_json(str(out_json), {"source_fingerprint": hash1, "data": []})
    assert is_step_stale(str(out_json), hash1) is False
    
    # Đổi nội dung input -> stale
    f_in.write_text("Câu 1 đổi mới hoàn toàn.", encoding="utf-8")
    hash2 = compute_string_hash(f_in.read_text(encoding="utf-8"))
    assert is_step_stale(str(out_json), hash2) is True

def test_sentence_splitting():
    text = "Chào các bạn! Hôm nay chúng ta cùng tìm hiểu. Tại sao bầu trời lại xanh?"
    sents = split_script_into_sentences(text)
    assert len(sents) == 3
    assert "Chào các bạn!" in sents[0]["text"]
    assert "Hôm nay chúng ta cùng tìm hiểu." in sents[1]["text"]

def test_ass_time_formatting():
    assert format_ass_time(0.0) == "0:00:00.00"
    assert format_ass_time(5.795) == "0:00:05.80"
    assert format_ass_time(71.25) == "0:01:11.25"

def test_wrap_vietnamese_text():
    long_sent = "Đây là một câu thoại tiếng Việt tương đối dài để kiểm tra tính năng tự động xuống dòng của phụ đề."
    wrapped = wrap_vietnamese_text(long_sent, max_chars=30)
    assert r"\N" in wrapped
