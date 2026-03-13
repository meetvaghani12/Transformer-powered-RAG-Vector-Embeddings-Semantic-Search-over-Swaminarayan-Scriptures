<div align="center">

```
 ✦  ॐ  ✦
```

# Vachanamrut Intelligence Engine
### *Retrieval-Enhanced Spiritual Advisory System*

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-HNSW-orange?style=flat-square)](https://trychroma.com)
[![OpenRouter](https://img.shields.io/badge/LLM-OpenRouter-purple?style=flat-square)](https://openrouter.ai)

> A production-grade **Retrieval-Augmented Generation (RAG)** system constructed atop the complete sacred corpora of **Vachnamrut** (274 discourses) and **Swamini Vato** (1,484 aphoristic verses) of the Swaminarayan Sampraday — delivering semantically grounded, theologically precise, multi-lingual query resolution through a transformer-based dense retrieval architecture, HNSW-indexed vector persistence, and multi-model generative synthesis with zero single-point-of-failure.

</div>

---

## System Architecture

```
╔═════════════════════════════════════════════════════════════════════╗
║                        OFFLINE INGESTION PIPELINE                   ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  anirdesh.com                                                       ║
║      │                                                              ║
║      ▼                                                              ║
║  Playwright (Chromium, headless)  ──►  Raw HTML / JS DOM            ║
║      │                                                              ║
║      ▼                                                              ║
║  BeautifulSoup4 + lxml Parser     ──►  Structured JSON Corpus       ║
║      │                     ┌──────────────────────────────────┐    ║
║      │                     │  Vachnamrut:   274 discourses    │    ║
║      │                     │  Swamini Vato: 1,484 verses      │    ║
║      │                     └──────────────────────────────────┘    ║
║      ▼                                                              ║
║  Corpus Sanitization (clean_data.py)                                ║
║      │    • Strip JS injection artifacts                            ║
║      │    • Remove nav/footer boilerplate                           ║
║      │    • Normalize Unicode whitespace                            ║
║      ▼                                                              ║
║  BAAI/bge-small-en-v1.5  ──►  384-dim float32 Dense Embeddings      ║
║      │    (sentence-transformers, CPU, batch_size=64)               ║
║      ▼                                                              ║
║  ChromaDB PersistentClient  ──►  HNSW Index (cosine metric)         ║
║      │    • data/chromadb/ — survives process restarts              ║
║      │    • Resume-safe: skips already-indexed document IDs         ║
║      │    • Total indexing time: ~45s for 1,756 documents           ║
║      ▼                                                              ║
║                    [ VECTOR STORE READY ]                           ║
╚═════════════════════════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════════════════════════╗
║                        ONLINE INFERENCE PATH                        ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  POST /chat  { query, language }                                    ║
║      │                                                              ║
║      ▼                                                              ║
║  BGE Encoder  ──►  384-dim Query Vector                             ║
║      │                                                              ║
║      ▼                                                              ║
║  Dual-Partition ANN Retrieval (ChromaDB)                            ║
║      ├──  WHERE book = "Vachnamrut"    → top-4 by cosine similarity ║
║      └──  WHERE book = "Swamini Vato"  → top-4 by cosine similarity ║
║      │                                                              ║
║      ▼                                                              ║
║  Context Window Assembly                                            ║
║      │    [source_ref]\n{doc[:600]}  × 8 passages                   ║
║      │    Relevance score: 1 − cosine_distance                      ║
║      │                                                              ║
║      ▼                                                              ║
║  Single-Pass Prompt Construction                                    ║
║      │    • Domain persona (Swaminarayan philosophy expert)         ║
║      │    • 8 grounded retrieval passages with inline citations      ║
║      │    • Inline language directive (EN / GU / HI)                ║
║      │      — zero second-call translation overhead                 ║
║      │                                                              ║
║      ▼                                                              ║
║  OpenRouter Multi-Model Fallback Chain                              ║
║      ┌─────────────────────────────────────────────────────────┐   ║
║      │  1. stepfun/step-3.5-flash:free           (primary)     │   ║
║      │  2. google/gemma-3-12b-it:free            (fallback 1)  │   ║
║      │  3. google/gemma-3-4b-it:free             (fallback 2)  │   ║
║      │  4. google/gemma-3-27b-it:free            (fallback 3)  │   ║
║      │  5. meta-llama/llama-3.3-70b-instruct:free(fallback 4)  │   ║
║      │  6. mistralai/mistral-small-3.1-24b:free  (fallback 5)  │   ║
║      └─────────────────────────────────────────────────────────┘   ║
║      │    Sequential retry on RateLimitError / 429 response         ║
║      │                                                              ║
║      ▼                                                              ║
║  Grounded Answer + Dual-Source Attribution + Language Output        ║
║                                                                     ║
╚═════════════════════════════════════════════════════════════════════╝
```

---

## Technology Stack

| Layer | Component | Specification |
|---|---|---|
| **Document Acquisition** | Playwright (Chromium, headless) | JS-executed DOM traversal; async page navigation with network idle await |
| **HTML Parsing** | BeautifulSoup4 + lxml | XPath-class selector targeting of `div#vach_text` and `div#vat_en_{N}` |
| **Metadata Extraction** | Python `re` (regex) | Regex capture of embedded JS object `var vach = { title, place, loc }` |
| **Corpus Sanitization** | Custom `clean_data.py` | Boilerplate stripping, Unicode normalization, artifact elimination |
| **Embedding Model** | `BAAI/bge-small-en-v1.5` | 384-dimensional float32 semantic embeddings; 100% local CPU inference; no API quota |
| **Vector Store** | ChromaDB (PersistentClient) | HNSW Approximate Nearest Neighbor index; cosine similarity metric; disk-persisted |
| **LLM Inference** | OpenRouter API | OpenAI-compatible endpoint; 6-model sequential fallback; `temperature=0.3`, `max_tokens=2048` |
| **Translation** | In-context zero-shot prompting | Single generative pass for EN/GU/HI; eliminates second API round-trip |
| **Backend Framework** | FastAPI + Uvicorn | Async ASGI server; CORS middleware; Pydantic request validation |
| **Frontend Framework** | Next.js 16 + TypeScript | Client-side React; SSR-capable; strict TypeScript mode |
| **Animation Engine** | Framer Motion | Declarative `whileInView` scroll-reveal; physics-based spring transitions |
| **Styling** | Tailwind CSS + Custom CSS | Utility-first composition with bespoke sacred design token system |

---

## Corpus Composition

| Scripture | Document Count | Geographical Scope | Structural Format |
|---|---|---|---|
| **Vachnamrut** | 274 discourses | Gadhada I–III · Sarangpur · Kariyani · Loya · Panchala · Vartal · Amdavad · Jetalpur | Verbatim prose discourses delivered by Sahajanand Swami |
| **Swamini Vato** | 1,484 verses | Prakarans 1–7 (342 · 192 · 74 · 140 · 407 · 292 · 37) | Aphoristic spiritual utterances of Gunatitanand Swami |
| **Total Indexed** | **1,756 documents** | Complete canonical corpus | — |

---

## RAG Pipeline — Architectural Deep Dive

### Phase 1 — Dynamic Content Acquisition (`scraper/`)

Playwright instantiates a headless Chromium process and awaits `networkidle` state prior to DOM interrogation, ensuring complete JavaScript hydration of server-rendered content. The extraction logic bifurcates by scripture:

- **Vachnamrut**: Iterates URL parameter `vachno=1..274`; targets `div#vach_text` for discourse prose; recovers structured metadata (`title`, `place`, `loc`) via regex match against the embedded JavaScript object `var vach = {...}` injected inline by the server
- **Swamini Vato**: Traverses all 7 Prakarans via paginated `beg` cursor offsets; extracts individual verse content from `div#vat_en_{N}` selectors where `N` denotes the per-page verse ordinal

Both scrapers implement **checkpoint-based resumability** — progress is persisted to JSON after each successful extraction, precluding redundant re-scraping on process interruption.

### Phase 2 — Vectorisation & Index Construction (`backend/ingest.py`)

```
Cleaned JSON Corpus
      │
      ▼  SentenceTransformer.encode(texts, batch_size=64)
      │
      ▼  384-dim float32 vector per document
      │
      ▼  chromadb.PersistentClient → collection.add(
      │       ids, embeddings, documents, metadatas
      │  )
      │  Duplicate guard: collection.get(ids) → skip existing
      │
      ▼  HNSW index committed to data/chromadb/
         Total wall time: ~45s (CPU, no network I/O)
```

The embedding model `BAAI/bge-small-en-v1.5` was selected for its superior zero-shot retrieval performance on English semantic similarity benchmarks at the 384-dimensional operating point — avoiding the API quota constraints and per-request latency of cloud embedding providers.

### Phase 3 — Semantic Retrieval (`backend/main.py`)

At inference time, the system executes the following deterministic retrieval protocol:

1. Encode the raw user query string via the same `SentenceTransformer` instance used during ingestion (embedding space consistency)
2. Issue two independent ANN queries against the unified ChromaDB collection using metadata-level predicate filtering:
   - `WHERE book = "Vachnamrut"` → top-4 nearest neighbours by cosine similarity
   - `WHERE book = "Swamini Vato"` → top-4 nearest neighbours by cosine similarity
3. Materialise relevance scores: `score = 1 − cosine_distance ∈ [0, 1]`
4. Assemble context window: `[{source_reference}]\n{document[:600]}` concatenated across all 8 retrieved passages, separated by horizontal rule tokens

The dual-partition retrieval strategy enforces **balanced cross-corpus citation** — preventing either scripture from being entirely crowded out by the other's denser topical coverage.

### Phase 4 — Grounded Generative Synthesis

Prompt construction follows a strict structure:

```
[SYSTEM PERSONA]
  Expert in Swaminarayan philosophy, trained exclusively on Vachnamrut and Swamini Vato.
  Instruction: answer solely from provided passages; cite sources explicitly.

[RETRIEVED CONTEXT BLOCK]
  8 passages × (source_ref + 600-char excerpt)

[USER QUERY]
  {raw_query}

[LANGUAGE DIRECTIVE]  ← appended only for non-English targets
  "Write your answer in {Gujarati|Hindi}. Preserve scripture references in English."
```

The inline language directive enables **zero-shot multilingual generation** within a single forward pass — entirely eliminating the latency and token cost of a secondary translation API call that would otherwise double per-request overhead.

The `FREE_MODELS` fallback chain iterates sequentially on any `Exception` (rate limit, provider outage, quota exhaustion), providing resilience across the inherently unstable free-tier model landscape:

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

---

## Repository Structure

```
swaminarayan-rag/
│
├── .env                              # Credential store — NEVER commit to VCS
│
├── scraper/
│   ├── scrape_vachnamrut.py          # Playwright corpus acquisition — 274 discourses
│   ├── scrape_swamini_vato.py        # Playwright corpus acquisition — 1,484 verses
│   ├── test_scrape.py                # Structural integrity validation harness
│   └── requirements.txt             # Scraper-isolated dependency manifest
│
├── data/
│   ├── vachnamrut/
│   │   ├── vachnamrut_en.json        # Raw extraction output
│   │   └── vachnamrut_clean.json     # Post-sanitization corpus
│   ├── swamini_vato/
│   │   ├── swamini_vato_en.json      # Raw extraction output
│   │   └── swamini_vato_clean.json   # Post-sanitization corpus
│   └── chromadb/                     # Persisted HNSW vector index (binary)
│
├── backend/
│   ├── main.py                       # FastAPI ASGI application — inference endpoint
│   ├── ingest.py                     # Embedding + ChromaDB vectorisation pipeline
│   ├── clean_data.py                 # Corpus sanitisation + normalisation
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── layout.tsx                # Root layout — Google Fonts, metadata
    │   ├── page.tsx                  # Primary chat interface — query, response, sources
    │   └── globals.css               # Design token system + animation keyframes
    └── components/
        ├── MandalaBackground.tsx     # Dual-layer counter-rotating SVG mandala overlay
        └── SourceCard.tsx            # Scroll-triggered perspective-entry source card
```

---

## Deployment — Execution Protocol

### System Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Python | 3.11 | Mandatory — Playwright `greenlet` incompatible with 3.12+ on certain platforms |
| Node.js | 18 LTS | Required for Next.js compilation toolchain |
| RAM | 4 GB | Accommodates embedding model in-memory + ChromaDB HNSW graph |
| Disk | 500 MB | Chromium binary (~200MB) + vector index (~50MB) + model weights (~130MB) |

### Phase 1 — Corpus Acquisition

```bash
cd scraper
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# Acquire Vachnamrut — 274 discourses (~45 minutes, checkpoint-safe)
python scrape_vachnamrut.py

# Acquire Swamini Vato — 1,484 verses (~15 minutes, checkpoint-safe)
python scrape_swamini_vato.py
```

### Phase 2 — Vector Index Construction

```bash
cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Sanitise raw corpora — strips JS artifacts, normalises Unicode
python clean_data.py

# Batch-embed 1,756 documents and construct HNSW index (~45 seconds)
python ingest.py
```

### Phase 3 — Backend Process

```bash
python main.py
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Ready! 1756 docs in ChromaDB.
```

### Phase 4 — Frontend Process

```bash
cd frontend
npm install
npm run dev
# ready - started server on http://localhost:3000
```

---

## API Specification

### `POST /chat`

Accepts a theological query and target language; returns a grounded generative answer with full dual-source attribution.

**Request Schema:**
```json
{
  "query": "How does one overcome maya according to Shriji Maharaj?",
  "language": "english"
}
```

| Field | Type | Constraints |
|---|---|---|
| `query` | `string` | Non-empty; forwarded verbatim to embedding encoder |
| `language` | `string` | `"english"` · `"gujarati"` · `"hindi"` — defaults to `"english"` |

**Response Schema:**
```json
{
  "answer": "According to Vachnamrut GI-7, Shriji Maharaj explains...",
  "language": "english",
  "vachnamrut_matches": [
    {
      "book": "Vachnamrut",
      "reference": "GI-7",
      "title": "The Nature of Maya",
      "place": "Gadhada I",
      "text": "...",
      "score": 0.734
    }
  ],
  "swamini_vato_matches": [
    {
      "book": "Swamini Vato",
      "prakaran": 1,
      "verse_no": 189,
      "reference": "Prakaran 1, Verse 189",
      "text": "...",
      "score": 0.691
    }
  ],
  "sources": [ /* all 8 results, sorted descending by relevance score */ ],
  "total_matches": {
    "vachnamrut": 4,
    "swamini_vato": 4,
    "total": 8
  }
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `429` | All 6 LLM models simultaneously rate-limited — retry after ~60 seconds |
| `500` | Unrecoverable backend exception — check Uvicorn stderr |

---

### `GET /health`

Liveness probe — confirms vector store connectivity and document count.

```json
{
  "status": "ok",
  "documents": 1756
}
```

---

## Environment Variables

```env
OPENROUTER_API_KEY=sk-or-v1-...    # Required — primary LLM provider
GOOGLE_API_KEY=...                  # Optional — reserved for future Gemini integration
GROQ_API_KEY=...                    # Optional — reserved for supplementary fallback
VOYAGE_API_KEY=...                  # Optional — reserved for high-dimensional reranking
```

> **Security Note:** The `.env` file is excluded from version control via `.gitignore`. Committing API credentials to a public repository constitutes a critical security vulnerability and will result in immediate key revocation by the respective providers.

---

## Frontend Design System

The interface implements a bespoke **sacred-luxury** visual language — eschewing conventional AI product aesthetics in favour of an immersive devotional aesthetic grounded in Swaminarayan iconographic tradition.

### Design Token Reference

| CSS Custom Property | Hex Value | Semantic Role |
|---|---|---|
| `--bg-deep` | `#0D0A00` | Base canvas — near-absolute warm void; evokes sanctum sanctorum |
| `--gold-primary` | `#C8860A` | Deep saffron — primary interactive affordances, borders |
| `--gold-bright` | `#F5C842` | Lambent gold — headings, shimmer terminus, score badges |
| `--cream` | `#F5ECD7` | Warm cream — primary body copy, answer text |
| `--cream-dim` | `#C9B99A` | Attenuated cream — secondary metadata, source excerpts |

### Typographic Hierarchy

| Typeface | Classification | Application |
|---|---|---|
| `Cinzel` | Neo-Roman majuscule | Primary headings, section labels, score badges |
| `Cormorant Garamond` | High-contrast transitional serif | Subtitles, supplementary italicised copy |
| `EB Garamond` | Classical oldstyle roman | Answer body text, source passage excerpts |

### Animation Specifications

| Component | Technique | Parameters |
|---|---|---|
| `MandalaBackground` | Dual-layer counter-rotating SVG | Outer: 120s period · Inner: 80s period · `opacity: 0.04/0.05` |
| `shimmer-text` | CSS `background-position` sweep | 200% `background-size`; 4s linear infinite cycle |
| `SourceCard` | Framer Motion `whileInView` | `rotateX: -10° → 0°` perspective entry; `delay: index × 70ms` |

---

## Known Constraints & Architectural Trade-offs

| Constraint | Technical Detail | Mitigation Strategy |
|---|---|---|
| **Free-tier LLM rate limits** | OpenRouter free models impose ~3–10 RPM per model; concurrent saturation is possible under load | 6-model sequential fallback chain; graceful `HTTPException(429)` with user-facing message |
| **Embedding dimensionality ceiling** | `bge-small-en-v1.5` operates at 384 dimensions; recall degrades for highly abstractly-phrased queries | Upgrade path: `BAAI/bge-large-en-v1.5` (1024-dim) or `text-embedding-3-large` (3072-dim) |
| **Context window truncation** | Retrieval passages capped at `doc[:600]` characters to remain within free-tier prompt token budgets | Upgrade path: paid tier models with 32K–128K context windows |
| **Single-collection architecture** | All 1,756 documents coexist in one ChromaDB collection, partitioned via metadata predicates | Upgrade path: separate collections per scripture for independent index tuning |
| **Static corpus** | Knowledge base reflects the state of `anirdesh.com` at scrape time; no incremental update mechanism | Mitigated by checkpoint-safe scrapers; full re-ingest is idempotent |
| **Monolingual embedding space** | `bge-small-en-v1.5` was trained on English data; Gujarati/Hindi queries may exhibit degraded retrieval quality | Mitigation: issue queries in English; output language is a generation-time directive, not a retrieval-time concern |

---

## License

This repository is made available for educational, research, and non-commercial spiritual purposes. All scriptural content — Vachnamrut and Swamini Vato — remains the intellectual property of its respective publishers and sampraday custodians. The software infrastructure (pipeline, backend, frontend) is released for non-commercial use only.

---

<div align="center">

```
✦  ———————————————————  ✦
     ॐ  Jai Swaminarayan  ॐ
✦  ———————————————————  ✦
```

*Built with reverence for the sacred wisdom of the Swaminarayan Sampraday.*

</div>
