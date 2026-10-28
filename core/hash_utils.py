import os
import hashlib
import json
import shutil
from typing import Any, Dict, Optional

def compute_file_hash(filepath: str) -> Optional[str]:
    """Tính SHA256 của file để làm fingerprint phát hiện thay đổi."""
    if not os.path.exists(filepath):
        return None
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def compute_string_hash(content: str) -> str:
    """Tính SHA256 của một chuỗi text."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

def atomic_write_json(filepath: str, data: Dict[str, Any], indent: int = 2) -> None:
    """Ghi dữ liệu ra file JSON an toàn (ghi vào .tmp rồi đổi tên) chống hỏng khi tắt đột ngột."""
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    temp_path = f"{filepath}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
    
    # Trên Windows, os.replace() thay thế an toàn nếu cùng ổ đĩa
    if os.path.exists(filepath):
        os.replace(temp_path, filepath)
    else:
        os.rename(temp_path, filepath)

def atomic_write_text(filepath: str, text: str) -> None:
    """Ghi dữ liệu text an toàn qua file tạm."""
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    temp_path = f"{filepath}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(text)
    if os.path.exists(filepath):
        os.replace(temp_path, filepath)
    else:
        os.rename(temp_path, filepath)

def is_step_stale(output_filepath: str, expected_input_hash: Optional[str]) -> bool:
    """
    Kiểm tra xem file đầu ra của một bước có bị lỗi thời so với file đầu vào hay không.
    Trả về True nếu:
      - File đầu ra chưa tồn tại
      - expected_input_hash là None (không có file đầu vào)
      - Fingerprint lưu trong file đầu ra khác với hash hiện tại của file đầu vào
    """
    if not os.path.exists(output_filepath):
        return True
    if expected_input_hash is None:
        return True
    try:
        with open(output_filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        saved_hash = data.get("source_fingerprint")
        return saved_hash != expected_input_hash
    except Exception:
        return True
