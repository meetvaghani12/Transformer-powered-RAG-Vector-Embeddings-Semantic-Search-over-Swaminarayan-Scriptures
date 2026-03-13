#!/bin/bash
# Run both scrapers sequentially

echo "=== Setting up environment ==="
cd "$(dirname "$0")"

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate

# Install dependencies
pip install -r requirements.txt -q

# Install Playwright browsers
playwright install chromium

echo ""
echo "=== Scraping Vachnamrut (274 discourses) ==="
python scrape_vachnamrut.py

echo ""
echo "=== Scraping Swamini Vato (7 Prakarans) ==="
python scrape_swamini_vato.py

echo ""
echo "=== Done! Check ../data/ folder ==="
