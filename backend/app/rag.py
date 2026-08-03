import math
import re
import httpx
from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models import KnowledgeDocument

# Stopwords for clean tokenization
_STOPWORDS = {
    "the", "a", "an", "is", "are", "do", "does", "can", "i", "you", "we",
    "my", "me", "of", "to", "for", "and", "or", "in", "on", "at", "it",
    "what", "how", "when", "where", "which", "your", "with", "about", "please",
    "have", "has", "any", "there", "this", "that", "tell", "show"
}

# Domain Synonym Expansion Map for Hotel Concierge RAG
_SYNONYM_MAP: Dict[str, List[str]] = {
    "pet": ["pets", "animal", "animals", "dog", "dogs", "cat", "cats", "service"],
    "pets": ["pet", "animal", "animals", "dog", "dogs", "cat", "cats", "service"],
    "checkin": ["check-in", "check in", "arrival", "timing", "hours", "time", "photo"],
    "checkout": ["check-out", "check out", "departure", "timing", "hours", "noon"],
    "breakfast": ["buffet", "dining", "meal", "food", "thali", "vegetarian", "jain", "azure"],
    "lunch": ["dining", "meal", "food", "restaurant", "thali", "vegetarian", "jain", "service"],
    "dinner": ["dining", "meal", "food", "restaurant", "thali", "vegetarian", "jain", "service"],
    "food": ["breakfast", "lunch", "dinner", "dining", "meal", "thali", "vegetarian", "jain", "azure", "service"],
    "cancel": ["cancellation", "refund", "retention", "charge", "no-show"],
    "cancellation": ["cancel", "refund", "retention", "charge", "no-show"],
    "pool": ["infinity", "spa", "ayurvedic", "fitness", "gym", "wi-fi", "parking", "amenities"],
    "smoking": ["non-smoking", "couples", "unmarried", "cctv", "safe", "security", "rules"],
    "payment": ["upi", "card", "cards", "deposit", "netbanking", "cash", "pre-authorisation"],
    "location": ["located", "address", "where", "beach", "road", "goa", "contact", "reach"],
    "far": ["distance", "minutes", "approximately", "airport", "railway", "away"],
    "distance": ["far", "minutes", "approximately", "airport", "railway", "away"],
    "address": ["location", "located", "beach", "road", "goa", "contact"],
    "located": ["location", "address", "beach", "road", "goa", "contact"],
    "wifi": ["wi-fi", "internet", "connectivity", "network", "bandwidth", "business"],
    "wi-fi": ["wifi", "internet", "connectivity", "network", "bandwidth", "business"],
    "internet": ["wifi", "wi-fi", "connectivity", "network", "bandwidth"],
    "laundry": ["housekeeping", "dry", "cleaning", "pressing", "turndown", "serviced"],
    "housekeeping": ["laundry", "cleaning", "turndown", "serviced", "daily"],
    "deposit": ["advance", "balance", "payment", "confirm", "transaction"],
    "advance": ["deposit", "balance", "payment", "confirm", "transaction"],
    "voucher": ["pass", "pdf", "print", "reservation", "confirmation"],
    "addon": ["add-on", "add-ons", "transfer", "spa", "chef", "extra", "bed", "services"],
    "add-on": ["addon", "add-ons", "transfer", "spa", "chef", "extra", "bed", "services"],
    "addons": ["add-on", "add-ons", "transfer", "spa", "chef", "extra", "bed", "services"],
    "spa": ["ayurvedic", "wellness", "massage", "treatment", "couples", "package"],
    "chef": ["private", "dinner", "dining", "add-on"],
    "wheelchair": ["accessible", "accessibility", "assistance", "disability", "grab", "rails", "step-free"],
    "accessible": ["wheelchair", "accessibility", "assistance", "disability", "step-free"],
    "doctor": ["medical", "emergency", "hospital", "first-aid", "assistance", "call"],
    "medical": ["doctor", "emergency", "hospital", "first-aid", "assistance"],
    "emergency": ["doctor", "medical", "hospital", "first-aid", "call"],
    "wedding": ["weddings", "event", "events", "banquet", "banquets", "reception", "lawn"],
    "event": ["events", "wedding", "weddings", "banquet", "banquets", "conference", "corporate"],
    "banquet": ["banquets", "wedding", "event", "events", "reception", "hall"],
    "lost": ["found", "left", "item", "items", "property", "claim", "belongings"],
    "found": ["lost", "left", "item", "items", "property", "claim"],
    "tip": ["tipping", "gratuity", "service", "charge"],
    "tipping": ["tip", "gratuity", "service", "charge"],
    "currency": ["exchange", "foreign", "rupees", "forex", "rates"],
    "exchange": ["currency", "foreign", "rupees", "forex", "rates"],
    "sustainability": ["sustainable", "eco", "environment", "solar", "plastic", "green"],
    "eco": ["sustainability", "sustainable", "environment", "solar", "plastic", "green"],
    "villa": ["villas", "suite", "suites", "cabana", "executive", "categories", "types"],
    "suite": ["suites", "villa", "villas", "cabana", "executive", "categories", "types"],
    "approval": ["approved", "approve", "review", "reviewed", "reservations", "request", "confirmed"],
    "approve": ["approval", "approved", "review", "reviewed", "request", "confirmed"],
    "process": ["reviewed", "request", "requested", "confirmed", "team", "reservations"],
    "categories": ["category", "types", "accommodation", "suites", "villas", "cabanas", "executive"],
    "category": ["categories", "types", "accommodation", "suites", "villas", "cabanas", "executive"],
    "types": ["categories", "category", "accommodation", "suites", "villas", "cabanas", "executive"],
    "timings": ["timing", "open", "hours", "daily", "operates"],
    "timing": ["timings", "open", "hours", "daily", "operates"],
}


