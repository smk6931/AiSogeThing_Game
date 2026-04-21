"""
gen_normal_ao_batch.py
world_partition 디렉토리의 모든 파티션 PNG에서 _ao.png / _normal.png 일괄 추출.

사용법:
  python back/scripts/gen_normal_ao_batch.py
  python back/scripts/gen_normal_ao_batch.py --dir front/public/world_partition/noryangjin2_g04
  python back/scripts/gen_normal_ao_batch.py --strength 4.0 --ao-radius 10
"""

import sys
import argparse
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from PIL import Image
from scipy.ndimage import convolve, gaussian_filter

ROOT = Path(__file__).resolve().parents[2] / "front" / "public" / "world_partition"

KX = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
KY = np.array([[-1, -2, -1], [0,  0,  0], [1,  2,  1]], dtype=np.float32)


def to_gray(arr):
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    return (0.299 * r + 0.587 * g + 0.114 * b).astype(np.float32)


def gen_normal(gray, strength=4.0):
    dx = convolve(gray, KX, mode='wrap')
    dy = convolve(gray, KY, mode='wrap')
    dz = np.ones_like(dx) * (1.0 / strength)
    norm = np.sqrt(dx**2 + dy**2 + dz**2)
    norm = np.where(norm < 1e-6, 1.0, norm)
    nx = (-dx / norm + 1.0) * 0.5
    ny = (-dy / norm + 1.0) * 0.5
    nz = ( dz / norm + 1.0) * 0.5
    return (np.clip(np.stack([nx, ny, nz], -1), 0, 1) * 255).astype(np.uint8)


def gen_ao(gray, radius=10, strength=1.0):
    blurred = gaussian_filter(gray, sigma=radius)
    diff = gray - blurred
    ao = np.clip(1.0 + diff * strength * 2.5, 0.0, 1.0)
    ao = gaussian_filter(ao, sigma=radius * 0.25)
    return (np.clip(ao, 0, 1) * 255).astype(np.uint8)


def is_skip(src):
    """ref / image / ao / normal 파일은 스킵"""
    s = src.stem.lower()
    return s.endswith('_ao') or s.endswith('_normal') or s.endswith('.ref') \
        or s.endswith('.image') or s.endswith('.final') or s.endswith('.group')


def process(src, strength, ao_radius):
    img = Image.open(src).convert("RGBA")
    arr = np.array(img).astype(np.float32) / 255.0
    gray = to_gray(arr)

    out_n = src.parent / f"{src.stem}_normal{src.suffix}"
    out_a = src.parent / f"{src.stem}_ao{src.suffix}"

    Image.fromarray(gen_normal(gray, strength), "RGB").save(out_n)
    Image.fromarray(gen_ao(gray, ao_radius), "L").save(out_a)
    return out_n, out_a


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default=str(ROOT), help="대상 디렉토리 (기본: world_partition 전체)")
    parser.add_argument("--strength", type=float, default=4.0)
    parser.add_argument("--ao-radius", type=int, default=10)
    parser.add_argument("--overwrite", action="store_true", help="이미 있는 ao/normal도 재생성")
    args = parser.parse_args()

    target = Path(args.dir)
    pngs = sorted(target.rglob("*.png"))
    pngs = [p for p in pngs if not is_skip(p)]

    total = len(pngs)
    done = 0
    skipped = 0

    print(f"대상: {target}  |  PNG {total}개 발견")
    for src in pngs:
        ao_path = src.parent / f"{src.stem}_ao{src.suffix}"
        if ao_path.exists() and not args.overwrite:
            skipped += 1
            continue
        try:
            process(src, args.strength, args.ao_radius)
            done += 1
            print(f"  [{done}/{total}] {src.name}")
        except Exception as e:
            print(f"  [ERROR] {src.name}: {e}")

    print(f"\n완료: {done}개 처리, {skipped}개 스킵 (이미 존재)")


if __name__ == "__main__":
    main()
