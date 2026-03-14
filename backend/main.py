"""
FastAPI RAG backend — multilingual edition.
- Embeds user query with paraphrase-multilingual-MiniLM-L12-v2 (384-dim, 50+ langs)
- Retrieves docs from language-specific ChromaDB collection (en / gu / hi)
- Generates answer with local Ollama (qwen2.5:3b)
"""

import os
import chromadb
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from deep_translator import GoogleTranslator

load_dotenv("../.env")

# Ollama local client — uses OpenAI-compatible API
llm_client = OpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1",
)

CHROMA_DIR      = "../data/chromadb"
EMBED_MODEL     = "paraphrase-multilingual-MiniLM-L12-v2"
SCORE_THRESHOLD   = 0.45  # minimum score to include in sources (filters noise)
MAX_SOURCES_PER_BOOK = 15 # cap sources per book shown to user
PROMPT_TOP_K      = 8    # docs per book sent to LLM prompt
MAX_QUERY_K       = 50   # total docs fetched from ChromaDB per book

ANSWER_MODEL = "qwen2.5:3b"

# Language → ChromaDB collection name
LANG_COLLECTIONS = {
    "english":  "swaminarayan_rag_en",
    "gujarati": "swaminarayan_rag_gu",
    "hindi":    "swaminarayan_rag_hi",
}

# Language → Google Translate target code (None = keep as English)
LANG_TRANSLATE_CODE = {
    "english":  None,
    "gujarati": "gu",
    "hindi":    "hi",
}


def translate_query(query: str, lang: str) -> str:
    """Translate query into the collection language for better semantic match."""
    target = LANG_TRANSLATE_CODE.get(lang)
    if not target:
        return query
    try:
        return GoogleTranslator(source="auto", target=target).translate(query) or query
    except Exception:
        return query  # fallback to original on any error

app = FastAPI(title="Swaminarayan RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models once at startup
print("Loading multilingual embedding model...")
embed_model = SentenceTransformer(EMBED_MODEL)
print("Connecting to ChromaDB...")
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)

# Load all 3 language collections
collections = {
    lang: chroma_client.get_collection(col_name)
    for lang, col_name in LANG_COLLECTIONS.items()
}
for lang, col in collections.items():
    print(f"  [{lang}] {col.name}: {col.count()} docs")
print("ChromaDB ready.")

# Load full text data for source lookup — all 3 languages
import json as _json
DATA_DIR = "../data"

_SOURCE_FILES = {
    "english":  ("vachnamrut_clean.json", "swamini_vato_clean.json"),
    "gujarati": ("vachnamrut_gu.json",    "swamini_vato_gu.json"),
    "hindi":    ("vachnamrut_hi.json",    "swamini_vato_hi.json"),
}

VACHNAMRUT_INDEX:   dict[str, dict] = {}   # lang → {(loc, vachno): entry}
SWAMINI_VATO_INDEX: dict[str, dict] = {}   # lang → {(prakaran, verse_no): entry}

for _lang, (_vf, _sf) in _SOURCE_FILES.items():
    with open(f"{DATA_DIR}/vachnamrut/{_vf}", encoding="utf-8") as f:
        _vd = _json.load(f)
    with open(f"{DATA_DIR}/swamini_vato/{_sf}", encoding="utf-8") as f:
        _sd = _json.load(f)
    VACHNAMRUT_INDEX[_lang]   = {(v["loc"], str(v["vachno"])): v for v in _vd}
    SWAMINI_VATO_INDEX[_lang] = {(str(v["prakaran"]), str(v["verse_no"])): v for v in _sd}
    print(f"  [{_lang}] {len(VACHNAMRUT_INDEX[_lang])} Vachnamrut + {len(SWAMINI_VATO_INDEX[_lang])} Swamini Vato entries")

print("Source indexes ready.")


class ChatRequest(BaseModel):
    query: str
    language: str = "english"  # english | gujarati | hindi
    history: str = ""           # rolling summary of previous messages


class SummarizeRequest(BaseModel):
    messages: list[dict]  # [{"role": "user"|"assistant", "content": "..."}]


