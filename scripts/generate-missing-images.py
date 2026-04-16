#!/usr/bin/env python3
"""
Generate DALL-E 3 images for 8 vocabulary words that were previously filtered
by content policy. Uses safe, creative prompts.

Usage:
  export OPENAI_API_KEY="sk-..."
  python3 scripts/generate-missing-images.py
"""

import json
import os
import sys
import time
import urllib.request
from pathlib import Path
from io import BytesIO

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from openai import OpenAI
from PIL import Image

# ── Config ──
BASE_DIR = Path(__file__).resolve().parent.parent
VOCAB_OUTPUT_DIR = BASE_DIR / "public" / "images" / "vocab"
VOCAB_MAPPING = BASE_DIR / "src" / "data" / "vocabulary" / "word-images.json"

MODEL = "dall-e-3"
SIZE = "1024x1024"
QUALITY = "standard"
TARGET_SIZE = (256, 256)

PROMPT_SUFFIX = " No text, no words, no letters. No violent or inappropriate content. Modest."

# ── Words and prompts ──
MISSING_WORDS = [
    {
        "id": 288,
        "english": "astronomical",
        "prompt": "A person looking up in awe at an incredibly vast night sky filled with millions of stars, showing the enormity of space, photorealistic",
    },
    {
        "id": 298,
        "english": "attract",
        "prompt": "A powerful magnet pulling colorful metal objects towards it on a white table, demonstrating the concept of attraction, photorealistic",
    },
    {
        "id": 771,
        "english": "embrace",
        "prompt": "A warm friendly hug between a parent and child in a sunlit park, showing genuine warmth and love, photorealistic family portrait",
    },
    {
        "id": 513,
        "english": "compulsory",
        "prompt": "A stern official pointing at a large REQUIRED stamp on an official document, bureaucratic office setting, photorealistic",
    },
    {
        "id": 386,
        "english": "breast",
        "prompt": "A whole roasted chicken on a wooden cutting board in a kitchen, showing the chest/breast portion, food photography style, photorealistic",
    },
    {
        "id": 180,
        "english": "affair",
        "prompt": "A person dramatically juggling many folders and documents labeled BUSINESS AFFAIRS in a busy corporate office, photorealistic",
    },
    {
        "id": 1377,
        "english": "obscene",
        "prompt": "A shocked person covering their eyes with hands, dramatic surprised expression, studio lighting, photorealistic portrait",
    },
    {
        "id": 429,
        "english": "censor",
        "prompt": "A large black CENSORED bar across a page of text, with scissors and a red stamp nearby, dramatic office scene, photorealistic",
    },
]

# Fallback prompts if first attempt gets content_policy rejection
FALLBACK_PROMPTS = {
    "astronomical": "A vast observatory telescope dome open to a spectacular starry night sky, dramatic astrophotography, photorealistic",
    "attract": "A large horseshoe magnet surrounded by iron filings forming beautiful magnetic field lines on a white background, science experiment, photorealistic",
    "embrace": "Two hands warmly clasped together in a gesture of greeting and friendship, warm lighting, photorealistic",
    "compulsory": "A large official rubber stamp pressing the word MANDATORY onto a government form, bureaucratic office desk, photorealistic",
    "breast": "A beautifully plated grilled chicken dish with herbs and lemon on a restaurant plate, professional food photography, photorealistic",
    "affair": "A busy office desk overflowing with business documents folders and a briefcase, corporate business scene, photorealistic",
    "obscene": "A person making a dramatic face of shock and disbelief with wide eyes and open mouth, studio portrait, photorealistic",
    "censor": "A pair of scissors cutting through a piece of paper next to a large red rubber stamp on a wooden desk, editorial office scene, photorealistic",
}


def download_and_save(url: str, output_path: Path) -> int:
    """Download image from URL, resize to 256x256, and save as WebP."""
    response = urllib.request.urlopen(url)
    img_data = response.read()
    img = Image.open(BytesIO(img_data))
    img = img.resize(TARGET_SIZE, Image.LANCZOS)
    img.save(str(output_path), "WEBP", quality=85)
    return output_path.stat().st_size


