import { useEffect, useState, useRef, DragEvent } from 'react';
import { Upload, BookOpen, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import api from '../lib/api';
import DocumentCard from '../components/DocumentCard';

interface Document {
  id: number;
  original_name: string;
  file_type: string;
  chunk_count: number;
  file_size: number;
  uploaded_at: string;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function loadDocuments() {
    api.get('/documents').then((r) => setDocuments(r.data)).catch(() => {});
  }

  useEffect(() => { loadDocuments(); }, []);

  async function uploadFile(file: File) {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      setUploadState('error');
      setUploadMessage('Tipo file non supportato. Usa PDF, DOCX o TXT.');
      return;
    }

    setUploadState('uploading');
    setUploadMessage(`Elaborazione ${file.name}…`);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadState('success');
      setUploadMessage(`"${res.data.original_name}" caricato — ${res.data.chunk_count} chunk generati`);
      loadDocuments();
      setTimeout(() => setUploadState('idle'), 4000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Errore caricamento';
      setUploadState('error');
      setUploadMessage(msg);
      setTimeout(() => setUploadState('idle'), 4000);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminare questo documento dalla knowledge base?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert('Errore durante l\'eliminazione');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
          <BookOpen size={18} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {documents.length} documento{documents.length !== 1 ? 'i' : ''} caricato{documents.length !== 1 ? 'i' : ''}
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => uploadState === 'idle' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer mb-4 ${
          dragOver ? 'border-brand-blue bg-blue-50' :
          uploadState === 'uploading' ? 'border-blue-300 bg-blue-50 cursor-not-allowed' :
          'border-gray-200 hover:border-brand-blue hover:bg-blue-50/30'
        }`}
      >
        <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFileChange} />

        {uploadState === 'uploading' ? (
          <>
            <Loader2 size={32} className="mx-auto text-brand-blue animate-spin mb-3" />
            <p className="text-sm font-medium text-gray-700">{uploadMessage}</p>
            <p className="text-xs text-gray-400 mt-1">Estrazione testo e generazione embedding in corso…</p>
          </>
        ) : (
          <>
            <Upload size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700">Trascina qui un documento o clicca per caricare</p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT — max 20 MB</p>
          </>
        )}
      </div>

      {/* Feedback upload */}
      {uploadState === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm mb-4">
          <CheckCircle size={16} />
          {uploadMessage}
        </div>
      )}
      {uploadState === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
          <AlertCircle size={16} />
          {uploadMessage}
        </div>
      )}

      {/* Lista documenti */}
      <div className="space-y-2">
        {documents.length === 0 && uploadState === 'idle' && (
          <div className="text-center py-10 text-gray-400">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun documento caricato</p>
            <p className="text-xs mt-1">Carica PDF o DOCX per addestrare l'agente</p>
          </div>
        )}
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onDelete={handleDelete}
            deleting={deletingId === doc.id}
          />
        ))}
      </div>
    </div>
  );
}
