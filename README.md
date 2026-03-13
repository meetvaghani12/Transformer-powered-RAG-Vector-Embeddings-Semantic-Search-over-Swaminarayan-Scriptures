# Vachanamrut-Intelligence-Engine-VIE-Retrieval-Enhanced-Spiritual-Advisory-System

> A production-grade **Retrieval-Augmented Generation (RAG)** pipeline over the sacred corpora of **Vachnamrut** (274 discourses) and **Swamini Vato** (1,484 verses) of the Swaminarayan Sampraday — enabling semantically grounded, multi-lingual theological query resolution via a vector-indexed knowledge base, transformer-based dense retrieval, and LLM-driven generative synthesis.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OFFLINE PIPELINE                             │
│                                                                     │
│  anirdesh.com ──► Playwright Scraper ──► JSON Corpus                │
│                                              │                      │
│                                    Text Chunking & Cleaning         │
│                                              │                      │
│                             sentence-transformers (BAAI/bge-small)  │
│                                   Dense Embeddings (384-dim)        │
│                                              │                      │
│                               ChromaDB Persistent Vector Store      │
│                                  (cosine similarity index)          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         ONLINE INFERENCE                            │
│                                                                     │
│  User Query ──► BGE Encoder ──► Query Vector                        │
│                                      │                              │
│                          Dual-Collection ANN Retrieval              │
│                     (top-k from Vachnamrut + Swamini Vato)          │
│                                      │                              │
│                         Context-Augmented Prompt Assembly           │
│                                      │                              │
│                    OpenRouter LLM (multi-model fallback chain)      │
│                        ┌─────────────────────────┐                 │
│                        │ stepfun/step-3.5-flash   │                 │
│                        │ google/gemma-3-12b-it    │  ← fallback     │
│                        │ google/gemma-3-4b-it     │  ← fallback     │
│                        │ meta-llama/llama-3.3-70b │  ← fallback     │
│                        └─────────────────────────┘                 │
│                                      │                              │
│                    Grounded Answer + Source Attribution             │
│                    + Optional In-Context Translation (GU/HI)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Web Scraping** | Playwright (Chromium, headless) | DOM rendering + JS execution for dynamic content extraction |
| **HTML Parsing** | BeautifulSoup4 + lxml | Structural document parsing, metadata extraction |
| **Embedding Model** | `BAAI/bge-small-en-v1.5` (HuggingFace) | Dense vector representation, 384-dimensional semantic embeddings |
| **Vector Store** | ChromaDB (persistent, HNSW index) | Approximate Nearest Neighbor (ANN) search with cosine similarity |
| **LLM Inference** | OpenRouter API (multi-model fallback) | Generative synthesis with automatic model failover |
| **Translation** | In-context LLM prompting | Zero-shot single-pass multilingual generation (EN/GU/HI) |
| **Backend** | FastAPI + Uvicorn | Async REST API with CORS middleware |
| **Frontend** | Next.js 16 + TypeScript | SSR-capable React application |
| **Animations** | Framer Motion | Physics-based declarative animations |
| **Styling** | Tailwind CSS + Custom CSS | Utility-first styling with bespoke sacred design system |

---

## Corpus Statistics

| Scripture | Documents | Scope | Format |
|---|---|---|---|
| **Vachnamrut** | 272 discourses | Gadhada I–III, Sarangpur, Kariyani, Loya, Panchala, Vartal, Amdavad, Jetalpur | Prose discourse |
| **Swamini Vato** | 1,484 verses | Prakarans 1–7 (342 + 192 + 74 + 140 + 407 + 292 + 37) | Aphoristic verse |
| **Total indexed** | **1,756 documents** | — | — |

---

## RAG Pipeline — Deep Dive

### 1. Document Ingestion (`scraper/`)

Playwright headless Chromium navigates `anirdesh.com` and extracts:
- **Vachnamrut**: Iterates `vachno=1..274` — parses `div#vach_text` for prose content; extracts JS metadata (`title`, `place`, `loc`) via regex
- **Swamini Vato**: Iterates all 7 Prakarans with paginated `beg` cursor — extracts per-verse English content from `div#vat_en_{N}` selectors

Resume-safe incremental scraping via checkpoint JSON files.

### 2. Embedding & Indexing (`backend/ingest.py`)

```
Corpus → batch encode (BAAI/bge-small-en-v1.5, batch_size=64)
       → 384-dim float32 vectors
       → ChromaDB HNSW index (cosine metric)
       → Persistent storage at data/chromadb/
```

Total indexing time: **~45 seconds** (local CPU inference, no API dependency).

### 3. Retrieval (`backend/main.py`)

At query time:
1. Query string → BGE encoder → 384-dim query vector
2. Parallel ANN search across two logical partitions:
   - `WHERE book = "Vachnamrut"` → top-4 by cosine similarity
   - `WHERE book = "Swamini Vato"` → top-4 by cosine similarity
3. Relevance scores computed as `1 - cosine_distance`
4. Context window assembled: `[source_ref]\n{doc[:600]}` per result

### 4. Generative Synthesis

Single-pass prompt construction includes:
- System persona (Swaminarayan philosophy domain expert)
- 8 retrieved passages with source citations
- User query
- Optional language directive (Gujarati/Hindi) appended inline

Multi-model fallback chain ensures **zero single-point-of-failure** on free-tier rate limits:
```python
FREE_MODELS = [
    "stepfun/step-3.5-flash:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
]
```