def _tokenize(text: str) -> set:
    """Tokenize, normalize, and remove stopwords."""
    text_clean = (text or "").lower()
    text_clean = re.sub(r"\bcheckin\b", "check in check-in", text_clean)
    text_clean = re.sub(r"\bcheckout\b", "check out check-out", text_clean)
    raw_tokens = {
        w for w in re.findall(r"[a-z0-9\-]+", text_clean)
        if w not in _STOPWORDS and len(w) > 2
    }
    
    # Expand tokens with synonym map
    expanded = set(raw_tokens)
    for tok in raw_tokens:
        if tok in _SYNONYM_MAP:
            expanded.update(_SYNONYM_MAP[tok])
    return expanded


def get_embedding(text: str) -> List[float]:
    """Production-grade embedding generator with fallback to deterministic vector."""
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

    # 3. Deterministic 1536-dim vector fallback for offline execution
    vec = [0.0] * 1536
    words = text.lower().split()
    for idx, word in enumerate(words):
        pos = sum(ord(c) for c in word) % 1536
        vec[pos] += 1.0 / (idx + 1)
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def ingest_document(db: Session, title: str, content: str) -> KnowledgeDocument:
    """Ingest a knowledge document and store its vector embedding in DB."""
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


def _cosine_sim(v1: List[float], v2: List[float]) -> float:
    """Cosine similarity between two vector embeddings."""
    if not v1 or not v2:
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1)) or 1.0
    n2 = math.sqrt(sum(b * b for b in v2)) or 1.0
    return dot / (n1 * n2)