def main():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY environment variable is not set.")
        print("")
        print("Set it before running this script:")
        print("  export OPENAI_API_KEY='sk-proj-...'")
        print("")
        print("You can find your API key at: https://platform.openai.com/api-keys")
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    # Load existing mapping
    with open(VOCAB_MAPPING) as f:
        mapping = json.load(f)

    VOCAB_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    generated = 0
    skipped = []
    total = len(MISSING_WORDS)

    print(f"Generating DALL-E 3 images for {total} missing vocabulary words")
    print(f"Output: {VOCAB_OUTPUT_DIR}")
    print(f"Mapping: {VOCAB_MAPPING}")
    print("-" * 60)

    for i, word_info in enumerate(MISSING_WORDS):
        wid = str(word_info["id"])
        english = word_info["english"]
        prompt = word_info["prompt"] + PROMPT_SUFFIX
        filename = f"{english.replace(' ', '_').replace('/', '_')}.webp"
        out_path = VOCAB_OUTPUT_DIR / filename

        print(f"\n[{i+1}/{total}] id={wid} english=\"{english}\"")
        print(f"  Prompt: {prompt[:80]}...")

        success = False

        # First attempt with primary prompt
        try:
            response = client.images.generate(
                model=MODEL,
                prompt=prompt,
                size=SIZE,
                quality=QUALITY,
                n=1,
            )
            url = response.data[0].url
            file_size = download_and_save(url, out_path)

            mapping[wid] = {
                "filename": filename,
                "english": english,
                "source": "dall-e-3",
                "license": "generated",
                "size": file_size,
            }
            generated += 1
            success = True
            print(f"  OK: {filename} ({file_size:,} bytes)")

        except Exception as e:
            err_str = str(e).lower()
            if "content_policy" in err_str:
                print(f"  Content policy rejection on first attempt, trying fallback prompt...")

                # Try fallback prompt
                fallback = FALLBACK_PROMPTS.get(english)
                if fallback:
                    fallback_prompt = fallback + PROMPT_SUFFIX
                    print(f"  Fallback: {fallback_prompt[:80]}...")
                    time.sleep(12)

                    try:
                        response = client.images.generate(
                            model=MODEL,
                            prompt=fallback_prompt,
                            size=SIZE,
                            quality=QUALITY,
                            n=1,
                        )
                        url = response.data[0].url
                        file_size = download_and_save(url, out_path)

                        mapping[wid] = {
                            "filename": filename,
                            "english": english,
                            "source": "dall-e-3",
                            "license": "generated",
                            "size": file_size,
                        }
                        generated += 1
                        success = True
                        print(f"  OK (fallback): {filename} ({file_size:,} bytes)")

                    except Exception as e2:
                        print(f"  FAILED (fallback also rejected): {e2}")
                        skipped.append({"id": wid, "english": english, "error": str(e2)})
                else:
                    print(f"  No fallback prompt available, skipping")
                    skipped.append({"id": wid, "english": english, "error": str(e)})

            elif "rate_limit" in err_str:
                print(f"  Rate limited, waiting 60s and retrying...")
                time.sleep(60)
                # Retry once
                try:
                    response = client.images.generate(
                        model=MODEL,
                        prompt=prompt,
                        size=SIZE,
                        quality=QUALITY,
                        n=1,
                    )
                    url = response.data[0].url
                    file_size = download_and_save(url, out_path)

                    mapping[wid] = {
                        "filename": filename,
                        "english": english,
                        "source": "dall-e-3",
                        "license": "generated",
                        "size": file_size,
                    }
                    generated += 1
                    success = True
                    print(f"  OK (retry): {filename} ({file_size:,} bytes)")
                except Exception as e2:
                    print(f"  FAILED after retry: {e2}")
                    skipped.append({"id": wid, "english": english, "error": str(e2)})
            else:
                print(f"  ERROR: {e}")
                skipped.append({"id": wid, "english": english, "error": str(e)})

        # Sleep between generations (rate limit: ~5 images/min)
        if i < total - 1:
            print(f"  Sleeping 12s (rate limit)...")
            time.sleep(12)

    # Save updated mapping
    with open(VOCAB_MAPPING, "w") as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)
    print(f"\nMapping saved to {VOCAB_MAPPING}")

    # Summary
    print("\n" + "=" * 60)
    print(f"DONE: {generated}/{total} images generated successfully")
    if skipped:
        print(f"SKIPPED ({len(skipped)}):")
        for s in skipped:
            print(f"  - id={s['id']} ({s['english']}): {s['error'][:100]}")
    print("=" * 60)


if __name__ == "__main__":
    main()
