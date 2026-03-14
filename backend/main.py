"""
FastAPI RAG backend — multilingual edition.
- Queries all 3 language collections IN PARALLEL, picks the best-matching one
- LLM always answers in English (stable, no repetition loops)
- Translates response to user's language via chunked parallel deep-translator
- Embedding model: paraphrase-multilingual-MiniLM-L12-v2 (384-dim, 50+ langs)
"""

import os
import json as _json
from concurrent.futures import ThreadPoolExecutor, as_completed
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from deep_translator import GoogleTranslator
import chromadb

load_dotenv("../.env")

# ── LLM ──────────────────────────────────────────────────────────────────────
llm_client = OpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1",
)
ANSWER_MODEL = "qwen2.5:3b"

# ── Retrieval config ──────────────────────────────────────────────────────────
CHROMA_DIR           = "../data/chromadb"
EMBED_MODEL          = "paraphrase-multilingual-MiniLM-L12-v2"
SCORE_THRESHOLD      = 0.45   # minimum cosine score to count as a match
MAX_SOURCES_PER_BOOK = 15     # max sources shown to user per book
PROMPT_TOP_K         = 8      # docs per book fed into LLM prompt
MAX_QUERY_K          = 50     # docs fetched from ChromaDB per book

# ── Language maps ─────────────────────────────────────────────────────────────
LANG_COLLECTIONS = {
    "english":  "swaminarayan_rag_en",
    "gujarati": "swaminarayan_rag_gu",
    "hindi":    "swaminarayan_rag_hi",
}

LANG_GT_CODE = {          # Google Translate target codes
    "english":  None,
    "gujarati": "gu",
    "hindi":    "hi",
}

TRANSLATE_CHUNK_SIZE = 4500   # chars per chunk (Google Translate limit ~5000)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="AksharAI RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup: load models & indexes ───────────────────────────────────────────
print("Loading multilingual embedding model...")
embed_model = SentenceTransformer(EMBED_MODEL)

print("Connecting to ChromaDB...")
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
collections = {
    lang: chroma_client.get_collection(col_name)
    for lang, col_name in LANG_COLLECTIONS.items()
}
for lang, col in collections.items():
    print(f"  [{lang}] {col.name}: {col.count()} docs")
print("ChromaDB ready.")

DATA_DIR = "../data"
_SOURCE_FILES = {
    "english":  ("vachnamrut_clean.json",  "swamini_vato_clean.json"),
    "gujarati": ("vachnamrut_gu.json",     "swamini_vato_gu.json"),
    "hindi":    ("vachnamrut_hi.json",     "swamini_vato_hi.json"),
}
VACHNAMRUT_INDEX:   dict[str, dict] = {}
SWAMINI_VATO_INDEX: dict[str, dict] = {}

for _lang, (_vf, _sf) in _SOURCE_FILES.items():
    with open(f"{DATA_DIR}/vachnamrut/{_vf}", encoding="utf-8") as f:
        _vd = _json.load(f)
    with open(f"{DATA_DIR}/swamini_vato/{_sf}", encoding="utf-8") as f:
        _sd = _json.load(f)
    VACHNAMRUT_INDEX[_lang]   = {(v["loc"], str(v["vachno"])): v for v in _vd}
    SWAMINI_VATO_INDEX[_lang] = {(str(v["prakaran"]), str(v["verse_no"])): v for v in _sd}
    print(f"  [{_lang}] {len(VACHNAMRUT_INDEX[_lang])} Vachnamrut + {len(SWAMINI_VATO_INDEX[_lang])} Swamini Vato entries")
print("Source indexes ready.")


# ── Models ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    query:    str
    language: str = "english"   # english | gujarati | hindi
    history:  str = ""          # rolling summary of previous messages

class SummarizeRequest(BaseModel):
    messages: list[dict]        # [{"role": "user"|"assistant", "content": "..."}]


# ── Helpers ───────────────────────────────────────────────────────────────────
def _translate_text(text: str, target: str) -> str:
    """Translate a single chunk (≤ TRANSLATE_CHUNK_SIZE chars)."""
    try:
        return GoogleTranslator(source="auto", target=target).translate(text) or text
    except Exception:
        return text


def translate_to(text: str, target_code: str) -> str:
    """
    Translate `text` → `target_code` by splitting into chunks and
    translating them IN PARALLEL, then re-joining.
    """
    if not target_code or not text.strip():
        return text

    # Split into chunks at sentence boundaries where possible
    chunks: list[str] = []
    current = ""
    for sentence in text.replace("\n", "\n ").split(". "):
        candidate = current + sentence + ". "
        if len(candidate) > TRANSLATE_CHUNK_SIZE and current:
            chunks.append(current.strip())
            current = sentence + ". "
        else:
            current = candidate
    if current.strip():
        chunks.append(current.strip())

    if not chunks:
        return text

    # Translate all chunks in parallel
    translated: list[str] = [""] * len(chunks)
    with ThreadPoolExecutor(max_workers=min(len(chunks), 8)) as ex:
        futures = {ex.submit(_translate_text, chunk, target_code): i
                   for i, chunk in enumerate(chunks)}
        for future in as_completed(futures):
            translated[futures[future]] = future.result()

    return " ".join(translated)


