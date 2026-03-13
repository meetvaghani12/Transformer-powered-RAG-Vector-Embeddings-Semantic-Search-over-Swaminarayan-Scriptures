"""
FastAPI RAG backend.
- Embeds user query with local sentence-transformers model
- Retrieves top-k docs from ChromaDB
- Generates answer with OpenRouter (free models)
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

load_dotenv("../.env")

# Ollama local client — uses OpenAI-compatible API
llm_client = OpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1",
)

CHROMA_DIR    = "../data/chromadb"
EMBED_MODEL   = "BAAI/bge-small-en-v1.5"
SCORE_THRESHOLD = 0.65  # only return docs with score above this
MAX_QUERY_K   = 50      # fetch up to this many per book before filtering

FREE_MODELS = [
    "qwen2.5:3b",
]

app = FastAPI(title="Swaminarayan RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models once at startup
print("Loading embedding model...")
embed_model = SentenceTransformer(EMBED_MODEL)
print("Connecting to ChromaDB...")
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
collection = chroma_client.get_collection("swaminarayan_rag")
print(f"Ready! {collection.count()} docs in ChromaDB.")

# Load full text data for source lookup
import json as _json
DATA_DIR = "../data"
with open(f"{DATA_DIR}/vachnamrut/vachnamrut_clean.json") as f:
    _vachnamrut_data = _json.load(f)
with open(f"{DATA_DIR}/swamini_vato/swamini_vato_clean.json") as f:
    _swamini_vato_data = _json.load(f)

# Build lookup indexes
VACHNAMRUT_INDEX = {(v["loc"], str(v["vachno"])): v for v in _vachnamrut_data}
SWAMINI_VATO_INDEX = {(str(v["prakaran"]), str(v["verse_no"])): v for v in _swamini_vato_data}
print(f"Loaded {len(VACHNAMRUT_INDEX)} Vachnamrut + {len(SWAMINI_VATO_INDEX)} Swamini Vato entries.")


SUPPORTED_LANGUAGES = {
    "english":  None,
    "gujarati": "Gujarati",
    "hindi":    "Hindi",
}


class ChatRequest(BaseModel):
    query: str
    language: str = "english"  # english | gujarati | hindi


def retrieve_documents(query: str) -> dict:
    query_embedding = embed_model.encode([query])[0].tolist()

    vach_results = collection.query(
        query_embeddings=[query_embedding],
        n_results=MAX_QUERY_K,
        where={"book": "Vachnamrut"},
    )

    vato_results = collection.query(
        query_embeddings=[query_embedding],
        n_results=MAX_QUERY_K,
        where={"book": "Swamini Vato"},
    )

    return {
        "vachnamrut":   vach_results,
        "swamini_vato": vato_results,
    }


def build_prompt(query: str, retrieved: dict) -> str:
    context_parts = []

    for doc, meta in zip(
        retrieved["vachnamrut"]["documents"][0],
        retrieved["vachnamrut"]["metadatas"][0],
    ):
        ref = f"Vachnamrut {meta.get('loc','')}-{meta.get('vachno','')} — {meta.get('title','')}"
        context_parts.append(f"[{ref}]\n{doc[:600]}")

    for doc, meta in zip(
        retrieved["swamini_vato"]["documents"][0],
        retrieved["swamini_vato"]["metadatas"][0],
    ):
        ref = f"Swamini Vato Prakaran {meta.get('prakaran','')}, Verse {meta.get('verse_no','')}"
        context_parts.append(f"[{ref}]\n{doc[:600]}")

    context = "\n\n---\n\n".join(context_parts)

    return f"""You are a knowledgeable and respectful guide on Swaminarayan philosophy, trained on the sacred texts of Vachnamrut and Swamini Vato.

Answer the user's question using ONLY the passages provided below.
- Cite your sources clearly (e.g., "As stated in Vachnamrut GI-1..." or "Swamini Vato Prakaran 1, Verse 5 says...")
- Provide a clear, thoughtful, and respectful explanation
- If the passages don't fully answer the question, say so honestly

RELEVANT PASSAGES:
{context}

USER QUESTION: {query}

ANSWER:"""


@app.post("/chat")
async def chat(request: ChatRequest):
    retrieved = retrieve_documents(request.query)
    prompt    = build_prompt(request.query, retrieved)

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

    # Sort each by relevance
    vachnamrut_sources   = sorted(vachnamrut_sources,   key=lambda x: x["score"], reverse=True)
    swamini_vato_sources = sorted(swamini_vato_sources, key=lambda x: x["score"], reverse=True)
    sources = sorted(vachnamrut_sources + swamini_vato_sources, key=lambda x: x["score"], reverse=True)

    lang = request.language.lower()
    target_lang = SUPPORTED_LANGUAGES.get(lang)

    # Step 1: always generate answer in English (small models are stable in English)
    answer = None
    last_error = ""
    for model in FREE_MODELS:
        try:
            response = llm_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1024,
                extra_body={"options": {"repeat_penalty": 1.3}},
            )
            answer = response.choices[0].message.content
            break
        except Exception as e:
            last_error = str(e)
            continue

    if answer is None:
        raise HTTPException(status_code=429, detail=f"All LLM models are rate-limited. Please retry in a minute. ({last_error[:100]})")

    # Step 2: translate if a non-English language was requested
    if target_lang:
        translate_prompt = (
            f"Translate the following text into {target_lang}. "
            f"Keep scripture references like 'Vachnamrut GI-1' or 'Swamini Vato Prakaran 1, Verse 5' in English as-is. "
            f"Output only the translated text, nothing else.\n\n{answer}"
        )
        for model in FREE_MODELS:
            try:
                trans_response = llm_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": translate_prompt}],
                    temperature=0.1,
                    max_tokens=1024,
                    extra_body={"options": {"repeat_penalty": 1.3}},
                )
                answer = trans_response.choices[0].message.content
                break
            except Exception as e:
                last_error = str(e)
                continue

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
def get_vachnamrut(loc: str, vachno: str):
    entry = VACHNAMRUT_INDEX.get((loc, vachno))
    if not entry:
        raise HTTPException(status_code=404, detail="Vachnamrut not found")
    return entry


@app.get("/source/swamini_vato/{prakaran}/{verse_no}")
def get_swamini_vato(prakaran: str, verse_no: str):
    entry = SWAMINI_VATO_INDEX.get((prakaran, verse_no))
    if not entry:
        raise HTTPException(status_code=404, detail="Swamini Vato verse not found")
    return entry


@app.get("/health")
def health():
    return {
        "status":    "ok",
        "documents": collection.count(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
