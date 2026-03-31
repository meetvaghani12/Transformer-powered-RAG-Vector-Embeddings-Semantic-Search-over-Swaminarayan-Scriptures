"""
Multilingual ingestion pipeline for AksharAI RAG.

Embeds Vachnamrut (272 discourses) and Swamini Vato (1,484 verses) into ChromaDB
across 3 language collections (en, gu, hi) using the SAME embedding model that
main.py uses for querying: paraphrase-multilingual-MiniLM-L12-v2 (384-dim).

KEY: Documents are split into overlapping chunks (~500 chars) so the embedding
model can represent each section accurately (max token length ~128 tokens).

Usage:
    python ingest.py                   # full ingestion (skips already-indexed docs)
    python ingest.py --validate        # validate JSON files without ingesting
    python ingest.py --rebuild         # delete all collections and re-ingest from scratch
    python ingest.py --lang english    # ingest only one language
"""

import argparse
import json
import logging
import os
import sys
import chromadb
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# ── Config (aligned with main.py) ────────────────────────────────────────────
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
CHROMA_DIR  = "../data/chromadb"
DATA_DIR    = "../data"
BATCH_SIZE  = 64

# Chunking config
CHUNK_SIZE    = 500   # chars per chunk (model max ~128 tokens ≈ 512 chars)
CHUNK_OVERLAP = 100   # overlap between consecutive chunks
MIN_CHUNK_LEN = 50    # discard chunks shorter than this

LANGUAGES = {
    "english": {
        "collection": "swaminarayan_rag_en",
        "vachnamrut": "vachnamrut_clean.json",
        "swamini_vato": "swamini_vato_clean.json",
    },
    "gujarati": {
        "collection": "swaminarayan_rag_gu",
        "vachnamrut": "vachnamrut_gu.json",
        "swamini_vato": "swamini_vato_gu.json",
    },
    "hindi": {
        "collection": "swaminarayan_rag_hi",
        "vachnamrut": "vachnamrut_hi.json",
        "swamini_vato": "swamini_vato_hi.json",
    },
}

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ingest")


