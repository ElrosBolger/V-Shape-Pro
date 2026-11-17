#!/usr/bin/env python3
"""Verify the supplied original image without changing it, Home icons or workout code."""
from pathlib import Path
import hashlib
import json
import re
import struct
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
base = "af21e620072d867b275acabb21a8f186299d4952"
filename = "splash-system-ascension.jpg"
expected = "87435779dd7d5ad0ac80ac8fa72f5f36beb6b3a44ce56e98a864adb9c2c9757a"
data = (root / filename).read_bytes()
assert hashlib.sha256(data).hexdigest() == expected, "Attached image bytes changed"
assert data[:3] == bytes.fromhex('ffd8ff'), 'Attachment must remain its original JPEG bytes'

def jpeg_size(data):
    offset = 2
    while offset < len(data):
        while data[offset] == 255:
            offset += 1
        marker = data[offset]
        offset += 1
        length = struct.unpack('>H', data[offset:offset + 2])[0]
        if marker in (192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207):
            height, width = struct.unpack('>HH', data[offset + 3:offset + 7])
            return width, height
        offset += length
    raise AssertionError('JPEG dimensions not found')

assert jpeg_size(data) == (864, 1536)

def baseline(path):
    return subprocess.check_output(["git", "show", f"{base}:{path}"], cwd=root)

html = (root / "index.html").read_text()
previous = baseline("index.html").decode()
scripts = lambda text: re.findall(r"<script[^>]*>([\s\S]*?)</script>", text)
assert len(scripts(html)) == 2, "Unexpected additional HTML introduction"
assert scripts(html)[1] == scripts(previous)[1], "Workout or Spotify code changed"
expected_intro = scripts(previous)[0].replace("splash-1080x2400.jpg", filename)
expected_intro = expected_intro.replace("artwork.width = 1080;", "artwork.width = 864;")
expected_intro = expected_intro.replace("artwork.height = 2400;", "artwork.height = 1536;")
assert scripts(html)[0] == expected_intro, "Introduction behavior or timing changed"
assert re.search(r"<style>([\s\S]*?)</style>", html)[1] == re.search(r"<style>([\s\S]*?)</style>", previous)[1]
assert html.count("splash.id = 'vs-launch-splash'") == 1
assert "splash-1080x2400.jpg" not in html

home_files = ["manifest.webmanifest", "icon-192.png", "icon-512.png",
              "icon-maskable-v2-192.png", "icon-maskable-v2-512.png",
              "favicon-32.png", "apple-touch-icon.png"]
for path in home_files:
    assert (root / path).read_bytes() == baseline(path), f"Home icon/config changed: {path}"

for script in scripts(html):
    with tempfile.NamedTemporaryFile(suffix=".js") as file:
        file.write(script.encode())
        file.flush()
        subprocess.run(["node", "--check", file.name], check=True)
subprocess.run(["node", "--check", str(root / "sw.js")], check=True)
json.loads((root / "manifest.webmanifest").read_text())

report = {"source_filename": "145227.png", "installed_asset": filename,
          "sha256": expected, "dimensions": [864, 1536], "format": "JPEG (original attachment bytes)", "image_bytes_unchanged": True,
          "home_icons_and_manifest_unchanged": home_files,
          "workout_spotify_script_unchanged": True, "intro_timing_and_behavior_unchanged": True,
          "fit": "contain", "one_html_intro": True,
          "hold_ms": 2500, "fade_ms": 400, "baseline_commit": base}
output = root / "verification"
output.mkdir(exist_ok=True)
(output / "definitive-splash-integrity.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
