"""
generate_manifest.py
====================
front/public/ 아래 정적 에셋의 MD5 해시를 계산해서
front/public/asset_manifest.json 을 생성한다.

- 텍스처 생성(generate_partition_textures.py) 후 실행
- 새 GLB 모델 추가 후 실행
- CI/CD 배포 전 실행 권장

출력 예:
{
  "/models/monsters/Seoul_Normal_Water_001_Slime.glb": "a1b2c3d4",
  "/world_partition/noryangjin2_g04/noryangjin2_p024.png": "e5f6a7b8",
  ...
}
"""

import sys
import os
import json
import hashlib

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# 캐시 대상 확장자
CACHE_EXTENSIONS = {'.glb', '.png', '.jpg', '.jpeg', '.webp', '.hdr'}

# 스캔 대상 폴더 (front/public/ 기준 상대 경로)
SCAN_DIRS = [
    'models',
    'ground',
    'road',
    'world_partition',
    'noise',
    'images',
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PUBLIC_DIR = os.path.join(PROJECT_ROOT, 'front', 'public')
MANIFEST_PATH = os.path.join(PUBLIC_DIR, 'asset_manifest.json')


def md5_short(path: str) -> str:
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()[:8]


def generate():
    manifest = {}
    total = 0

    for scan_dir in SCAN_DIRS:
        abs_dir = os.path.join(PUBLIC_DIR, scan_dir)
        if not os.path.isdir(abs_dir):
            continue

        for root, _, files in os.walk(abs_dir):
            for fname in files:
                ext = os.path.splitext(fname)[1].lower()
                if ext not in CACHE_EXTENSIONS:
                    continue

                abs_path = os.path.join(root, fname)
                rel_path = '/' + os.path.relpath(abs_path, PUBLIC_DIR).replace('\\', '/')
                manifest[rel_path] = md5_short(abs_path)
                total += 1

    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"[OK] asset_manifest.json 생성 완료: {total}개 파일")
    print(f"     -> {MANIFEST_PATH}")


if __name__ == '__main__':
    generate()
