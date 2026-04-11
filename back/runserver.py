import os
import sys
from pathlib import Path


def _ensure_venv() -> None:
    """현재 Python이 프로젝트 venv가 아니면 venv Python으로 재실행한다."""
    import subprocess

    backend_dir = Path(__file__).resolve().parent
    project_root = backend_dir.parent

    # Windows: venv/Scripts/python.exe  /  Unix: venv/bin/python
    _exe = "python.exe" if sys.platform == "win32" else "python"
    _sub = "Scripts" if sys.platform == "win32" else "bin"
    venv_python = project_root / "venv" / _sub / _exe

    if not venv_python.exists():
        print(f"[runserver] venv 없음: {venv_python} — 시스템 Python으로 진행")
        return

    current = Path(sys.executable).resolve()
    if current == venv_python.resolve():
        return  # 이미 venv Python

    print(f"[runserver] 시스템 Python 감지됨. venv로 재실행: {venv_python}")
    result = subprocess.run([str(venv_python)] + sys.argv)
    sys.exit(result.returncode)


_ensure_venv()

import uvicorn  # noqa: E402
from dotenv import dotenv_values  # noqa: E402


sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def resolve_backend_port(project_root: Path) -> int:
    env_path = project_root / ".env"
    env_map = dotenv_values(env_path) if env_path.exists() else {}

    if env_map.get("BACKEND_PORT"):
        return int(env_map["BACKEND_PORT"])

    if env_map.get("API_PORT"):
        return int(env_map["API_PORT"])

    vite_api_url = env_map.get("VITE_API_URL")
    if vite_api_url:
        from urllib.parse import urlparse

        parsed = urlparse(vite_api_url)
        if parsed.port:
            return int(parsed.port)

    return 8100


def main() -> None:
    backend_dir = Path(__file__).resolve().parent
    project_root = backend_dir.parent
    os.chdir(backend_dir)
    os.environ["PYTHONUTF8"] = "1"
    os.environ["PYTHONIOENCODING"] = "utf-8"

    port = resolve_backend_port(project_root)
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()
