#!/usr/bin/env python3
"""Resize only the supplied original icon; no redraw, crop, stretch or AI."""
from pathlib import Path
from PIL import Image, ImageDraw
import math, json, hashlib, subprocess, re

root = Path(__file__).resolve().parents[1]
out = root / "verification"
out.mkdir(exist_ok=True)
source = Image.open(root / "icon-512.png").convert("RGB")
assert source.size == (512, 512)
# The silver V and central light are the essential symbol. Measure their radial
# extent rather than shrinking the entire square into the safe circle.
def is_core_silver(x, y, side, pixel):
    # Only classify the V and its central flare, excluding the decorative outer rim.
    # This selection is for measurement only; the full original bitmap is preserved.
    u, v = (x + .5) / side, (y + .5) / side
    core = (.055 <= u <= .945 and .20 <= v <= .90) or (.45 <= u <= .55 and .02 <= v < .20)
    return core and min(pixel) >= 150
silver = [(x,y) for y in range(512) for x in range(512) if is_core_silver(x,y,512,source.getpixel((x,y)))]
assert len(silver) > 1000
radius = max(math.hypot(x + .5 - 256, y + .5 - 256) for x,y in silver) / 512
scale = min(.80, .385 / radius)
assert scale >= .67, ("Unexpected source geometry", radius, scale)
sizes = {}
for size in (192, 512):
    inner = int(size * scale)
    inner -= inner % 2
    offset = (size - inner) // 2
    artwork = source.resize((inner, inner), Image.Resampling.LANCZOS)
    target = Image.new("RGB", (size, size), "black")
    target.paste(artwork, (offset, offset))
    # Keep the full bitmap and prove there is no clipping or duplication.
    assert target.crop((offset, offset, offset+inner, offset+inner)).tobytes() == artwork.tobytes()
    bright = [(x+offset,y+offset) for y in range(inner) for x in range(inner) if is_core_silver(x,y,inner,artwork.getpixel((x,y)))]
    max_radius = max(math.hypot(x+.5-size/2, y+.5-size/2) for x,y in bright)
    assert max_radius <= size * .4, (size, max_radius, size*.4)
    name = f"icon-maskable-v2-{size}.png"
    target.save(root / name, optimize=True)
    sizes[str(size)] = {"artwork_side": inner, "canvas_side": size, "silver_max_radius": round(max_radius,3), "safe_radius": size*.4}
# Source assets remain exactly the supplied originals.
expected = {
    "icon-512.png": "6fd924c63838ae39d9b29631461485b592985bfb43ab6902cc8ce98a339611e9",
    "icon-192.png": "1e7ce913332afc7fb42f4a29275901f1e7159a959a736b107978236c1de24ba2",
    "splash-1080x2400.jpg": "95f720b2838466132fad1e3a7d55bcd2bd5e89815f410b09f0dde24cb0b88e2d"
}
for name, expected_sha in expected.items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest() == expected_sha
html = (root/"index.html").read_text()
base = subprocess.check_output(["git","show","36c19da2459d65367edccbed0af06a937fde947d:index.html"],cwd=root,text=True)
scripts = lambda text: re.findall(r"<script[^>]*>([\s\S]*?)</script>",text)
assert scripts(html)[1] == scripts(base)[1], "Workout/Spotify application code changed"
for index, script in enumerate(scripts(html)):
    file = out / f"syntax-{index}.js"
    file.write_text(script)
    subprocess.run(["node","--check",str(file)],check=True)
    file.unlink()
subprocess.run(["node","--check",str(root/"sw.js")],check=True)
manifest = json.loads((root/"manifest.webmanifest").read_text())
for entry in manifest["icons"]:
    image = Image.open(root/entry["src"][2:])
    assert f"{image.width}x{image.height}" == entry["sizes"]
assert manifest["short_name"] == "V-SHAPE"
# Actual small icon previews under ordinary circular Android masks.
sheet = Image.new("RGB",(690,360),"#16101f")
draw = ImageDraw.Draw(sheet)
for row, filename in enumerate(("icon-maskable-512.png","icon-maskable-v2-512.png")):
    draw.text((18,12+row*175),("Prima" if row==0 else "Dopo")+" · "+filename,fill="white")
    for column,size in enumerate((48,72,96)):
        icon = Image.open(root/filename).resize((size,size),Image.Resampling.LANCZOS)
        mask = Image.new("L",(size,size))
        ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
        x,y = 35+220*column,55+175*row
        sheet.paste(icon,(x,y),mask)
        draw.text((x+110,y+22),f"{size} px",fill="white")
sheet.save(out/"icon-before-after.png")
report = {"source":"original supplied icon-512.png","scale":round(scale,5),"previous_artwork_side_512":280,"sizes":sizes,"application_script_unchanged":True,"original_source_hashes":expected}
(out/"icon-geometry.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
