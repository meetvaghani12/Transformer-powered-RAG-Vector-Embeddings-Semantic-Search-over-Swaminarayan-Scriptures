"""
Scraper for Swamini Vato from anirdesh.com
Scrapes all 7 Prakarans in English and saves as JSON.

URL pattern:
  https://www.anirdesh.com/vato/index.php?format=en&prakaran=1&beg=1&increment=10
  Each verse is in div#vat_en_{N} where N is 1..increment
"""

import json
import time
import os
import re
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from tqdm import tqdm

OUTPUT_FILE = "../data/swamini_vato/swamini_vato_en.json"
BASE_URL = "https://www.anirdesh.com/vato/index.php?format=en&prakaran={prakaran}&beg={beg}&increment={increment}"
INDEX_URL = "https://www.anirdesh.com/vato/vato-index.php?prakaran={}"

INCREMENT = 10  # verses per page


def get_prakaran_verse_count(page, prakaran: int) -> int:
    """Fetch index page and extract total verse count for a prakaran."""
    url = INDEX_URL.format(prakaran)
    page.goto(url, timeout=30000, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    html = page.content()
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text()

    # Match "342 વાતો" or "342 Vato"
    matches = re.findall(r"(\d+)\s*(?:વાત|vato|Vato)", text, re.IGNORECASE)
    if matches:
        return int(matches[0])

    # Fallback: find highest verse link
    links = soup.find_all("a", href=re.compile(r"beg=\d+"))
    if links:
        begs = []
        for link in links:
            m = re.search(r"beg=(\d+)", link.get("href", ""))
            if m:
                begs.append(int(m.group(1)))
        if begs:
            return max(begs) + INCREMENT

    return 50  # safe default


def extract_verses(html: str, prakaran: int, beg: int) -> list:
    """
    Extract verses from a Swamini Vato page.
    English content is in div#vat_en_1, div#vat_en_2, ... div#vat_en_{INCREMENT}
    """
    soup = BeautifulSoup(html, "lxml")
    verses = []

    for i in range(1, INCREMENT + 1):
        verse_no = beg + i - 1
        div = soup.find("div", id=f"vat_en_{i}")
        if not div:
            break

        text = div.get_text(separator="\n", strip=True)
        if not text or len(text) < 10:
            continue

        verses.append({
            "book": "Swamini Vato",
            "prakaran": prakaran,
            "verse_no": verse_no,
            "text": text,
        })

    return verses


def scrape_all():
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    # Resume support
    existing = []
    done_keys = set()
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            existing = json.load(f)
        done_keys = {(d["prakaran"], d["verse_no"]) for d in existing}
        print(f"Resuming: {len(done_keys)} verses already scraped.")

    results = existing[:]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page = context.new_page()

        for prakaran in range(1, 8):
            print(f"\nDetecting verse count for Prakaran {prakaran}...")
            count = get_prakaran_verse_count(page, prakaran)
            print(f"  Prakaran {prakaran}: {count} verses")

            total_pages = (count + INCREMENT - 1) // INCREMENT

            for page_num in tqdm(range(total_pages), desc=f"  Prakaran {prakaran}"):
                beg = page_num * INCREMENT + 1
                if beg > count:
                    break

                url = BASE_URL.format(prakaran=prakaran, beg=beg, increment=INCREMENT)
                try:
                    page.goto(url, timeout=30000, wait_until="domcontentloaded")
                    page.wait_for_timeout(1500)
                    html = page.content()
                    verses = extract_verses(html, prakaran, beg)

                    for verse in verses:
                        key = (verse["prakaran"], verse["verse_no"])
                        if key not in done_keys:
                            results.append(verse)
                            done_keys.add(key)

                    # Save every 5 pages
                    if page_num % 5 == 0:
                        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                            json.dump(results, f, ensure_ascii=False, indent=2)

                    time.sleep(1)

                except Exception as e:
                    print(f"\nError on prakaran={prakaran}, beg={beg}: {e}")
                    continue

        browser.close()

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Saved {len(results)} verses to {OUTPUT_FILE}")


if __name__ == "__main__":
    scrape_all()