def _query_one_collection(lang: str, query_embedding: list[float]) -> dict:
    """
    Query a single ChromaDB collection and return raw results + relevance score.
    Called in parallel for all 3 languages.
    """
    col = collections[lang]
    vach = col.query(query_embeddings=[query_embedding],
                     n_results=MAX_QUERY_K, where={"book": "Vachnamrut"})
    vato = col.query(query_embeddings=[query_embedding],
                     n_results=MAX_QUERY_K, where={"book": "Swamini Vato"})

    # Relevance score = sum of top-K cosine scores (measures both quality + quantity)
    all_scores = (
        [1 - d for d in vach["distances"][0]] +
        [1 - d for d in vato["distances"][0]]
    )
    above = [s for s in all_scores if s >= SCORE_THRESHOLD]
    relevance = sum(sorted(above, reverse=True)[:PROMPT_TOP_K * 2])

    return {
        "lang":       lang,
        "vachnamrut": vach,
        "swamini_vato": vato,
        "relevance":  relevance,
        "match_count": len(above),
    }


def retrieve_best(query: str) -> dict:
    """
    Translate the query into all 3 languages, query all 3 collections IN PARALLEL,
    return the results from the collection with the highest relevance score.
    """
    # Step 1: translate query to all 3 languages in parallel
    def _translate_for(lang: str) -> tuple[str, str]:
        code = LANG_GT_CODE[lang]
        if not code:
            return lang, query
        try:
            t = GoogleTranslator(source="auto", target=code).translate(query)
            return lang, t or query
        except Exception:
            return lang, query

    translated_queries: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        for lang, tq in ex.map(_translate_for, LANG_COLLECTIONS.keys()):
            translated_queries[lang] = tq

    # Step 2: embed each translated query and query its collection — all in parallel
    def _query_lang(lang: str) -> dict:
        emb = embed_model.encode([translated_queries[lang]])[0].tolist()
        return _query_one_collection(lang, emb)

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        results = list(ex.map(_query_lang, LANG_COLLECTIONS.keys()))

    # Step 3: pick the collection with the highest relevance score
    best = max(results, key=lambda r: r["relevance"])

    print(f"  [retrieval] scores: { {r['lang']: round(r['relevance'],3) for r in results} }"
          f" → winner: {best['lang']} ({best['match_count']} matches above threshold)")

    return best


def build_sources(result: dict) -> tuple[list, list]:
    """Extract + filter sources from the winning collection result."""
    vachnamrut_sources = []
    for doc, meta, dist in zip(
        result["vachnamrut"]["documents"][0],
        result["vachnamrut"]["metadatas"][0],
        result["vachnamrut"]["distances"][0],
    ):
        score = round(1 - dist, 3)
        if score >= SCORE_THRESHOLD:
            vachnamrut_sources.append({
                "book":      "Vachnamrut",
                "loc":       meta.get("loc", ""),
                "vachno":    str(meta.get("vachno", "")),
                "reference": f"{meta.get('loc','')}-{meta.get('vachno','')}",
                "title":     meta.get("title", ""),
                "place":     meta.get("place", ""),
                "text":      doc,
                "score":     score,
            })

    swamini_vato_sources = []
    for doc, meta, dist in zip(
        result["swamini_vato"]["documents"][0],
        result["swamini_vato"]["metadatas"][0],
        result["swamini_vato"]["distances"][0],
    ):
        score = round(1 - dist, 3)
        if score >= SCORE_THRESHOLD:
            swamini_vato_sources.append({
                "book":     "Swamini Vato",
                "prakaran": meta.get("prakaran", ""),
                "verse_no": meta.get("verse_no", ""),
                "reference": f"Prakaran {meta.get('prakaran','')}, Verse {meta.get('verse_no','')}",
                "text":     doc,
                "score":    score,
            })

    vachnamrut_sources   = sorted(vachnamrut_sources,   key=lambda x: x["score"], reverse=True)[:MAX_SOURCES_PER_BOOK]
    swamini_vato_sources = sorted(swamini_vato_sources, key=lambda x: x["score"], reverse=True)[:MAX_SOURCES_PER_BOOK]
    return vachnamrut_sources, swamini_vato_sources