Translation is handled **in-context** within the same generative pass — eliminating the second API call overhead and halving latency for multilingual responses.

---

## Project Structure

```
swaminarayan-rag/
│
├── .env                          # API credentials (never commit)
│
├── scraper/
│   ├── scrape_vachnamrut.py      # Playwright scraper — 274 discourses
│   ├── scrape_swamini_vato.py    # Playwright scraper — 1484 verses
│   ├── test_scrape.py            # Structure validation harness
│   └── requirements.txt
│
├── data/
│   ├── vachnamrut/
│   │   ├── vachnamrut_en.json    # Raw scraped corpus
│   │   └── vachnamrut_clean.json # Cleaned corpus
│   ├── swamini_vato/
│   │   ├── swamini_vato_en.json
│   │   └── swamini_vato_clean.json
│   └── chromadb/                 # Persistent HNSW vector index
│
├── backend/
│   ├── main.py                   # FastAPI application
│   ├── ingest.py                 # Embedding + ChromaDB ingestion pipeline
│   ├── clean_data.py             # Corpus sanitization
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx              # Main chat interface
    │   └── globals.css           # Sacred design system tokens
    └── components/
        ├── MandalaBackground.tsx # SVG mandala with counter-rotation animation
        └── SourceCard.tsx        # Scroll-reveal source attribution card
```

---

## Setup & Execution

### Prerequisites

- Python 3.11+
- Node.js 18+
- 4GB RAM minimum (for embedding model + ChromaDB)

### Step 1 — Scrape the Corpus

```bash
cd scraper
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# Scrape Vachnamrut (274 discourses, ~45 mins)
python scrape_vachnamrut.py

# Scrape Swamini Vato (1484 verses, ~15 mins)
python scrape_swamini_vato.py
```

### Step 2 — Build Vector Index

```bash
cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Clean corpus
python clean_data.py

# Embed + index (~45 seconds, fully local)
python ingest.py
```

### Step 3 — Start Backend

```bash
python main.py
# Uvicorn running on http://0.0.0.0:8000
```

### Step 4 — Start Frontend

```bash
cd frontend
npm install
npm run dev
# Next.js running on http://localhost:3000
```

---

## API Reference

### `POST /chat`

**Request:**
```json
{
  "query": "How does one overcome maya according to Shriji Maharaj?",
  "language": "english"
}
```

**Supported languages:** `english` | `gujarati` | `hindi`

**Response:**
```json
{
  "answer": "As stated in Vachnamrut GIII-262...",
  "language": "english",
  "vachnamrut_matches": [
    {
      "book": "Vachnamrut",
      "reference": "GIII-262",
      "title": "Vishalyakarani Herbal Medicine",
      "place": "Gadhada III",
      "text": "...",
      "score": 0.634
    }
  ],
  "swamini_vato_matches": [
    {
      "book": "Swamini Vato",
      "prakaran": 1,
      "verse_no": 189,
      "reference": "Prakaran 1, Verse 189",
      "text": "...",
      "score": 0.746
    }
  ],
  "total_matches": {
    "vachnamrut": 4,
    "swamini_vato": 4,
    "total": 8
  }
}
```

### `GET /health`

```json
{
  "status": "ok",
  "documents": 1756
}
```

---

## Environment Variables

```env
GOOGLE_API_KEY=...        # Google Generative AI (optional, for future use)
GROQ_API_KEY=...          # Groq (optional fallback)
VOYAGE_API_KEY=...        # Voyage AI (optional)
OPENROUTER_API_KEY=...    # Primary LLM provider (required)
```

---

## Design System

The frontend implements a bespoke **sacred-luxury** design language:

| Token | Value | Usage |
|---|---|---|
| `--bg-deep` | `#0D0A00` | Base canvas — near-black warm void |
| `--gold-primary` | `#C8860A` | Saffron gold — primary interactive |
| `--gold-bright` | `#F5C842` | Bright gold — highlights, shimmer |
| `--cream` | `#F5ECD7` | Warm cream — body text |
| `--cream-dim` | `#C9B99A` | Muted cream — secondary text |

**Typography:**
- `Cinzel` — headings (Roman majuscule, majestic)
- `Cormorant Garamond` — subtitles (elegant high-contrast serif)
- `EB Garamond` — body (classical oldstyle, high legibility)

**Animations:**
- `MandalaBackground` — dual-layer counter-rotating SVG mandalas (120s / 80s period)
- `shimmer-text` — 200% background-size sweep at 4s cycle
- `SourceCard` — `whileInView` scroll-reveal with `rotateX` perspective entry

---

## Known Constraints

| Constraint | Detail |
|---|---|
| Free-tier LLM rate limits | OpenRouter free models throttle at ~3–10 RPM; mitigated via 6-model fallback chain |
| Embedding dimensionality | BGE-small produces 384-dim vectors; upgrade to `bge-large` (1024-dim) for higher recall |
| Context window | Prompt truncates each retrieved document to 600 chars to stay within free-tier token budgets |
| Scraping dependency | Corpus sourced from `anirdesh.com`; re-scrape required if site structure changes |

---

## License

This project is for educational and spiritual purposes. All scripture content belongs to its respective publishers. The software infrastructure is open for non-commercial use.

---

*Jai Swaminarayan* — ॐ
