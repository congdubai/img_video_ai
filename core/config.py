import os
import yaml
from typing import Dict, Any

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.default.yaml")

def deep_merge(dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
    """Hợp nhất đệ quy dict2 đè lên dict1."""
    result = dict(dict1)
    for k, v in dict2.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        else:
            result[k] = v
    return result

def load_default_config() -> Dict[str, Any]:
    if os.path.exists(DEFAULT_CONFIG_PATH):
        with open(DEFAULT_CONFIG_PATH, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}

def load_project_config(project_dir: str) -> Dict[str, Any]:
    """Nạp config mặc định rồi ghi đè bằng config riêng của project nếu có."""
    base_config = load_default_config()
    project_config_path = os.path.join(project_dir, "config.yaml")
    if os.path.exists(project_config_path):
        with open(project_config_path, "r", encoding="utf-8") as f:
            proj_conf = yaml.safe_load(f) or {}
            return deep_merge(base_config, proj_conf)
    return base_config
