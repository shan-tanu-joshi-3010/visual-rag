# Contextual Visual-RAG Pipeline

This project implements a RAG (Retrieval-Augmented Generation) pipeline that ingests PDFs, extracts both text and images, and allows users to query the content. When a user asks a question, the system provides an answer using an LLM (Google Gemini) based *only* on the PDF context, and associates the relevant images from the cited pages.

## Architecture

- **Backend**: FastAPI
- **LLM**: Google Gemini API (`gemini-1.5-flash`)
- **Embeddings**: SentenceTransformers (`all-MiniLM-L6-v2`) running locally.
- **Vector Database**: FAISS (local, simple, CPU-based vector search)
- **PDF Parsing**: PyMuPDF (`fitz`)
- **Frontend**: React (Vite) + Tailwind CSS

## Text-to-Image Mapping Strategy

The spatial relationship between text and images is maintained at the **page level**.
1. During ingestion (using PyMuPDF), the PDF is parsed page by page.
2. For each page, the text is extracted. Simultaneously, any images present on that page are extracted and saved to the local `data/` directory.
3. The extracted text is then chunked and embedded.
4. The text chunks are stored in the FAISS vector database alongside metadata. This metadata includes the `doc_id`, the `page_num`, and an array of `images` (filenames) that were found on that exact page.
5. During retrieval, when a text chunk is retrieved via semantic search, we can access its metadata and send the associated image paths back to the frontend. The frontend displays these images side-by-side with the response context.

## Hallucination Control

The prompt passed to the LLM explicitly instructs it:
> "Your goal is to answer the user's question accurately using ONLY the information found in the context below. If the answer cannot be found in the context, say 'I don't know based on the provided documents.' Do not hallucinate or use outside knowledge."

## Setup and Deployment

### Option 1: Docker Compose (Preferred)

1. Ensure you have Docker and Docker Compose installed.
2. In the `backend` directory, create a `.env` file and add your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(Note: The environment has already been set up with the provided key for this demonstration).*
3. From the root directory of the project, run:
   ```bash
   docker-compose up --build
   ```
4. Once the containers are running:
   - Access the frontend at: `http://localhost:5173`
   - Access the backend API docs at: `http://localhost:8000/docs`

### Option 2: Local Development

**Backend Setup:**
```bash
cd backend
python -m venv venv
# Activate venv (Windows: .\venv\Scripts\activate, Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt
# Ensure .env contains GEMINI_API_KEY
uvicorn app.main:app --reload
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

## Features

- **Ingestion**: Upload multi-page PDFs. Text and images are extracted automatically.
- **Querying**: Ask questions and get answers restricted to the uploaded context.
- **Citations & Images**: Clickable citations show the page number and display any images found on that page in the UI.
- **Deletion**: Delete a PDF to remove it from the database and delete its extracted images from the disk.
- **Async Operations**: Uploads and queries are handled asynchronously.
