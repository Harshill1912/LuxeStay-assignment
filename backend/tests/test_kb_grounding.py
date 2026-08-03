"""
Knowledge-base-only (closed-book) grounding tests.

These exercise the guardrail helpers directly so they run offline — no Gemini/OpenAI
key and no network call is required.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.config import settings

# Force the offline (no-LLM) path so tests are deterministic and make no network calls.
settings.GEMINI_API_KEY = ""
settings.OPENAI_API_KEY = ""
from app.models import KnowledgeDocument
from app.rag import ingest_document, rank_relevant_docs, search_relevant_docs
from app.chat import build_kb_only_rules, build_system_prompt, verify_grounding, kb_only_refusal

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_kb.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    ingest_document(
        session,
        "Check-in & Check-out Hours",
        "Standard check-in is 2:00 PM and check-out is 12:00 noon (IST). "
        "A valid government photo ID is mandatory for every guest at check-in.",
    )
    ingest_document(
        session,
        "Payment Methods",
        "We accept UPI, all major credit and debit cards, net banking, and cash up to statutory limits.",
    )
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


class _Doc:
    """Minimal stand-in for a KnowledgeDocument row."""
    def __init__(self, title, content=""):
        self.title = title
        self.content = content


# ===== RETRIEVAL: no match must return nothing, not a random document =====

def test_offtopic_query_retrieves_no_documents(db):
    """A question the KB does not cover must retrieve zero docs, so the LLM has nothing to answer from."""
    assert search_relevant_docs(db, "who won the 2018 football world cup") == []


def test_relevant_query_still_retrieves(db):
    docs = search_relevant_docs(db, "what is the check-in time")
    assert docs, "an in-KB question must still retrieve its document"
    assert docs[0].title == "Check-in & Check-out Hours"


def test_low_score_fallback_is_opt_in(db):
    """The old behaviour (return top doc regardless of score) is still available explicitly."""
    ranked = rank_relevant_docs(db, "who won the 2018 football world cup", allow_low_score_fallback=True)
    assert len(ranked) == 1


# ===== PROMPT: closed-book instructions are present and adapt to retrieval =====

def test_kb_only_rules_present_when_enabled():
    rules = build_kb_only_rules(has_kb_context=True)
    assert "KNOWLEDGE-BASE-ONLY MODE" in rules
    assert "MUST NOT use your own pre-trained/world knowledge" in rules
    assert settings.KB_NO_ANSWER_MESSAGE in rules


def test_kb_only_rules_flag_empty_retrieval():
    with_ctx = build_kb_only_rules(has_kb_context=True)
    without_ctx = build_kb_only_rules(has_kb_context=False)
    assert "NO knowledge document matched" not in with_ctx
    assert "NO knowledge document matched" in without_ctx


def test_system_prompt_embeds_grounding_contract():
    prompt = build_system_prompt(context="rooms...", rag_context="", user_role="user")
    assert "KNOWLEDGE-BASE-ONLY MODE" in prompt
    assert '"sources"' in prompt
    assert "NO MATCHING KNOWLEDGE DOCUMENT WAS RETRIEVED" in prompt


# ===== VERIFIER: server-side enforcement of the citation contract =====

def test_verifier_accepts_answer_citing_a_retrieved_document():
    docs = [_Doc("Check-in & Check-out Hours")]
    result = {"type": "text", "message": "Check-in is 2:00 PM.", "grounded": True,
              "sources": ["Check-in & Check-out Hours"]}
    ok, _ = verify_grounding(result, docs)
    assert ok


def test_verifier_accepts_live_data_and_none():
    for src in ("live_data", "none"):
        ok, _ = verify_grounding({"type": "text", "grounded": True, "sources": [src]}, [])
        assert ok, src


def test_verifier_rejects_fabricated_citation():
    """Model cites a document that was never supplied — the classic hallucinated source."""
    docs = [_Doc("Check-in & Check-out Hours")]
    result = {"type": "text", "message": "Our rooftop bar closes at 1 AM.", "grounded": True,
              "sources": ["Rooftop Bar Policy"]}
    ok, reason = verify_grounding(result, docs)
    assert not ok
    assert reason.startswith("unknown_source")


def test_verifier_rejects_self_declared_ungrounded_answer():
    ok, reason = verify_grounding({"type": "text", "message": "Probably around 3 PM.", "grounded": False}, [])
    assert not ok
    assert reason == "model_declared_ungrounded"


def test_verifier_skips_db_rebuilt_response_types():
    """room_cards / book_room are rebuilt from the database, so they carry no model-authored facts."""
    for resp_type in ("room_cards", "book_room", "action_card"):
        ok, _ = verify_grounding({"type": resp_type, "grounded": False}, [])
        assert ok, resp_type


def test_verifier_accepts_sources_as_bare_string():
    docs = [_Doc("Payment Methods")]
    ok, _ = verify_grounding({"type": "text", "grounded": True, "sources": "Payment Methods"}, docs)
    assert ok


def test_verifier_blocks_uncited_factual_answer():
    """LLM answers a world-knowledge question confidently with sources=['none'] — must be blocked."""
    result = {"type": "text", "grounded": True, "sources": ["none"],
              "message": "Claude is a family of large language models developed by Anthropic, "
                         "first released in March 2023 and now widely used for conversational AI tasks."}
    ok, reason = verify_grounding(result, [])
    assert not ok
    assert reason == "uncited_factual_claims"


def test_verifier_allows_none_cited_refusal_and_clarifying_question():
    refusal = {"type": "text", "grounded": False, "sources": ["none"],
               "message": settings.KB_NO_ANSWER_MESSAGE}
    # grounded:false refusal is handled earlier; test the none-cited path with grounded True
    refusal_ok = {"type": "text", "grounded": True, "sources": ["none"],
                  "message": settings.KB_NO_ANSWER_MESSAGE}
    clarify = {"type": "text", "grounded": True, "sources": ["none"],
               "message": "How many guests will be staying with us?"}
    greeting = {"type": "text", "grounded": True, "sources": ["none"],
                "message": "Namaste! Welcome to LuxeStay. How may I assist you today?"}
    for r in (refusal_ok, clarify, greeting):
        ok, _ = verify_grounding(r, [])
        assert ok, r["message"]


# ===== WEAK-MATCH GUARD: tangential retrieval must refuse, not quote unrelated facts =====

def test_weak_tangential_match_refuses(db):
    """'who is the prime minister of india' matches the KB only on 'india' — must refuse."""
    from app.chat import process_chat_message
    from app.rag import ingest_document as ingest
    ingest(db, "Hotel Location & Contact",
           "LuxeStay is located on Beach Road, North Goa, Goa 403516, India.")
    resp = process_chat_message(db, None, "who is the prime minister of india")
    assert resp.message == settings.KB_NO_ANSWER_MESSAGE


def test_strong_match_still_answers(db):
    from app.chat import process_chat_message
    resp = process_chat_message(db, None, "what payment methods do you accept")
    assert "UPI" in resp.message


# ===== REFUSAL: what the guest actually sees =====

def test_refusal_message_when_nothing_retrieved():
    resp = kb_only_refusal("what is the weather in Paris", [])
    assert resp.type == "text"
    assert resp.message == settings.KB_NO_ANSWER_MESSAGE


def test_refusal_falls_back_to_verbatim_kb_snippet(db):
    docs = search_relevant_docs(db, "check-in time")
    resp = kb_only_refusal("check-in time", docs)
    assert "2:00 PM" in resp.message
