"""
Step 2: Embed documents and store in ChromaDB.
Uses sentence-transformers locally — no API, no limits.
Model: BAAI/bge-small-en-v1.5 (fast, good for RAG)
"""

import json
import os
import chromadb
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

VACH_FILE  = "../data/vachnamrut/vachnamrut_clean.json"
VATO_FILE  = "../data/swamini_vato/swamini_vato_clean.json"
CHROMA_DIR = "../data/chromadb"

EMBED_MODEL = "BAAI/bge-small-en-v1.5"
BATCH_SIZE  = 64  # local model — no rate limits, large batches fine


def ingest_collection(collection, data, make_id, make_meta, label, model):
    existing = set(collection.get(include=[])["ids"])
    data = [d for d in data if make_id(d) not in existing]

    if not data:
        print(f"{label}: already fully ingested.")
        return

    total_batches = (len(data) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"{label}: ingesting {len(data)} docs in {total_batches} batches...")

    for i in tqdm(range(0, len(data), BATCH_SIZE), desc=f"  {label}"):
        batch = data[i:i + BATCH_SIZE]
        texts = [d["text"][:2000] for d in batch]
        ids   = [make_id(d) for d in batch]
        metas = [make_meta(d) for d in batch]

        embeddings = model.encode(texts, show_progress_bar=False).tolist()

        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metas,
        )


def main():
    print("Loading embedding model (downloads once, then cached)...")
    model = SentenceTransformer(EMBED_MODEL)
    print(f"Model loaded: {EMBED_MODEL}\n")

    os.makedirs(CHROMA_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = client.get_or_create_collection(
        name="swaminarayan_rag",
        metadata={"hnsw:space": "cosine"},
    )

    print(f"ChromaDB current size: {collection.count()} docs\n")

    # Vachnamrut
    with open(VACH_FILE, "r", encoding="utf-8") as f:
        vach_data = json.load(f)

    ingest_collection(
        collection, vach_data,
        make_id   = lambda d: f"vach_{d['vachno']}",
        make_meta = lambda d: {
            "book":   "Vachnamrut",
            "vachno": d["vachno"],
            "place":  d.get("place", ""),
            "loc":    d.get("loc", ""),
            "title":  d.get("title", ""),
        },
        label="Vachnamrut",
        model=model,
    )

    print()

    # Swamini Vato
    with open(VATO_FILE, "r", encoding="utf-8") as f:
        vato_data = json.load(f)

    ingest_collection(
        collection, vato_data,
        make_id   = lambda d: f"vato_{d['prakaran']}_{d['verse_no']}",
        make_meta = lambda d: {
            "book":     "Swamini Vato",
            "prakaran": d["prakaran"],
            "verse_no": d["verse_no"],
        },
        label="Swamini Vato",
        model=model,
    )

    print(f"\nTotal docs in ChromaDB: {collection.count()}")
    print("Ingestion complete!")


if __name__ == "__main__":
    main()