# ── Chunking ─────────────────────────────────────────────────────────────────
def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Split text into overlapping chunks at paragraph/sentence boundaries.
    Returns list of chunk strings, each ≤ chunk_size chars.
    """
    text = text.strip()
    if len(text) <= chunk_size:
        return [text] if len(text) >= MIN_CHUNK_LEN else []

    # Split on paragraph breaks first, then sentences
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # If adding this paragraph fits, accumulate
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}" if current else para
            continue

        # Current chunk is full — save it
        if current and len(current) >= MIN_CHUNK_LEN:
            chunks.append(current.strip())

        # If paragraph itself exceeds chunk_size, split on sentences
        if len(para) > chunk_size:
            sentences = para.replace(". ", ".\n").split("\n")
            current = ""
            for sent in sentences:
                sent = sent.strip()
                if not sent:
                    continue
                if len(current) + len(sent) + 1 <= chunk_size:
                    current = f"{current} {sent}" if current else sent
                else:
                    if current and len(current) >= MIN_CHUNK_LEN:
                        chunks.append(current.strip())
                    # Start new chunk with overlap from end of previous
                    if chunks and overlap > 0:
                        prev = chunks[-1]
                        overlap_text = prev[-overlap:].rsplit(" ", 1)[-1] if len(prev) > overlap else ""
                        current = f"{overlap_text} {sent}".strip() if overlap_text else sent
                    else:
                        current = sent
        else:
            # Start new chunk with overlap from end of previous
            if chunks and overlap > 0:
                prev = chunks[-1]
                overlap_text = prev[-overlap:].rsplit(" ", 1)[-1] if len(prev) > overlap else ""
                current = f"{overlap_text}\n\n{para}".strip() if overlap_text else para
            else:
                current = para

    # Don't forget the last chunk
    if current and len(current) >= MIN_CHUNK_LEN:
        chunks.append(current.strip())

    return chunks


# ── Validation ────────────────────────────────────────────────────────────────
def validate_vachnamrut(data: list[dict], filepath: str) -> list[str]:
    errors = []
    required_keys = {"vachno", "text"}
    for i, doc in enumerate(data):
        missing = required_keys - set(doc.keys())
        if missing:
            errors.append(f"{filepath}[{i}]: missing keys {missing}")
        if "text" in doc and not doc["text"].strip():
            errors.append(f"{filepath}[{i}]: empty text (vachno={doc.get('vachno', '?')})")
    return errors


def validate_swamini_vato(data: list[dict], filepath: str) -> list[str]:
    errors = []
    required_keys = {"prakaran", "verse_no", "text"}
    for i, doc in enumerate(data):
        missing = required_keys - set(doc.keys())
        if missing:
            errors.append(f"{filepath}[{i}]: missing keys {missing}")
        if "text" in doc and not doc["text"].strip():
            errors.append(f"{filepath}[{i}]: empty text (prakaran={doc.get('prakaran', '?')}, verse={doc.get('verse_no', '?')})")
    return errors


def load_json(filepath: str) -> list[dict]:
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Ingestion ─────────────────────────────────────────────────────────────────
def ingest_chunked(collection, data: list[dict], make_base_id, make_meta, label: str, model):
    """
    Chunk each document, embed each chunk, store in ChromaDB.
    IDs: {base_id}_c{chunk_index} (e.g., vach_1_c0, vach_1_c1, ...)
    Metadata includes chunk_index and total_chunks for reconstruction.
    """
    existing = set(collection.get(include=[])["ids"])

    all_chunks = []  # (id, text, metadata)
    for doc in data:
        base_id = make_base_id(doc)
        chunks = chunk_text(doc["text"])
        if not chunks:
            chunks = [doc["text"][:CHUNK_SIZE]]  # fallback: at least one chunk

        for ci, chunk_text_str in enumerate(chunks):
            chunk_id = f"{base_id}_c{ci}"
            if chunk_id in existing:
                continue
            meta = make_meta(doc)
            meta["chunk_index"] = ci
            meta["total_chunks"] = len(chunks)
            all_chunks.append((chunk_id, chunk_text_str, meta))

    if not all_chunks:
        log.info(f"{label}: all chunks already ingested, skipping.")
        return 0

    total = len(all_chunks)
    total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    log.info(f"{label}: ingesting {total} chunks in {total_batches} batches...")
    failed_count = 0

    for i in tqdm(range(0, total, BATCH_SIZE), desc=f"  {label}"):
        batch = all_chunks[i:i + BATCH_SIZE]
        ids = [b[0] for b in batch]
        texts = [b[1] for b in batch]
        metas = [b[2] for b in batch]

        try:
            embeddings = model.encode(texts, show_progress_bar=False).tolist()
            collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metas,
            )
        except Exception as e:
            failed_count += len(batch)
            log.error(f"{label}: batch {i//BATCH_SIZE + 1} failed ({len(batch)} chunks): {e}")
            continue

    if failed_count:
        log.error(f"{label}: {failed_count} chunks failed to ingest")

    return total - failed_count


def run_validate(langs: list[str]):
    all_errors = []
    for lang in langs:
        cfg = LANGUAGES[lang]
        vach_path = f"{DATA_DIR}/vachnamrut/{cfg['vachnamrut']}"
        vato_path = f"{DATA_DIR}/swamini_vato/{cfg['swamini_vato']}"

        log.info(f"[{lang}] Validating {vach_path}...")
        try:
            vach = load_json(vach_path)
            all_errors.extend(validate_vachnamrut(vach, vach_path))
            log.info(f"  {len(vach)} Vachnamrut entries loaded")
        except FileNotFoundError:
            all_errors.append(f"MISSING: {vach_path}")
        except json.JSONDecodeError as e:
            all_errors.append(f"INVALID JSON: {vach_path}: {e}")

        log.info(f"[{lang}] Validating {vato_path}...")
        try:
            vato = load_json(vato_path)
            all_errors.extend(validate_swamini_vato(vato, vato_path))
            log.info(f"  {len(vato)} Swamini Vato entries loaded")
        except FileNotFoundError:
            all_errors.append(f"MISSING: {vato_path}")
        except json.JSONDecodeError as e:
            all_errors.append(f"INVALID JSON: {vato_path}: {e}")

    if all_errors:
        log.error(f"\n{'='*60}\nValidation found {len(all_errors)} error(s):\n")
        for err in all_errors:
            log.error(f"  - {err}")
        return False
    else:
        log.info(f"\nAll files valid across {len(langs)} language(s).")
        return True


def run_ingest(langs: list[str], rebuild: bool = False):
    log.info(f"Loading embedding model: {EMBED_MODEL}...")
    model = SentenceTransformer(EMBED_MODEL)
    log.info(f"Model loaded (dim={model.get_sentence_embedding_dimension()})")
    log.info(f"Chunk config: size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP}, min={MIN_CHUNK_LEN}\n")

    os.makedirs(CHROMA_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=CHROMA_DIR)

    total_ingested = 0

    for lang in langs:
        cfg = LANGUAGES[lang]
        col_name = cfg["collection"]

        if rebuild:
            try:
                client.delete_collection(col_name)
                log.info(f"[{lang}] Deleted existing collection: {col_name}")
            except ValueError:
                pass

        collection = client.get_or_create_collection(
            name=col_name,
            metadata={"hnsw:space": "cosine"},
        )
        log.info(f"[{lang}] Collection '{col_name}': {collection.count()} existing docs")

        # Vachnamrut
        vach_path = f"{DATA_DIR}/vachnamrut/{cfg['vachnamrut']}"
        vach_data = load_json(vach_path)
        n = ingest_chunked(
            collection, vach_data,
            make_base_id=lambda d: f"vach_{d['vachno']}",
            make_meta=lambda d: {
                "book":   "Vachnamrut",
                "vachno": d["vachno"],
                "place":  d.get("place", ""),
                "loc":    d.get("loc", ""),
                "title":  d.get("title", ""),
            },
            label=f"[{lang}] Vachnamrut",
            model=model,
        )
        total_ingested += n

        # Swamini Vato
        vato_path = f"{DATA_DIR}/swamini_vato/{cfg['swamini_vato']}"
        vato_data = load_json(vato_path)
        n = ingest_chunked(
            collection, vato_data,
            make_base_id=lambda d: f"vato_{d['prakaran']}_{d['verse_no']}",
            make_meta=lambda d: {
                "book":     "Swamini Vato",
                "prakaran": d["prakaran"],
                "verse_no": d["verse_no"],
            },
            label=f"[{lang}] Swamini Vato",
            model=model,
        )
        total_ingested += n

        log.info(f"[{lang}] Collection '{col_name}' now has {collection.count()} chunks\n")

    log.info("=" * 60)
    log.info("INGESTION COMPLETE")
    log.info(f"  Languages:    {', '.join(langs)}")
    log.info(f"  New chunks:   {total_ingested}")
    for lang in langs:
        col = client.get_collection(LANGUAGES[lang]["collection"])
        log.info(f"  [{lang}] {col.name}: {col.count()} total chunks")
    log.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="AksharAI multilingual ingestion pipeline")
    parser.add_argument("--validate", action="store_true", help="Validate JSON files without ingesting")
    parser.add_argument("--rebuild", action="store_true", help="Delete existing collections and re-ingest from scratch")
    parser.add_argument("--lang", choices=list(LANGUAGES.keys()), help="Ingest only one language (default: all)")
    args = parser.parse_args()

    langs = [args.lang] if args.lang else list(LANGUAGES.keys())

    if args.validate:
        ok = run_validate(langs)
        sys.exit(0 if ok else 1)

    log.info("Running validation first...\n")
    if not run_validate(langs):
        log.error("Fix validation errors before ingesting.")
        sys.exit(1)

    print()
    run_ingest(langs, rebuild=args.rebuild)


if __name__ == "__main__":
    main()