def build_prompt(query: str, result: dict, history: str = "") -> str:
    context_parts = []

    for doc, meta in zip(
        result["vachnamrut"]["documents"][0][:PROMPT_TOP_K],
        result["vachnamrut"]["metadatas"][0][:PROMPT_TOP_K],
    ):
        ref = f"Vachnamrut {meta.get('loc','')}-{meta.get('vachno','')} — {meta.get('title','')}"
        context_parts.append(f"[{ref}]\n{doc[:600]}")

    for doc, meta in zip(
        result["swamini_vato"]["documents"][0][:PROMPT_TOP_K],
        result["swamini_vato"]["metadatas"][0][:PROMPT_TOP_K],
    ):
        ref = f"Swamini Vato Prakaran {meta.get('prakaran','')}, Verse {meta.get('verse_no','')}"
        context_parts.append(f"[{ref}]\n{doc[:600]}")

    context = "\n\n---\n\n".join(context_parts)
    history_block = f"\nCONVERSATION SO FAR:\n{history}\n" if history else ""

    return f"""You are a knowledgeable and respectful guide on Swaminarayan philosophy, trained on the sacred texts of Vachnamrut and Swamini Vato.

Answer the user's question using ONLY the passages provided below.
- Cite your sources clearly (e.g., "As stated in Vachnamrut GI-1..." or "Swamini Vato Prakaran 1, Verse 5 says...")
- Provide a clear, thoughtful, and respectful explanation
- If the passages don't fully answer the question, say so honestly
- Use the conversation summary for context but base your answer on the passages
{history_block}
RELEVANT PASSAGES:
{context}

USER QUESTION: {query}

ANSWER:"""


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/summarize")
async def summarize(request: SummarizeRequest):
    if not request.messages:
        return {"summary": ""}

    convo = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in request.messages
    )
    prompt = (
        "Summarize the following conversation in 2-3 sentences. "
        "Capture what the user asked and the key points answered. "
        "Keep any scripture references like 'Vachnamrut GI-1' or 'Swamini Vato Prakaran 1, Verse 5' exactly as-is. "
        "Output only the summary, nothing else.\n\n"
        f"{convo}"
    )
    try:
        resp = llm_client.chat.completions.create(
            model=ANSWER_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=200,
            extra_body={"options": {"repeat_penalty": 1.3}},
        )
        return {"summary": resp.choices[0].message.content.strip()}
    except Exception:
        return {"summary": ""}


@app.post("/chat")
async def chat(request: ChatRequest):
    lang = request.language.lower()
    if lang not in LANG_COLLECTIONS:
        lang = "english"

    # 1. Query all 3 collections in parallel, pick the best
    best = retrieve_best(request.query)
    best_lang = best["lang"]

    # 2. Build prompt (always in English — LLM is stable in English)
    prompt = build_prompt(request.query, best, request.history)

    # 3. Build sources from winning collection
    vachnamrut_sources, swamini_vato_sources = build_sources(best)
    sources = sorted(vachnamrut_sources + swamini_vato_sources,
                     key=lambda x: x["score"], reverse=True)

    # 4. Generate English answer
    last_error = ""
    answer = None
    try:
        resp = llm_client.chat.completions.create(
            model=ANSWER_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1024,
            extra_body={"options": {"repeat_penalty": 1.3}},
        )
        answer = resp.choices[0].message.content
    except Exception as e:
        last_error = str(e)

    if answer is None:
        raise HTTPException(status_code=429,
                            detail=f"LLM unavailable. Please retry. ({last_error[:100]})")

    # 5. Translate answer to user's language if needed (chunked + parallel)
    target_code = LANG_GT_CODE.get(lang)
    if target_code:
        answer = translate_to(answer, target_code)

    return {
        "answer":               answer,
        "language":             lang,
        "best_collection":      best_lang,       # which collection won
        "sources":              sources,
        "vachnamrut_matches":   vachnamrut_sources,
        "swamini_vato_matches": swamini_vato_sources,
        "total_matches": {
            "vachnamrut":   len(vachnamrut_sources),
            "swamini_vato": len(swamini_vato_sources),
            "total":        len(sources),
        },
    }


@app.get("/source/vachnamrut/{loc}/{vachno}")
def get_vachnamrut(loc: str, vachno: str, lang: str = "english"):
    if lang not in VACHNAMRUT_INDEX:
        lang = "english"
    entry = VACHNAMRUT_INDEX[lang].get((loc, vachno))
    if not entry:
        raise HTTPException(status_code=404, detail="Vachnamrut not found")
    return entry


@app.get("/source/swamini_vato/{prakaran}/{verse_no}")
def get_swamini_vato(prakaran: str, verse_no: str, lang: str = "english"):
    if lang not in SWAMINI_VATO_INDEX:
        lang = "english"
    entry = SWAMINI_VATO_INDEX[lang].get((prakaran, verse_no))
    if not entry:
        raise HTTPException(status_code=404, detail="Swamini Vato verse not found")
    return entry


@app.get("/health")
def health():
    return {
        "status": "ok",
        "collections": {lang: col.count() for lang, col in collections.items()},
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
