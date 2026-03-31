## AksharAI — Module-by-Module Rating

### 1. SCRAPER — 6/10
**What works:** Resume support, Playwright for JS-rendered pages, periodic saves.

**What's bad:**
- Hardcoded `sleep(1500ms)` everywhere — fragile, will break when site is slow
- Zero retry logic — if a page fails, it's just skipped forever
- Magic numbers scattered (1500, 30000, 50, 10, 30) — no constants
- Default fallback of 50 verses is wrong (Prakarans have 300+)
- `requests` in requirements.txt but never used
- `print()` for logging — no levels, no timestamps, no log file
- No data validation — empty/malformed text gets saved silently
- Regex for verse detection (`(\d+)\s*(?:વાત|vato|Vato)`) is brittle

**Improvements:**
- Add exponential backoff + retry (3 attempts per page)
- Use Python `logging` module
- Validate extracted text length before saving
- Extract all magic numbers to constants
- Add `--dry-run` and `--single-page` CLI flags for testing

---

### 2. INGESTION (ingest.py) — 5/10
**What works:** Resume-safe, batch processing, simple and clean.

**What's bad:**
- Uses `BAAI/bge-small-en-v1.5` but `main.py` uses `paraphrase-multilingual-MiniLM-L12-v2` — **MODEL MISMATCH**. The ingest script creates embeddings with a different model than what queries them. This silently destroys retrieval quality.
- Creates collection `swaminarayan_rag` but main.py expects `swaminarayan_rag_en/gu/hi` — **COLLECTION NAME MISMATCH**
- No multilingual ingestion — only English
- No validation of input JSON structure
- Text truncated to 2000 chars with no logging of what was cut
- No error handling per-batch — one bad doc kills the whole run

**Improvements:**
- **Critical:** Align embedding model with `main.py` (use the same model)
- **Critical:** Create the 3 multilingual collections that `main.py` actually expects
- Add per-batch error handling with skip + log
- Log truncation warnings
- Add `--validate-only` mode

---

### 3. BACKEND (main.py) — 7.5/10
**What works:** Multilingual parallel retrieval is genuinely clever. Query rewriting with LLM for pronouns/references is smart. Hybrid semantic + keyword search is solid RAG architecture. Source indexing for full-text lookup works well.

**What's bad:**
- `allow_origins=["*"]` — wide open CORS, anyone can hit your API
- All models/indexes loaded at module level — crashes the entire server if one file is missing
- `except Exception: pass` in multiple places — silent failures with zero logging
- Google Translate dependency is fragile (rate limits, outages) with no caching
- No rate limiting on any endpoint — one user can DOS the LLM
- No input sanitization — `query` goes straight into prompts (prompt injection risk)
- `async def chat()` but all the heavy work is synchronous `ThreadPoolExecutor` — blocks the event loop
- No streaming — user waits 10-30s staring at nothing while llama3 thinks
- No request/response logging

**Improvements:**
- ~~Add streaming response~~ — **DONE** (`/chat/stream` SSE endpoint)
- ~~Add rate limiting~~ — **DONE** (slowapi: 10/min on `/chat`, 15/min on `/summarize`)
- ~~Cache translations~~ — **DONE** (LRU cache with 512 entries on `_translate_text`)
- ~~Add proper `logging` instead of `print()`~~ — **DONE** (all print→log.info/warning)
- ~~Restrict CORS~~ — **DONE** (configurable via `CORS_ORIGINS` env var, defaults to localhost:3000)
- ~~Add basic prompt injection guardrails~~ — **DONE** (blocks "ignore previous instructions" etc. + 2000 char query limit)
- ~~Log silent exceptions~~ — **DONE** (all `except Exception: pass` → `log.warning()`)
- Use `@app.on_event("startup")` for model loading
- ~~Make heavy compute truly async~~ — **DONE** (`asyncio.to_thread` in streaming endpoint)

---

### 4. FRONTEND — 6/10
**What works:** Auth flow is security-conscious (constant-time comparison, bcrypt, OTP). Multi-language context works. API proxy pattern with timeouts is correct. UI is polished with Framer Motion animations.

**What's bad:**
- **`chat-page.tsx` is 967 lines** — absolute god component. 9+ `useState` calls, API calls, rendering, auth logic, localStorage access, all jammed together
- `react-hook-form` is in `package.json` but **never used** — login/signup have manual `onChange` handlers with no validation
- No error boundaries anywhere
- No loading skeletons — just blank screens while waiting
- No request debouncing — rapid clicking sends duplicate API calls
- `localStorage` accessed directly outside React state — race conditions
- `chat-interface.tsx` (211 lines) appears to be dead code (redundant with chat-page)
- Language translations hardcoded in context — doesn't scale
- `.env.local` has Gmail app password committed to git history (security issue)

