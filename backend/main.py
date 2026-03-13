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

# OpenRouter client — uses OpenAI-compatible API
llm_client = OpenAI(
    api_key=os.environ["OPENROUTER_API_KEY"],
    base_url="https://openrouter.ai/api/v1",
)

CHROMA_DIR  = "../data/chromadb"
EMBED_MODEL = "BAAI/bge-small-en-v1.5"
TOP_K       = 4   # top matches per book

# Free models in priority order — tried one by one on failure
FREE_MODELS = [
    "stepfun/step-3.5-flash:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
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
        n_results=TOP_K,
        where={"book": "Vachnamrut"},
    )

    vato_results = collection.query(
        query_embeddings=[query_embedding],
        n_results=TOP_K,
        where={"book": "Swamini Vato"},
    )

    return {
        "vachnamrut":  vach_results,
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

    # Build sources separated by book
    vachnamrut_sources = []
    for doc, meta, dist in zip(
        retrieved["vachnamrut"]["documents"][0],
        retrieved["vachnamrut"]["metadatas"][0],
        retrieved["vachnamrut"]["distances"][0],
    ):
        vachnamrut_sources.append({
            "book":      "Vachnamrut",
            "reference": f"{meta.get('loc','')}-{meta.get('vachno','')}",
            "title":     meta.get("title", ""),
            "place":     meta.get("place", ""),
            "text":      doc,
            "score":     round(1 - dist, 3),
        })

    swamini_vato_sources = []
    for doc, meta, dist in zip(
        retrieved["swamini_vato"]["documents"][0],
        retrieved["swamini_vato"]["metadatas"][0],
        retrieved["swamini_vato"]["distances"][0],
    ):
        swamini_vato_sources.append({
            "book":     "Swamini Vato",
            "prakaran": meta.get("prakaran", ""),
            "verse_no": meta.get("verse_no", ""),
            "reference": f"Prakaran {meta.get('prakaran','')}, Verse {meta.get('verse_no','')}",
            "text":     doc,
            "score":    round(1 - dist, 3),
        })

    # Sort each by relevance
    vachnamrut_sources  = sorted(vachnamrut_sources,  key=lambda x: x["score"], reverse=True)
    swamini_vato_sources = sorted(swamini_vato_sources, key=lambda x: x["score"], reverse=True)
    sources = sorted(vachnamrut_sources + swamini_vato_sources, key=lambda x: x["score"], reverse=True)

    # Build single prompt that answers + translates in one call
    lang = request.language.lower()
    target_lang = SUPPORTED_LANGUAGES.get(lang)

    if target_lang:
        prompt += f"\n\nIMPORTANT: Write your answer in {target_lang}. Keep scripture references like 'Vachnamrut GI-1' or 'Swamini Vato Prakaran 1, Verse 5' in English as-is."

    # Try each free model in order until one works
    answer = None
    last_error = ""
    for model in FREE_MODELS:
        try:
            response = llm_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2048,
            )
            answer = response.choices[0].message.content
            break
        except Exception as e:
            last_error = str(e)
            continue

    if answer is None:
        raise HTTPException(status_code=429, detail=f"All LLM models are rate-limited. Please retry in a minute. ({last_error[:100]})")

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


@app.get("/health")
def health():
    return {
        "status":    "ok",
        "documents": collection.count(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
