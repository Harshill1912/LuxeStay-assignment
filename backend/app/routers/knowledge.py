from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import KnowledgeDocument, User
from app.schemas import KnowledgeOut, KnowledgeCreate
from app.auth import require_admin
from app.rag import ingest_document

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge Base RAG"])

@router.get("", response_model=List[KnowledgeOut])
def list_knowledge_docs(db: Session = Depends(get_db)):
    return db.query(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc()).all()

@router.post("/upload", response_model=KnowledgeOut)
async def upload_knowledge(
    title: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    final_title = title or "Policy Document"
    final_content = content or ""

    if file:
        file_bytes = await file.read()
        try:
            file_text = file_bytes.decode("utf-8")
            final_content = f"{final_content}\n{file_text}".strip()
            if not title:
                final_title = file.filename or "Uploaded Document"
        except Exception:
            raise HTTPException(status_code=400, detail="Uploaded file must be UTF-8 encoded text.")

    if not final_content.strip():
        raise HTTPException(status_code=400, detail="Content or text file is required for RAG ingestion.")

    doc = ingest_document(db, title=final_title, content=final_content)
    return doc
