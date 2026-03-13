<div align="center">

```
 ✦  ॐ  ✦
```

# AksharAI
### *Transformer-powered RAG · Vector Embeddings · Semantic Search over Swaminarayan Scriptures*

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-HNSW-orange?style=flat-square)](https://trychroma.com)
[![Ollama](https://img.shields.io/badge/LLM-Ollama%20Local-gray?style=flat-square)](https://ollama.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)

> A production-grade **Retrieval-Augmented Generation (RAG)** system built on the complete sacred corpora of **Vachnamrut** (274 discourses) and **Swamini Vato** (1,484 verses) of the Swaminarayan Sampraday — delivering semantically grounded, theologically precise, multi-lingual query resolution through a transformer-based dense retrieval architecture, HNSW-indexed vector persistence, and a fully **local LLM inference stack via Ollama** — no cloud API required.

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
║      ├──  WHERE book = "Vachnamrut"    → top-50, score filter ≥0.65 ║
║      └──  WHERE book = "Swamini Vato"  → top-50, score filter ≥0.65 ║
║      │    score = 1 − cosine_distance                               ║
║      │                                                              ║
║      ▼                                                              ║
║  Context Window Assembly                                            ║
║      │    All passages with score ≥ 0.65, sorted by relevance       ║
║      │                                                              ║
║      ▼                                                              ║
║  Step 1 — English Answer Generation                                 ║
║      │    qwen2.5:3b via Ollama (local, no API key)                 ║
║      │    repeat_penalty=1.3 to prevent repetition loops            ║
║      │                                                              ║
║      ▼                                                              ║
║  Step 2 — Translation (only if GU / HI requested)                   ║
║      │    llama3:8b via Ollama (better multilingual support)        ║
║      │    Separate translation pass — prevents generation loops     ║
║      │                                                              ║
║      ▼                                                              ║
║  Grounded Answer + Full Source Attribution                          ║
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
| **LLM — Answer** | `qwen2.5:3b` via Ollama | Local inference; fast English generation; repeat_penalty=1.3 |
| **LLM — Translation** | `llama3:8b` via Ollama | Local inference; superior multilingual (GU/HI) support |
| **Backend Framework** | FastAPI + Uvicorn | Async ASGI server; CORS middleware; Pydantic request validation |
| **Frontend Framework** | Next.js 16 + TypeScript | App Router; SSR-capable; strict TypeScript mode |
| **UI State** | React hooks + localStorage | Persistent chat history; no external state library |
| **Styling** | Tailwind CSS | Utility-first composition |

---

## Corpus Composition

| Scripture | Document Count | Geographical Scope | Structural Format |
|---|---|---|---|
| **Vachnamrut** | 274 discourses | Gadhada I–III · Sarangpur · Kariyani · Loya · Panchala · Vartal · Amdavad · Jetalpur | Verbatim prose discourses delivered by Sahajanand Swami |
| **Swamini Vato** | 1,484 verses | Prakarans 1–7 (342 · 192 · 74 · 140 · 407 · 292 · 37) | Aphoristic spiritual utterances of Gunatitanand Swami |
| **Total Indexed** | **1,756 documents** | Complete canonical corpus | — |

---

## Frontend — AksharAI Chat Interface

The frontend is a full-screen ChatGPT-style interface built with Next.js 16 and TypeScript.

### Features

| Feature | Description |
|---|---|
| **Chat History Sidebar** | Persistent conversation history stored in `localStorage`; grouped by Today / Yesterday / Previous 7 Days / Older |
| **New Chat** | Start a fresh session anytime; previous chats saved automatically |
| **Delete Chat** | Hover any chat in the sidebar → trash icon appears |
| **View All Sources** | Every assistant response shows a collapsible "View all sources (N)" link listing all matched scripture passages |
| **Read Full Text** | Click "Read full" on any source → modal opens with the complete Vachnamrut discourse or Swamini Vato verse |
| **Multi-language** | EN / GU / HI toggle in header; 2-step translation prevents repetition loops |
| **Error Handling** | Distinct red warning UI for backend errors, timeouts, and rate limits |
| **Responsive** | Sidebar collapses on mobile via PanelLeft toggle |

### Layout

```
┌─────────────────┬────────────────────────────────────────┐
│  Sidebar        │  Header (AksharAI · EN/GU/HI · + New) │
│                 ├────────────────────────────────────────┤
│  + New Chat     │                                        │
│                 │   User message (right-aligned bubble)  │
│  Today          │                                        │
│  · Chat 1       │   Assistant answer (plain text)        │
│  · Chat 2       │   📖 View all sources (8)  ▾           │
│                 │     Vachnamrut · GI-1 — Title          │
│  Yesterday      │       "passage text..."   [Read full]  │
│  · Chat 3       │     ─────────────────────────────────  │
│                 │     Swamini Vato · Prakaran 2, Verse 5 │
│                 │       "passage text..."   [Read full]  │
│                 ├────────────────────────────────────────┤
│                 │  [ Input box                      ▶ ]  │
└─────────────────┴────────────────────────────────────────┘
```

---

## RAG Pipeline — Key Design Decisions

### Score-based Retrieval (not fixed top-K)
Instead of always returning exactly 4 documents per book, the system queries up to 50 candidates per book and filters by **cosine similarity score ≥ 0.65**. This means:
- High-relevance queries return many grounded sources
- Low-relevance queries return fewer (or zero) sources rather than hallucinated ones

### 2-Step Translation Architecture
Small local models (3B parameters) are unstable when generating non-Latin scripts directly — they enter repetition loops. AksharAI solves this by:
1. **Step 1** — Always generate the answer in English using `qwen2.5:3b` (fast, stable)
2. **Step 2** — If Gujarati/Hindi is requested, translate using `llama3:8b` (better multilingual support) in a separate pass

Both steps use `repeat_penalty=1.3` as an additional safety net.

### Full Local Stack
No cloud API keys required. All inference runs on-device via Ollama:
- `qwen2.5:3b` — ~4 seconds per answer on Apple M-series
- `llama3:8b` — ~10 seconds for translation pass
- `BAAI/bge-small-en-v1.5` — ~0.1 seconds for embedding

---

## Repository Structure

```
aksharai/
│
├── .env                              # Credential store — NEVER commit to VCS
│
├── scraper/
│   ├── scrape_vachnamrut.py          # Playwright corpus acquisition — 274 discourses
│   ├── scrape_swamini_vato.py        # Playwright corpus acquisition — 1,484 verses
│   ├── test_scrape.py                # Structural integrity validation harness
│   └── requirements.txt
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
│   ├── main.py                       # FastAPI app — chat, source lookup endpoints
│   ├── ingest.py                     # Embedding + ChromaDB vectorisation pipeline
│   ├── clean_data.py                 # Corpus sanitisation + normalisation
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── api/chat/route.ts         # Next.js API proxy — chat endpoint
    │   ├── api/source/route.ts       # Next.js API proxy — full source lookup
    │   ├── layout.tsx                # Root layout — metadata, fonts
    │   ├── page.tsx                  # Entry point
    │   └── globals.css               # Global styles
    ├── components/
    │   ├── chat-page.tsx             # Main chat UI — sidebar, messages, input, modal
    │   └── ui/                       # Reusable UI primitives (shadcn/ui)
    └── lib/
        └── language-context.tsx      # EN/GU/HI translation context + strings
```

---

## Deployment — Execution Protocol

### Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Python | 3.11 | Required for backend |
| Node.js | 18 LTS | Required for Next.js |
| Ollama | Latest | Must be running locally |
| RAM | 8 GB | Accommodates llama3:8b + ChromaDB + embedding model |
| Disk | 8 GB | Ollama models (~7GB) + vector index + corpus |

### Step 1 — Install Ollama & pull models

```bash
# Install Ollama from https://ollama.ai
ollama pull qwen2.5:3b
ollama pull llama3
```

### Step 2 — Corpus Acquisition

```bash
cd scraper
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

python scrape_vachnamrut.py    # ~45 minutes, checkpoint-safe
python scrape_swamini_vato.py  # ~15 minutes, checkpoint-safe
```

### Step 3 — Vector Index Construction

```bash
cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

python clean_data.py  # sanitise raw corpora
python ingest.py      # embed 1,756 docs + build HNSW index (~45s)
```

### Step 4 — Start Backend

```bash
python main.py
# INFO: Uvicorn running on http://0.0.0.0:8000
# INFO: Ready! 1756 docs in ChromaDB.
```

### Step 5 — Start Frontend

```bash
cd frontend
npm install
npm run dev
# ready on http://localhost:3000
```

---

## API Specification

### `POST /chat`

**Request:**
```json
{
  "query": "How does one overcome maya?",
  "language": "english"
}
```

| Field | Type | Values |
|---|---|---|
| `query` | `string` | Any spiritual/philosophical question |
| `language` | `string` | `"english"` · `"gujarati"` · `"hindi"` |

**Response:**
```json
{
  "answer": "According to Vachnamrut GI-7...",
  "language": "english",
  "sources": [
    {
      "book": "Vachnamrut",
      "loc": "GI",
      "vachno": "7",
      "reference": "GI-7",
      "title": "The Nature of Maya",
      "place": "Gadhada I",
      "text": "...",
      "score": 0.734
    }
  ],
  "total_matches": { "vachnamrut": 3, "swamini_vato": 5, "total": 8 }
}
```

---

### `GET /source/vachnamrut/{loc}/{vachno}`

Returns the **complete text** of a Vachnamrut discourse.

```bash
GET /source/vachnamrut/GI/1
```
```json
{
  "book": "Vachnamrut",
  "vachno": 1,
  "loc": "GI",
  "place": "Gadhada I",
  "title": "Continuously Engaging One's Mind on God",
  "text": "On the night of Māgshar sudi 4..."
}
```

---

### `GET /source/swamini_vato/{prakaran}/{verse_no}`

Returns the **complete text** of a Swamini Vato verse.

```bash
GET /source/swamini_vato/2/75
```
```json
{
  "book": "Swamini Vato",
  "prakaran": 2,
  "verse_no": 75,
  "text": "In the Vachanamrut, Maharaj has revealed..."
}
```

---

### `GET /health`

```json
{ "status": "ok", "documents": 1756 }
```

---

## Known Constraints

| Constraint | Detail | Mitigation |
|---|---|---|
| **Local model quality** | `qwen2.5:3b` is a small model; answers may be less nuanced than GPT-4 class | Swap `ANSWER_MODEL` to any Ollama model (e.g. `llama3:70b`) |
| **Gujarati/Hindi loops** | Small models loop on non-Latin scripts | 2-step translation via `llama3:8b` + repeat_penalty=1.3 |
| **Embedding language** | `bge-small-en-v1.5` trained on English; GU/HI queries have lower retrieval quality | Issue queries in English for best results |
| **Static corpus** | Knowledge base reflects scrape-time state of anirdesh.com | Checkpoint-safe scrapers allow full re-ingest |
| **Context window** | Long chats don't carry history to LLM yet | Planned: rolling summary context |

---

## License

This repository is made available for educational, research, and non-commercial spiritual purposes. All scriptural content — Vachnamrut and Swamini Vato — remains the intellectual property of its respective publishers and sampraday custodians. The software infrastructure is released for non-commercial use only.

---

<div align="center">

```
✦  ———————————————————  ✦
     ॐ  Jai Swaminarayan  ॐ
✦  ———————————————————  ✦
```

*Built with reverence for the sacred wisdom of the Swaminarayan Sampraday.*

</div>
