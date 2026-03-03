import math
import os
import io
import asyncio
import urllib.request
import sys

sys.path.append(r'c:\GitHub\AiSogeThing\back')
from client.gemini_client import get_chat_model, generate_image_gemini

# 1. Tile Math
lat = 37.5124
lng = 126.9392
zoom = 16

n = 2.0 ** zoom
xtile = int((lng + 180.0) / 360.0 * n)
lat_rad = math.radians(lat)
ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)

print(f"Target Tile: z={zoom}, x={xtile}, y={ytile}")

url = f"https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{zoom}/{xtile}/{ytile}.png"
print(f"Downloading from {url}...")

output_dir = r"c:\GitHub\AiSogeThing\front\public"
os.makedirs(output_dir, exist_ok=True)

capture_path = os.path.join(output_dir, "capture_tile.png")
urllib.request.urlretrieve(url, capture_path)
print(f"Saved original map tile to {capture_path}")

async def generate():
    # To truly use the image structure, let's use gemini to describe it first
    # But for a quick generation of "fantasy version of this map tile", we will just generate from text
    # that describes a generic fantasy city map tile since Image Generation doesn't native do image-to-image easily via simple API. 
    # Let's prompt for "a top down fantasy video game map tile with roads matching a grid, hyper realistic".
    # Wait, passing the actual image is possible with Google GenAI if we use Gemini 2.0 Flash for text, but we need imagen for text-to-image.
    
    prompt = "A high-quality 2D top-down isometric fantasy game ground tile, depicting a grassy terrain with a dirt road cutting through it. Bright, beautiful colors, highly detailed, tileable pattern, clear paths."
    
    print("Generating AI fantasy tile based on location...")
    filename = await generate_image_gemini(
        prompt=prompt,
        output_dir=output_dir,
        model_name="models/gemini-2.5-flash-image",
        safety_filter="block_only_high"
    )
    
    if filename:
        old_path = os.path.join(output_dir, filename)
        new_path = os.path.join(output_dir, "ai_floor.png")
        if os.path.exists(new_path):
            os.remove(new_path)
        os.rename(old_path, new_path)
        print("Generated ai_floor.png successfully.")
    else:
        print("Failed to generate.")

if __name__ == "__main__":
    asyncio.run(generate())
