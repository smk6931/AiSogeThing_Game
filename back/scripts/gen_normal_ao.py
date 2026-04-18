"""
gen_normal_ao.py
diffuse PNG 한 장에서 normal.png + ao.png 자동 추출.

사용법:
  python back/scripts/gen_normal_ao.py <diffuse.png> [--strength 3.0] [--ao-radius 8]
  python back/scripts/gen_normal_ao.py front/public/ground/forest/image.png

출력:
  <same_dir>/normal.png
  <same_dir>/ao.png
"""

import sys
import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter, gaussian_filter

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")


def to_gray(img: np.ndarray) -> np.ndarray:
    """RGB(A) → float32 [0,1] grayscale (luminance)."""
    if img.ndim == 3:
        r, g, b = img[..., 0], img[..., 1], img[..., 2]
        return (0.299 * r + 0.587 * g + 0.114 * b).astype(np.float32)
    return img.astype(np.float32)


def gen_normal(gray: np.ndarray, strength: float = 3.0) -> np.ndarray:
    """
    grayscale heightmap → tangent-space normal map.
    Sobel gradient → (dx, dy) → encode to RGB [0,255].
    """
    # Sobel 커널
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
    ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32)

    from scipy.ndimage import convolve
    dx = convolve(gray, kx, mode='wrap')
    dy = convolve(gray, ky, mode='wrap')

    # 법선 벡터 (-dx, -dy, 1/strength) → normalize
    dz = np.ones_like(dx) * (1.0 / strength)
    norm = np.sqrt(dx**2 + dy**2 + dz**2)
    norm = np.where(norm < 1e-6, 1.0, norm)

    nx = (-dx / norm + 1.0) * 0.5
    ny = (-dy / norm + 1.0) * 0.5
    nz = (dz  / norm + 1.0) * 0.5

    rgb = np.stack([nx, ny, nz], axis=-1)
    return (np.clip(rgb, 0, 1) * 255).astype(np.uint8)


def gen_ao(gray: np.ndarray, radius: int = 8, strength: float = 0.8) -> np.ndarray:
    """
    grayscale → approximate AO.
    어두운 영역(오목한 곳) → AO 낮음, 밝은 영역 → AO 높음.
    local contrast를 이용해 오목/볼록 추정.
    """
    # 로컬 평균 대비 현재 값 차이 → 상대적 높이
    blurred = gaussian_filter(gray, sigma=radius)
    diff = gray - blurred  # 양수: 돌출, 음수: 오목

    # 오목한 곳 = diff 음수 → AO 감소
    ao = np.clip(0.5 + diff * strength * 3.0, 0.0, 1.0)

    # 부드럽게
    ao = gaussian_filter(ao, sigma=radius * 0.3)
    ao = np.clip(ao, 0.0, 1.0)

    return (ao * 255).astype(np.uint8)


def process(src: Path, strength: float, ao_radius: int):
    img_pil = Image.open(src).convert("RGBA")
    arr = np.array(img_pil).astype(np.float32) / 255.0

    gray = to_gray(arr)

    # Normal map
    nrm = gen_normal(gray, strength=strength)
    nrm_img = Image.fromarray(nrm, mode="RGB")
    out_normal = src.parent / "normal.png"
    nrm_img.save(out_normal)
    print(f"  normal → {out_normal}")

    # AO map
    ao = gen_ao(gray, radius=ao_radius)
    ao_img = Image.fromarray(ao, mode="L")
    out_ao = src.parent / "ao.png"
    ao_img.save(out_ao)
    print(f"  ao     → {out_ao}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("src", help="diffuse PNG 경로")
    parser.add_argument("--strength", type=float, default=3.0, help="normal map 강도 (기본 3.0)")
    parser.add_argument("--ao-radius", type=int, default=8, help="AO blur radius px (기본 8)")
    args = parser.parse_args()

    src = Path(args.src)
    if not src.exists():
        print(f"[ERROR] 파일 없음: {src}")
        sys.exit(1)

    print(f"처리 중: {src}")
    process(src, args.strength, args.ao_radius)
    print("완료.")


if __name__ == "__main__":
    main()
