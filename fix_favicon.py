from PIL import Image

def crop_favicon():
    path = "assets/favicon.png"
    img = Image.open(path)
    w, h = img.size
    
    # Square size should be the smaller dimension
    size = min(w, h)
    
    # Calculate crop area for center
    left = (w - size) / 2
    top = (h - size) / 2
    right = (w + size) / 2
    bottom = (h + size) / 2
    
    img_cropped = img.crop((left, top, right, bottom))
    img_cropped.save(path)
    print(f"Favicon cropped to {size}x{size}")

if __name__ == "__main__":
    crop_favicon()
