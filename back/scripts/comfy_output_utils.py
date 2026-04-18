from pathlib import Path


DATE_PREFIX = "%year%-%month%-%day%"


def dated_comfy_prefix(name: str) -> str:
    normalized = name.replace("\\", "/").lstrip("/")
    return f"{DATE_PREFIX}/{normalized}"


def resolve_comfy_output_file(output_root: Path, filename: str, subfolder: str = "") -> Path:
    if subfolder:
        return output_root / Path(subfolder) / filename
    return output_root / filename