**Improvements:**
- ~~**Urgent:** Split `chat-page.tsx` into 5+ components~~ — **DONE** (9 files)
- ~~**Urgent:** Use `useReducer` or Zustand for chat state~~ — **DONE**. Created `use-chat-state.ts` with typed reducer (20 actions), replaced all 11 `useState` calls in chat-page.tsx
- ~~Use `react-hook-form` + `zod` for auth forms~~ — **DONE**. Login + signup now use zod schemas with real-time field validation
- ~~Add error boundaries~~ — **DONE**. ErrorBoundary wraps chat page with branded fallback UI + reload button
- ~~Add debouncing on send button~~ — **DONE**. 500ms ref-based lock prevents duplicate submissions
- ~~Remove dead `chat-interface.tsx`~~ — **DONE**
- Move translations to i18n library (next-intl)
- Rotate that Gmail app password immediately

---

### 5. DATA/ARCHITECTURE — 6.5/10
**What works:** ChromaDB with HNSW cosine index is appropriate. Dual-partition retrieval (Vachnamrut vs Swamini Vato) is smart. Persistent vector store survives restarts.

**What's bad:**
- **ingest.py and main.py are completely out of sync** — different embedding models, different collection names. The ingest script is essentially useless for the current backend
- No `.env` for backend config — everything hardcoded
- No Docker/docker-compose — setup requires 15 manual steps
- No tests whatsoever — zero. Not one.
- No CI/CD
- Translated data files (gu/hi) not in the GitHub repo — deployment is broken out of the box
- `data/chromadb/` is gitignored but required — no docs on how to recreate it

**Improvements:**
- Fix the ingest ↔ main model/collection alignment (this is a **data corruption** level bug)
- Add `docker-compose.yml` (Ollama + backend + frontend + postgres)
- Add a single `setup.sh` that does everything
- ~~Write at least integration tests~~ — **DONE**. 26 tests covering `/health`, `/chat`, `/chat/stream`, `/summarize`, `/suggestions`, `/source/*`, `/translate` — all passing
- Use `.env` for ALL config (model names, thresholds, ports)
- Document the full setup process

---

## OVERALL SCORES

| Module | Rating | One-liner |
|--------|--------|-----------|
| Scraper | **6/10** | Works but fragile, no retries, will break silently |
| Ingestion | **5/10** | **Broken** — wrong model & collection names vs backend |
| Backend | **7.5/10** | Best module. Smart retrieval, but no streaming, no rate limits |
| Frontend | **6/10** | 967-line god component, unused deps, no validation |
| Architecture | **6.5/10** | Good ideas, terrible DX — no tests, no Docker, broken setup |
| **Overall** | **6.5/10** | Solid prototype, not production-ready |

---

## Top 5 Things to Fix Right Now

1. ~~**Add streaming to `/chat`**~~ — **DONE**. Added `/chat/stream` SSE endpoint in backend, frontend now streams tokens in real-time
2. ~~**Fix ingest.py**~~ — **DONE**. Aligned model to `paraphrase-multilingual-MiniLM-L12-v2`, creates 3 collections (`_en/_gu/_hi`), added `--validate`, `--rebuild`, `--lang`, per-batch error handling, logging
3. ~~**Split `chat-page.tsx`**~~ — **DONE**. 1020 lines → 9 files: chat-page (432), chat-messages (221), source-modal (120), chat-sidebar (112), chat-header (91), chat-input (62), use-chat-db (41), chat-types (40), chat-storage (38). Deleted dead chat-interface.tsx
4. ~~**Add `docker-compose.yml`**~~ — **DONE**. Added docker-compose.yml (Postgres + Ollama + backend + frontend), Dockerfiles for both services, setup.sh one-click script, .env.example, .dockerignore files. Made Ollama host configurable via env var
5. **Rotate that Gmail app password** — it's in git history

---

## RAG/LLM Pipeline Overhaul (completed)

| # | Fix | Severity | Status |
|---|-----|----------|--------|
| 1 | **Chunking** — 500-char overlapping chunks (was whole-doc truncated to 2000) | CRITICAL | DONE — 1,756 docs → 6,486 chunks/lang |
| 2 | **System role** — separate system/user messages in LLM calls | CRITICAL | DONE |
| 3 | **Score threshold** — raised from 0.45 → 0.55 | MEDIUM | DONE |
| 4 | **Rate limit handler** — returns JSONResponse not HTTPException | SMALL | DONE |
| 5 | **Merged passage ranking** — all passages sorted by relevance, not per-book | MEDIUM | DONE |
| 6 | **Removed doc[:600] truncation** — full chunk text in prompt | MEDIUM | DONE |
| 7 | **keyword_fetch** — uses `get()` not `query()` for true keyword search | MEDIUM | DONE |
| 8 | **Shared ThreadPoolExecutor** — single pool reused across requests | MEDIUM | DONE |
| 9 | **Rewrite model** — configurable via `REWRITE_MODEL` env var | MEDIUM | DONE |
| 10 | **Dead code cleanup** — removed unused `results_by_lang`, duplicate imports, `[:4]→[:3]` | SMALL | DONE |
| 11 | **Cross-encoder reranking** — `ms-marco-MiniLM-L-6-v2` reranks candidates after bi-encoder retrieval, top-12 go to LLM | MEDIUM | DONE |
