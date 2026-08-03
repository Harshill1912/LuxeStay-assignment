import math
import re
import httpx
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.config import settings
from app.models import KnowledgeDocument

# Lightweight stopword list so keyword overlap focuses on meaningful terms.
_STOPWORDS = {
    "the", "a", "an", "is", "are", "do", "does", "can", "i", "you", "we",
    "my", "me", "of", "to", "for", "and", "or", "in", "on", "at", "it",
    "what", "how", "when", "where", "which", "your", "with", "about", "please",
    "hotel", "room", "rooms", "have", "has", "any", "there", "this", "that",
}


def _tokenize(text: str) -> set:
    text_clean = (text or "").lower()
    text_clean = re.sub(r"\bcheckin\b", "check in check-in", text_clean)
    text_clean = re.sub(r"\bcheckout\b", "check out check-out", text_clean)
    return {
        w for w in re.findall(r"[a-z0-9]+", text_clean)
        if w not in _STOPWORDS and len(w) > 2
    }

def get_embedding(text: str) -> List[float]:
    provider = settings.LLM_PROVIDER.lower()
    
    # 1. GOOGLE GEMINI EMBEDDINGS (FREE)
    if provider in ["gemini", "auto"] and settings.GEMINI_API_KEY:
        try:
            url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
            headers = {
                "Content-Type": "application/json",
                "X-goog-api-key": settings.GEMINI_API_KEY
            }
            payload = {
                "model": "models/text-embedding-004",
                "content": {"parts": [{"text": text}]}
            }
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    vec = res.json()["embedding"]["values"]
                    # Pad / truncate to 1536 to keep DB schema uniform
                    if len(vec) < 1536:
                        vec = vec + [0.0] * (1536 - len(vec))
                    return vec[:1536]
        except Exception as e:
            print(f"Gemini embedding API call fallback: {e}")

    # 2. OPENAI EMBEDDINGS
    if provider in ["openai", "auto"] and settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.embeddings.create(
                input=text,
                model=settings.EMBEDDING_MODEL
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"OpenAI Embedding API call fallback: {e}")

    # 3. Deterministic 1536-dim vector fallback for offline / keyless execution
    vec = [0.0] * 1536
    words = text.lower().split()
    for idx, word in enumerate(words):
        pos = sum(ord(c) for c in word) % 1536
        vec[pos] += 1.0 / (idx + 1)
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]

def ingest_document(db: Session, title: str, content: str) -> KnowledgeDocument:
    embedding = get_embedding(content)
    doc = KnowledgeDocument(
        title=title,
        content=content,
        embedding=embedding
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

def _cosine_sim(v1, v2) -> float:
    if not v1 or not v2:
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1)) or 1.0
    n2 = math.sqrt(sum(b * b for b in v2)) or 1.0
    return dot / (n1 * n2)


def _keyword_score(query_tokens: set, doc: KnowledgeDocument) -> float:
    """Fraction of the query's meaningful tokens that appear in the document."""
    if not query_tokens:
        return 0.0
    doc_tokens = _tokenize(f"{doc.title} {doc.content}")
    return len(query_tokens & doc_tokens) / len(query_tokens)


def rank_relevant_docs(
    db: Session, query: str, top_k: int = 4, min_score: float = 0.15
) -> List[Tuple[KnowledgeDocument, float]]:
    """
    Hybrid retrieval: blends embedding cosine similarity with keyword overlap so
    the concierge stays accurate even when running on keyless offline fallback.
    Strictly filters out irrelevant docs when specific query tokens are present.
    """
    all_docs = db.query(KnowledgeDocument).all()
    if not all_docs:
        return []

    query_vector = get_embedding(query)
    query_tokens = _tokenize(query)

    scored = []
    for doc in all_docs:
        doc_tokens = _tokenize(f"{doc.title} {doc.content}")
        overlap = query_tokens & doc_tokens if query_tokens else set()
        
        # If user query has specific tokens (e.g. 'cancellation') and doc has 0 token overlap, heavily penalize
        if query_tokens and not overlap:
            hybrid = 0.02 * (_cosine_sim(query_vector, doc.embedding) if doc.embedding else 0.0)
        else:
            keyword = len(overlap) / len(query_tokens) if query_tokens else 0.0
            semantic = _cosine_sim(query_vector, doc.embedding) if doc.embedding else 0.0
            hybrid = 0.65 * keyword + 0.35 * semantic

        scored.append((doc, hybrid))

    scored.sort(key=lambda pair: pair[1], reverse=True)
    filtered = [(doc, score) for doc, score in scored if score >= min_score]
    if not filtered and scored:
        filtered = scored[:1]
    return filtered[:top_k]


def search_relevant_docs(db: Session, query: str, top_k: int = 4) -> List[KnowledgeDocument]:
    return [doc for doc, _ in rank_relevant_docs(db, query, top_k=top_k)]

