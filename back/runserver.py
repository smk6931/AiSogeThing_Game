import os
import sys
from pathlib import Path

import uvicorn
from dotenv import dotenv_values


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
