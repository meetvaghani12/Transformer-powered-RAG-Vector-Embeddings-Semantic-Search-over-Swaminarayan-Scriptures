#!/bin/bash
set -e

echo "╔══════════════════════════════════════════╗"
echo "║       AksharAI — Setup Script            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Check prerequisites ──────────────────────────────────────────────────────
for cmd in python3 node npm ollama; do
  if ! command -v $cmd &>/dev/null; then
    echo "ERROR: $cmd is not installed."
    exit 1
  fi
done
echo "✓ Prerequisites: python3, node, npm, ollama"

# ── Ollama ────────────────────────────────────────────────────────────────────
echo ""
echo "── Ollama ──"
if ! pgrep -x ollama &>/dev/null; then
  echo "Starting Ollama..."
  ollama serve &>/dev/null &
  sleep 3
fi

if ! ollama list 2>/dev/null | grep -q "llama3"; then
  echo "Pulling llama3 model (4.7GB, one-time download)..."
  ollama pull llama3:latest
fi
echo "✓ Ollama ready with llama3"

# ── Backend ───────────────────────────────────────────────────────────────────
echo ""
echo "── Backend ──"
cd backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "  Created Python venv"
fi
source venv/bin/activate
pip install -q -r requirements.txt
echo "✓ Backend dependencies installed"

# ── Ingest data (if needed) ───────────────────────────────────────────────────
python3 -c "
import chromadb
c = chromadb.PersistentClient(path='../data/chromadb')
cols = [col for col in c.list_collections()]
if any(col.count() > 0 for col in cols):
    print('✓ ChromaDB already has data — skipping ingestion')
else:
    print('  ChromaDB is empty — running ingestion...')
    exit(1)
" 2>/dev/null || {
  echo "  Running ingestion (embeds all 3 languages, ~2 min)..."
  python3 ingest.py
}

cd ..

# ── Frontend ──────────────────────────────────────────────────────────────────
echo ""
echo "── Frontend ──"
cd frontend
npm install --silent 2>/dev/null
npx prisma generate 2>/dev/null
echo "✓ Frontend dependencies installed"
cd ..

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║             Setup Complete!              ║"
echo "╠══════════════════════════════════════════╣"
echo "║  To start:                               ║"
echo "║                                          ║"
echo "║  Terminal 1: cd backend && source         ║"
echo "║    venv/bin/activate && uvicorn            ║"
echo "║    main:app --port 8000                    ║"
echo "║                                          ║"
echo "║  Terminal 2: cd frontend && npm run dev    ║"
echo "║                                          ║"
echo "║  Or with Docker:                          ║"
echo "║    docker compose up                       ║"
echo "║                                          ║"
echo "║  Open: http://localhost:3000               ║"
echo "╚══════════════════════════════════════════╝"
