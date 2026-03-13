"""
Step 1: Clean scraped JSON data.
Removes JS warning text, nav artifacts, and empty entries.
"""

import json
import re

VACH_IN  = "../data/vachnamrut/vachnamrut_en.json"
VACH_OUT = "../data/vachnamrut/vachnamrut_clean.json"
VATO_IN  = "../data/swamini_vato/swamini_vato_en.json"
VATO_OUT = "../data/swamini_vato/swamini_vato_clean.json"

JUNK_PHRASES = [
    "Your browser does not support JavaScript",
    "Javascript is required for this site",
    "Please enable Javascript",
    "Auto advance to next page",
    "Set the width of the side navigation",
]


def clean_text(text: str) -> str:
    if not text:
        return ""
    # Remove junk lines
    lines = text.splitlines()
    lines = [l for l in lines if not any(j in l for j in JUNK_PHRASES)]
    text = "\n".join(lines).strip()
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_vachnamrut():
    with open(VACH_IN, "r", encoding="utf-8") as f:
        data = json.load(f)

    cleaned = []
    skipped = 0
    for item in data:
        item["text"] = clean_text(item.get("text", ""))
        if len(item["text"]) < 100:
            skipped += 1
            continue
        cleaned.append(item)

    with open(VACH_OUT, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    print(f"Vachnamrut: {len(data)} → {len(cleaned)} kept, {skipped} skipped")
    print(f"  Sample: [{cleaned[0]['place']}] {cleaned[0]['title']}")
    print(f"  Text preview: {cleaned[0]['text'][:150]}\n")


def clean_swamini_vato():
    with open(VATO_IN, "r", encoding="utf-8") as f:
        data = json.load(f)

    cleaned = []
    skipped = 0
    for item in data:
        item["text"] = clean_text(item.get("text", ""))
        if len(item["text"]) < 20:
            skipped += 1
            continue
        cleaned.append(item)

    with open(VATO_OUT, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    print(f"Swamini Vato: {len(data)} → {len(cleaned)} kept, {skipped} skipped")
    print(f"  Sample: Prakaran {cleaned[0]['prakaran']}, Verse {cleaned[0]['verse_no']}")
    print(f"  Text preview: {cleaned[0]['text'][:150]}\n")


if __name__ == "__main__":
    print("=== Cleaning Data ===\n")
    clean_vachnamrut()
    clean_swamini_vato()
    print("=== Done! ===")
