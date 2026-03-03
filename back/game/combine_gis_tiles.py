import os
from PIL import Image

def combine_gis_tiles():
    source_dir = "static/maps/seoul_gis_test/"
    output_path = "static/maps/seoul_gis_combined.jpg"
    
    tile_size = 1024
    overlap = 200
    stride = tile_size - overlap 
    
    canvas_w = overlap + (stride * 2)
    canvas_h = overlap + (stride * 2)
    
    combined = Image.new("RGB", (canvas_w, canvas_h), (0, 0, 0))
    
    for y in range(2):
        for x in range(2):
            filename = f"tile_{x}_{y}.png"
            path = os.path.join(source_dir, filename)
            
            if os.path.exists(path):
                tile = Image.open(path)
                pos_x = x * stride
                pos_y = y * stride
                combined.paste(tile, (pos_x, pos_y))
    
    combined.save(output_path, quality=90)
    print(f"✅ GIS 합치기 완료: {output_path} ({canvas_w}x{canvas_h})")

if __name__ == "__main__":
    combine_gis_tiles()