def retrieve_documents(query: str, lang: str) -> dict:
    col = collections[lang]
    translated_query = translate_query(query, lang)
    query_embedding = embed_model.encode([translated_query])[0].tolist()

    vach_results = col.query(
        query_embeddings=[query_embedding],
        n_results=MAX_QUERY_K,
        where={"book": "Vachnamrut"},
    )

    vato_results = col.query(
        query_embeddings=[query_embedding],
        n_results=MAX_QUERY_K,
        where={"book": "Swamini Vato"},
    )

    return {
        "vachnamrut":   vach_results,
        "swamini_vato": vato_results,
    }


def build_prompt(query: str, retrieved: dict, history: str = "") -> str:
    context_parts = []

    for doc, meta in zip(
        retrieved["vachnamrut"]["documents"][0][:PROMPT_TOP_K],
        retrieved["vachnamrut"]["metadatas"][0][:PROMPT_TOP_K],
    ):
        ref = f"Vachnamrut {meta.get('loc','')}-{meta.get('vachno','')} — {meta.get('title','')}"
        context_parts.append(f"[{ref}]\n{doc[:600]}")

    for doc, meta in zip(
        retrieved["swamini_vato"]["documents"][0][:PROMPT_TOP_K],
        retrieved["swamini_vato"]["metadatas"][0][:PROMPT_TOP_K],
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


@app.post("/summarize")
async def summarize(request: SummarizeRequest):
    if not request.messages:
        return {"summary": ""}

    convo = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in request.messages
    )

    summarize_prompt = (
        "Summarize the following conversation in 2-3 sentences. "
        "Capture what the user asked and the key points answered. "
        "Keep any scripture references like 'Vachnamrut GI-1' or 'Swamini Vato Prakaran 1, Verse 5' exactly as-is. "
        "Output only the summary, nothing else.\n\n"
        f"{convo}"
    )

    try:
        response = llm_client.chat.completions.create(
            model=ANSWER_MODEL,
            messages=[{"role": "user", "content": summarize_prompt}],
            temperature=0.1,
            max_tokens=200,
            extra_body={"options": {"repeat_penalty": 1.3}},
        )
        summary = response.choices[0].message.content.strip()
    except Exception as e:
        summary = ""

    return {"summary": summary}


@app.post("/chat")
async def chat(request: ChatRequest):
    lang = request.language.lower()
    if lang not in LANG_COLLECTIONS:
        lang = "english"

    retrieved = retrieve_documents(request.query, lang)
    prompt    = build_prompt(request.query, retrieved, request.history)

    # Build sources separated by book, filtered by score threshold
    vachnamrut_sources = []
    for doc, meta, dist in zip(
        retrieved["vachnamrut"]["documents"][0],
        retrieved["vachnamrut"]["metadatas"][0],
        retrieved["vachnamrut"]["distances"][0],
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
        retrieved["swamini_vato"]["documents"][0],
        retrieved["swamini_vato"]["metadatas"][0],
        retrieved["swamini_vato"]["distances"][0],
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

    # Sort by relevance and cap per book
    vachnamrut_sources   = sorted(vachnamrut_sources,   key=lambda x: x["score"], reverse=True)[:MAX_SOURCES_PER_BOOK]
    swamini_vato_sources = sorted(swamini_vato_sources, key=lambda x: x["score"], reverse=True)[:MAX_SOURCES_PER_BOOK]
    sources = sorted(vachnamrut_sources + swamini_vato_sources, key=lambda x: x["score"], reverse=True)

    # Generate answer — docs are already in the correct language, no translation needed
    answer = None
    last_error = ""
    try:
        response = llm_client.chat.completions.create(
            model=ANSWER_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1024,
            extra_body={"options": {"repeat_penalty": 1.3}},
        )
        answer = response.choices[0].message.content
    except Exception as e:
        last_error = str(e)

    if answer is None:
        raise HTTPException(status_code=429, detail=f"LLM unavailable. Please retry. ({last_error[:100]})")

    return {
        "answer":             answer,
        "language":           lang,
        "sources":            sources,           # all sources sorted by relevance
        "vachnamrut_matches": vachnamrut_sources,  # only Vachnamrut
        "swamini_vato_matches": swamini_vato_sources, # only Swamini Vato
        "total_matches": {
            "vachnamrut":  len(vachnamrut_sources),
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
