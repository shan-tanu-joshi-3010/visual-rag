from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import shutil
import uuid
from typing import List, Optional

from app.services.rag import process_pdf, query_rag, delete_pdf_data

app = FastAPI(title="Visual-RAG API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

# Mount the data directory to serve images and PDFs
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

class QueryRequest(BaseModel):
    query: str
    doc_id: Optional[str] = None

@app.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    doc_id = str(uuid.uuid4())
    pdf_filename = f"{doc_id}_{file.filename}"
    pdf_path = os.path.join(DATA_DIR, pdf_filename)
    
    with open(pdf_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Process PDF asynchronously to not block the response
    background_tasks.add_task(process_pdf, pdf_path, doc_id, DATA_DIR)
    
    return {
        "message": "PDF uploaded and processing started in background.",
        "doc_id": doc_id,
        "filename": file.filename
    }

@app.get("/documents")
async def list_documents():
    # Simplistic way to list docs by checking uploaded pdfs in data dir
    documents = []
    for filename in os.listdir(DATA_DIR):
        if filename.endswith(".pdf"):
            doc_id = filename.split("_")[0]
            original_name = filename[len(doc_id)+1:]
            documents.append({
                "doc_id": doc_id,
                "filename": original_name,
                "url": f"/data/{filename}"
            })
    return {"documents": documents}

@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    # Delete from chroma and remove images
    delete_pdf_data(doc_id, DATA_DIR)
    
    # Remove the original PDF
    for filename in os.listdir(DATA_DIR):
        if filename.startswith(f"{doc_id}_") and filename.endswith(".pdf"):
            os.remove(os.path.join(DATA_DIR, filename))
            
    return {"message": "Document deleted successfully"}

@app.post("/query")
async def query_document(request: QueryRequest):
    try:
        result = query_rag(request.query, request.doc_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
