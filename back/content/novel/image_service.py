from client.gemini_client import generate_image_gemini
from utils.safe_ops import handle_exceptions

# ========================================================
#  Image Service (Gemini Client Wrapper)
# ========================================================

@handle_exceptions(default_message="캐릭터 이미지 생성 실패")
async def generate_character_image(
    character_name: str,
    character_description: str,
    output_dir: str = "static/generated/characters"
) -> str:
    """
    캐릭터 이미지 생성
    
    Returns:
        파일명 (예: abc123.png)
    """
    prompt = f"""
    A webtoon-style character portrait.
    {character_description}
    Style: Korean webtoon, clean lines, soft colors, romantic atmosphere.
    Focus on face and upper body.
    Background: simple gradient or blur.
    """
    
    return await generate_image_gemini(prompt, output_dir)


@handle_exceptions(default_message="씬 이미지 생성 실패")
async def generate_scene_image(
    scene_order: int,
    scene_text: str,
    character_visuals: list[dict],
    output_dir: str = "static/generated/scenes"
) -> str:
    """
    씬 이미지 생성
    
    Returns:
        파일명 (예: xyz789.png)
    """
    characters_summary = ", ".join([f"{cv['name']}: {cv['description'][:100]}" for cv in character_visuals if 'name' in cv and 'description' in cv])
    
    prompt = f"""
    A webtoon-style illustration.
    
    [IMPORTANT] Strictly maintain character appearance based on these descriptions:
    {characters_summary}
    
    Scene Action/Context: {scene_text[:300]}
    
    Style: Korean romance webtoon, soft pastel colors, emotional atmosphere, clean composition.
    Perspective: Cinematic shot showing characters and their interaction.
    """
    
    return await generate_image_gemini(prompt, output_dir)


@handle_exceptions(default_message="표지 이미지 생성 실패")
async def generate_cover_image(
    topic: str,
    output_dir: str = "static/generated/covers"
) -> str:
    """
    웹툰 표지 이미지 생성
    """
    prompt = f"""
    A high-quality webtoon cover illustration for a romance story about: {topic}
    Style: Korean webtoon, detailed, beautiful lighting, emotional, vibrant colors.
    Composition: Title space at the top or bottom. 
    No text in the image.
    """
    return await generate_image_gemini(prompt, output_dir)
