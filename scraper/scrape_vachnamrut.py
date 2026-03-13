"""
Scraper for Vachnamrut from anirdesh.com
Scrapes all 274 discourses in English and saves as JSON.
"""

import json
import time
import os
import re
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from tqdm import tqdm

OUTPUT_FILE = "../data/vachnamrut/vachnamrut_en.json"
BASE_URL = "https://www.anirdesh.com/vachanamrut/index.php?format=en&vachno={}"
TOTAL_DISCOURSES = 274


def extract_discourse(html: str, vachno: int) -> dict:
    soup = BeautifulSoup(html, "lxml")

    # Extract JS metadata
    title, place, loc = "", "", ""
    for script in soup.find_all("script"):
        text = script.string or ""
        if "var vach" in text:
            title_match = re.search(r"title:\s*'([^']*)'", text)
            place_match = re.search(r"place:\s*'([^']*)'", text)
            loc_match   = re.search(r"loc:\s*'([^']*)'", text)
            if title_match: title = title_match.group(1)
            if place_match: place = place_match.group(1)
            if loc_match:   loc   = loc_match.group(1)
            break

    # Main content is in div#vach_text
    vach_text_div = soup.find("div", id="vach_text")
    if vach_text_div:
        paragraphs = vach_text_div.find_all("p")
        text_blocks = [
            p.get_text(separator=" ", strip=True)
            for p in paragraphs
            if len(p.get_text(strip=True)) > 20
        ]
    else:
        # Fallback to full page
        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()
        paragraphs = soup.find_all("p")
        text_blocks = [
            p.get_text(separator=" ", strip=True)
            for p in paragraphs
            if len(p.get_text(strip=True)) > 30
        ]

    full_text = "\n\n".join(text_blocks)

    return {
        "book": "Vachnamrut",
        "vachno": vachno,
        "loc": loc,
        "place": place,
        "title": title,
        "text": full_text,
        "url": BASE_URL.format(vachno),
    }


def scrape_all():
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    # Resume from existing data if partial
    existing = []
    done_nos = set()
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            existing = json.load(f)
        done_nos = {d["vachno"] for d in existing}
        print(f"Resuming: {len(done_nos)} discourses already scraped.")

    results = existing[:]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page = context.new_page()

        for vachno in tqdm(range(1, TOTAL_DISCOURSES + 1), desc="Vachnamrut"):
            if vachno in done_nos:
                continue

            url = BASE_URL.format(vachno)
            try:
                page.goto(url, timeout=30000, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                html = page.content()
                discourse = extract_discourse(html, vachno)

                if discourse["text"]:
                    results.append(discourse)

                # Save every 10 discourses
                if len(results) % 10 == 0:
                    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                        json.dump(results, f, ensure_ascii=False, indent=2)

                time.sleep(1)

            except Exception as e:
                print(f"\nError on vachno={vachno}: {e}")
                continue

        browser.close()

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Saved {len(results)} discourses to {OUTPUT_FILE}")


if __name__ == "__main__":
    scrape_all()
