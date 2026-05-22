FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for PyMuPDF, etc.
RUN apt-get update && apt-get install -y \
    libmupdf-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create data directory
RUN mkdir -p data

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
