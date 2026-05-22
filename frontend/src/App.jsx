import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, Trash2, Send, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

const API_URL = 'http://localhost:8000';

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents`);
      setDocuments(res.data.documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    try {
      await axios.delete(`${API_URL}/documents/${docId}`);
      if (selectedDocId === docId) setSelectedDocId('');
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setAsking(true);

    try {
      const res = await axios.post(`${API_URL}/query`, {
        query: userMessage.content,
        doc_id: selectedDocId || null,
      });

      const aiMessage = {
        role: 'assistant',
        content: res.data.answer,
        citations: res.data.citations,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error querying:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, an error occurred.' }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-200 bg-blue-50/50">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600" /> Visual-RAG
          </h1>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-6">
            <label className="flex items-center justify-center w-full px-4 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 cursor-pointer transition-colors group relative overflow-hidden">
              {uploading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Upload className="w-5 h-5 mr-2" /> Upload PDF</>}
              <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Documents</h2>
          <ul className="space-y-2">
            <li
              className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedDocId === '' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'hover:bg-gray-100 border border-transparent'}`}
              onClick={() => setSelectedDocId('')}
            >
              <span className="font-medium">All Documents</span>
            </li>
            {documents.map((doc) => (
              <li
                key={doc.doc_id}
                className={`p-3 rounded-lg flex items-center justify-between group transition-colors border ${
                  selectedDocId === doc.doc_id ? 'bg-blue-50 text-blue-800 border-blue-200' : 'hover:bg-gray-100 border-transparent text-gray-700'
                }`}
              >
                <div 
                  className="truncate flex-1 font-medium cursor-pointer"
                  onClick={() => setSelectedDocId(doc.doc_id)}
                  title={doc.filename}
                >
                  {doc.filename}
                </div>
                <div className="flex items-center gap-2">
                  <a href={`${API_URL}${doc.url}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600">
                    <FileText className="w-4 h-4" />
                  </a>
                  <button onClick={() => handleDelete(doc.doc_id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50 relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <FileText className="w-16 h-16 mb-4 text-gray-300" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">Welcome to Contextual Visual-RAG</h2>
              <p>Upload a PDF and start asking questions.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl rounded-2xl p-5 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  
                  {/* Citations & Images */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Sources & Context Images
                      </p>
                      <div className="space-y-4">
                        {msg.citations.map((cite, cIdx) => (
                          <div key={cIdx} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="text-sm text-gray-600 mb-2 font-medium flex items-center justify-between">
                              <span>Page {cite.page_num}</span>
                              <a 
                                href={`${API_URL}/data/${cite.doc_id}_${documents.find(d => d.doc_id === cite.doc_id)?.filename || 'document.pdf'}#page=${cite.page_num}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline flex items-center gap-1"
                              >
                                View PDF Page
                              </a>
                            </div>
                            {cite.images && cite.images.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                {cite.images.map((img, iIdx) => (
                                  <div 
                                    key={iIdx} 
                                    className="relative flex-shrink-0 cursor-pointer group"
                                    onClick={() => setSelectedImage(`${API_URL}/data/${img}`)}
                                  >
                                    <img 
                                      src={`${API_URL}/data/${img}`} 
                                      alt={`Context from page ${cite.page_num}`} 
                                      className="h-24 w-auto rounded border border-gray-200 object-cover hover:ring-2 ring-blue-400 transition-all"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity text-white text-xs font-medium gap-1">
                                      <ImageIcon className="w-4 h-4" /> Enlarge
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {asking && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 p-5 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-gray-500 font-medium">Generating response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200 shadow-lg">
          <form onSubmit={handleQuery} className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="w-full pl-6 pr-14 py-4 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-inner text-gray-800"
              disabled={asking}
            />
            <button
              type="submit"
              disabled={asking || !query.trim()}
              className="absolute right-2 p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img 
            src={selectedImage} 
            alt="Enlarged context" 
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          />
          <button 
            className="absolute top-6 right-6 text-white hover:text-gray-300 bg-black/50 w-10 h-10 rounded-full flex items-center justify-center"
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
