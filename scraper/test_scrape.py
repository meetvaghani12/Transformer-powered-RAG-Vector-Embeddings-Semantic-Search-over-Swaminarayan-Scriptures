"""
Test scraper — fetches just 2 Vachnamrut discourses + 1 Swamini Vato page
to verify HTML structure before running full scrape.
"""

import json
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import re


def test_vachnamrut():
    print("\n=== Testing Vachnamrut ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        url = "https://www.anirdesh.com/vachanamrut/index.php?format=en&vachno=1"
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        html = page.content()
        browser.close()

    soup = BeautifulSoup(html, "lxml")

    # Extract JS metadata
    title, place, loc = "", "", ""
    for script in soup.find_all("script"):
        text = script.string or ""
        if "var vach" in text:
            title_match = re.search(r"title:\s*'([^']*)'", text)
            place_match = re.search(r"place:\s*'([^']*)'", text)
            loc_match = re.search(r"loc:\s*'([^']*)'", text)
            if title_match: title = title_match.group(1)
            if place_match: place = place_match.group(1)
            if loc_match: loc = loc_match.group(1)

    print(f"Title: {title}")
    print(f"Place: {place}")
    print(f"Loc: {loc}")

    # Remove nav/script/style
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()

    paragraphs = soup.find_all("p")
    texts = [p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30]
    print(f"\nFound {len(texts)} paragraphs")
    if texts:
        print(f"\nFirst paragraph preview:\n{texts[0][:300]}")
        print(f"\nSecond paragraph preview:\n{texts[1][:300] if len(texts) > 1 else 'N/A'}")

    # Show all div IDs and classes
    divs = soup.find_all("div", id=True)
    print(f"\nDiv IDs found: {[d.get('id') for d in divs[:10]]}")
    divs_class = soup.find_all("div", class_=True)
    print(f"Div classes found: {list(set([' '.join(d.get('class', [])) for d in divs_class[:10]]))}")


def test_swamini_vato():
    print("\n\n=== Testing Swamini Vato ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        url = "https://www.anirdesh.com/vato/index.php?format=en&prakaran=1&beg=1&increment=5"
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        html = page.content()
        browser.close()

    soup = BeautifulSoup(html, "lxml")

    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()

    paragraphs = soup.find_all("p")
    texts = [p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20]
    print(f"Found {len(texts)} paragraphs")
    if texts:
        print(f"\nFirst paragraph:\n{texts[0][:300]}")
        print(f"\nSecond paragraph:\n{texts[1][:300] if len(texts) > 1 else 'N/A'}")

    # Check for verse number patterns
    full_text = soup.get_text()
    verse_matches = re.findall(r"\(\d+/\d+\)", full_text)
    print(f"\nVerse number patterns found: {verse_matches[:10]}")

    # Show all div IDs and classes
    divs = soup.find_all("div", id=True)
    print(f"\nDiv IDs found: {[d.get('id') for d in divs[:10]]}")


if __name__ == "__main__":
    test_vachnamrut()
    test_swamini_vato()
    print("\n\nTest complete! Check output above to verify structure.")
    print("If paragraphs are found and text looks correct, run the full scrapers.")