def rank_relevant_docs(
    db: Session,
    query: str,
    top_k: int = 4,
    min_score: Optional[float] = None,
    allow_low_score_fallback: bool = False,
) -> List[Tuple[KnowledgeDocument, float]]:
    """
    Production-Grade Hybrid Retrieval System:
    Combines dense semantic vector similarity with BM25-style keyword overlap & synonym expansion.
    Title matches receive extra boost, and documents without term alignment are filtered out.

    In knowledge-base-only mode nothing is returned when no document clears `min_score` —
    an empty result is the signal that the KB does not cover the question, so the
    concierge must refuse rather than answer from the model's own knowledge. Pass
    `allow_low_score_fallback=True` only for non-answering uses (e.g. suggestions).
    """
    if min_score is None:
        min_score = settings.RAG_MIN_SCORE
    all_docs = db.query(KnowledgeDocument).all()
    if not all_docs:
        return []

    query_vector = get_embedding(query)
    query_tokens = _tokenize(query)

    scored = []
    for doc in all_docs:
        doc_tokens = _tokenize(f"{doc.title} {doc.content}")
        title_tokens = _tokenize(doc.title)
        
        # Token overlap
        overlap = query_tokens & doc_tokens if query_tokens else set()
        title_overlap = query_tokens & title_tokens if query_tokens else set()
        
        # Heavy penalty for 0 token match when query has specific keywords
        if query_tokens and not overlap:
            hybrid = 0.01 * (_cosine_sim(query_vector, doc.embedding) if doc.embedding else 0.0)
        else:
            keyword_score = len(overlap) / len(query_tokens) if query_tokens else 0.0
            title_boost = 1.5 if title_overlap else 1.0
            semantic_score = _cosine_sim(query_vector, doc.embedding) if doc.embedding else 0.0
            
            # Weighted hybrid score (70% keyword relevance, 30% vector semantic similarity)
            hybrid = (0.70 * keyword_score + 0.30 * semantic_score) * title_boost

        scored.append((doc, hybrid))

    # Sort descending by score
    scored.sort(key=lambda pair: pair[1], reverse=True)
    filtered = [(doc, score) for doc, score in scored if score >= min_score]
    if not filtered and scored and allow_low_score_fallback:
        filtered = scored[:1]
    return filtered[:top_k]


def search_relevant_docs(db: Session, query: str, top_k: int = 4) -> List[KnowledgeDocument]:
    """Retrieve top-K relevant documents for RAG context (empty when the KB has no match)."""
    return [doc for doc, _ in rank_relevant_docs(db, query, top_k=top_k)]


def extract_best_answer_across(query: str, docs: List[KnowledgeDocument]) -> str:
    """
    Pick the single best-scoring sentence across several retrieved documents.
    Sentence scores are comparable across documents, so this corrects cases where
    document-level ranking put the right doc second (e.g. two docs both mention
    'deposit' but only one answers the question asked).
    """
    best_snippet, best_score = "", float("-inf")
    query_tokens = _tokenize(query)
    for doc in docs:
        for stmt, score in _score_sentences(query_tokens, doc.content):
            if score > best_score:
                best_snippet, best_score = stmt, score
    if best_snippet:
        return best_snippet
    return docs[0].content.strip() if docs else ""


def _score_sentences(query_tokens: set, content: str) -> List[Tuple[str, float]]:
    """Score each sentence of `content` by matched query terms (position breaks ties)."""
    sentences = re.split(r"[\n•\.]", content or "")
    scored = []
    for idx, stmt in enumerate(sentences):
        stmt_clean = stmt.strip()
        if not stmt_clean or len(stmt_clean) < 6:
            continue
        stmt_tokens = _tokenize(stmt_clean)
        matches = len(query_tokens & stmt_tokens) if query_tokens else 0
        if matches > 0:
            if not stmt_clean.endswith("."):
                stmt_clean += "."
            scored.append((stmt_clean, matches * 10 - (idx * 0.1)))
    return scored


def extract_best_answer_snippet(query: str, doc: KnowledgeDocument) -> str:
    """
    Sentence-level Extraction Window:
    Extracts and returns the single highest-confidence sentence snippet from a document
    that directly answers the user's query.
    """
    scored_sentences = _score_sentences(_tokenize(query), doc.content)
    if scored_sentences:
        scored_sentences.sort(key=lambda x: x[1], reverse=True)
        return scored_sentences[0][0]

    return doc.content.strip()
