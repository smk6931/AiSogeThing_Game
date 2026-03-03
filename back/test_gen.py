import asyncio
import sys
import os
import shutil

# Add the backend directory to sys.path to import modules
sys.path.append(r'c:\GitHub\AiSogeThing\back')

from client.gemini_client import generate_image_gemini

async def main():
    prompt = "top-down view of a high-quality 2D fantasy game ground texture, lush vibrant green grass, dirt path, bright beautiful colors, highly detailed tileable pattern"
    output_dir = r"c:\GitHub\AiSogeThing\front\public"
    filename = await generate_image_gemini(
        prompt=prompt,
        output_dir=output_dir,
        model_name="models/gemini-2.5-flash-image",  # or imagen-3.0-generate-001 depending on current API
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
    asyncio.run(main())
