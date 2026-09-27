# Phase 16 asset pipeline: background removal for the homepage florals.
#
# The design spec needs unboxed, transparent-background artwork (sunflower/lily/
# duck cut-outs) for the hero and magazine grid. The source photos in
# `assets/product-photos/` have busy opaque backgrounds, so we run U2-Net
# matting (rembg) and trim to the subject's bounding box.
#
# Usage (needs `rembg[cpu]` in a venv):
#   python scripts/cutouts.py
#
# Output: public/florals/<name>.png — committed, served via next/image.
import sys
from pathlib import Path

from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "product-photos"
OUT = ROOT / "public" / "florals"

# source file -> output basename (homepage/Instagram references)
MAP = {
    "crochet-sunflower-bouquet-main.png": "sunflower",
    "crochet-sunflower-bouquet-02.jpg": "sunflower-02",
    "crochet-sunflower-bouquet-03.jpg": "sunflower-03",
    "crochet-lily-bouquet-main.jpg": "lily",
    "crochet-duck-keychain-main.jpg": "duck",
    "crochet-duck-keychain-01.jpg": "duck-01",
}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    missing = [s for s in MAP if not (SRC / s).exists()]
    if missing:
        print(f"missing sources: {missing}", file=sys.stderr)
        return 1

    for src_name, out_name in MAP.items():
        src = SRC / src_name
        dst = OUT / f"{out_name}.png"
        img = Image.open(src).convert("RGBA")
        cut = remove(img, post_process_mask=True)
        # trim fully-transparent margins so layout sizing is predictable
        bbox = cut.getchannel("A").getbbox()
        if bbox:
            cut = cut.crop(bbox)
        cut.save(dst, optimize=True)
        print(f"{src_name} -> {dst.relative_to(ROOT)} {cut.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
