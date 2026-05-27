import os
import fitz  # PyMuPDF
import faiss
import numpy as np
import json
from sentence_transformers import SentenceTransformer
from google import genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Initialize Embedding Model
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
EMBEDDING_DIM = 384

INDEX_FILE = "faiss_index.bin"
METADATA_FILE = "faiss_metadata.json"


def load_index_and_metadata():
    if os.path.exists(INDEX_FILE) and os.path.exists(METADATA_FILE):
        index = faiss.read_index(INDEX_FILE)

        with open(METADATA_FILE, "r") as f:
            metadata = json.load(f)
    else:
        index = faiss.IndexFlatL2(EMBEDDING_DIM)
        metadata = []

    return index, metadata


def save_index_and_metadata(index, metadata):
    faiss.write_index(index, INDEX_FILE)

    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f)


def process_pdf(pdf_path: str, doc_id: str, data_dir: str):
    """
    Parses PDF, extracts text and images per page,
    embeds text and saves to FAISS.
    """

    doc = fitz.open(pdf_path)

    index, metadata = load_index_and_metadata()

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text()

        # Extract images
        image_paths = []
        image_list = page.get_images(full=True)

        for img_index, img in enumerate(image_list):
            xref = img[0]

            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            image_filename = (
                f"{doc_id}_page{page_num + 1}_img{img_index + 1}.{image_ext}"
            )

            image_filepath = os.path.join(data_dir, image_filename)

            with open(image_filepath, "wb") as f:
                f.write(image_bytes)

            image_paths.append(image_filename)

        # Store text embeddings
        if text.strip():

            embedding = embedding_model.encode(text)

            index.add(np.array([embedding], dtype=np.float32))

            metadata.append({
                "doc_id": doc_id,
                "page_num": page_num + 1,
                "images": image_paths,
                "text": text
            })

    save_index_and_metadata(index, metadata)


def query_rag(query: str, doc_id: str = None):
    """
    Searches FAISS for relevant chunks
    and generates response using Gemini.
    """

    index, metadata = load_index_and_metadata()

    if index.ntotal == 0:
        return {
            "answer": "No documents ingested.",
            "citations": []
        }

    query_embedding = embedding_model.encode(query)

    k = 10 if doc_id else 3

    distances, indices = index.search(
        np.array([query_embedding], dtype=np.float32),
        k
    )

    context_str = ""
    citations = []

    retrieved_count = 0

    for idx in indices[0]:

        if idx == -1 or idx >= len(metadata):
            continue

        meta = metadata[idx]

        if doc_id and meta["doc_id"] != doc_id:
            continue

        page_num = meta["page_num"]
        doc = meta["doc_id"]
        images = meta["images"]
        text = meta["text"]

        context_str += (
            f"--- Chunk from Document: {doc}, "
            f"Page: {page_num} ---\n{text}\n\n"
        )

        if not any(
            c["doc_id"] == doc and c["page_num"] == page_num
            for c in citations
        ):
            citations.append({
                "doc_id": doc,
                "page_num": page_num,
                "images": images
            })

        retrieved_count += 1

        if retrieved_count >= 3:
            break

    if not context_str:
        return {
            "answer": "No relevant context found.",
            "citations": []
        }

    prompt = f"""
You are a helpful assistant answering questions
based ONLY on the provided document context.

Rules:
- Use ONLY the provided context.
- If answer is not present, say:
  "I don't know based on the provided documents."
- Do not hallucinate.
- Keep answers concise and accurate.

Context:
{context_str}

User Question:
{query}

Answer:
"""

    try:

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )

        answer = response.text

    except Exception as e:

        answer = f"Gemini API Error: {str(e)}"

    return {
        "answer": answer,
        "citations": citations
    }


def delete_pdf_data(doc_id: str, data_dir: str):
    """
    Removes PDF data from FAISS and local disk.
    """

    index, metadata = load_index_and_metadata()

    indices_to_keep = [
        i for i, meta in enumerate(metadata)
        if meta["doc_id"] != doc_id
    ]

    if len(indices_to_keep) < len(metadata):

        new_index = faiss.IndexFlatL2(EMBEDDING_DIM)
        new_metadata = []

        for i in indices_to_keep:

            meta = metadata[i]

            embedding = embedding_model.encode(meta["text"])

            new_index.add(
                np.array([embedding], dtype=np.float32)
            )

            new_metadata.append(meta)

        save_index_and_metadata(new_index, new_metadata)

    if os.path.exists(data_dir):

        for filename in os.listdir(data_dir):

            if filename.startswith(f"{doc_id}_"):

                try:
                    os.remove(os.path.join(data_dir, filename))

                except Exception as e:
                    print(f"Error deleting file {filename}: {e}")