import { useState, useEffect, useRef } from 'react';
import { useApi, useUploadApi } from '../utils/api';
import type { Document } from '../types';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: Document['status'] }) {
  const styles = {
    ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    processing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const labels = { ready: 'Ready', processing: 'Processing…', error: 'Error' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function DocumentManager() {
  const apiFetch = useApi();
  const uploadFetch = useUploadApi();

  const [docs, setDocs] = useState<Document[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    loadDocs();
    return () => { Object.values(pollingRef.current).forEach(clearInterval); };
  }, []);

  async function loadDocs() {
    try {
      const res = await apiFetch('/api/documents');
      if (res.ok) {
        const data: Document[] = await res.json();
        setDocs(data);
        data.filter(d => d.status === 'processing').forEach(d => pollStatus(d.id));
      }
    } catch { /* network */ }
  }

  function pollStatus(id: string) {
    if (pollingRef.current[id]) return;
    pollingRef.current[id] = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/documents/${id}/status`);
        if (!res.ok) return;
        const { status, total_chunks, error_message } = await res.json();
        if (status !== 'processing') {
          clearInterval(pollingRef.current[id]);
          delete pollingRef.current[id];
          setDocs(prev =>
            prev.map(d => d.id === id ? { ...d, status, total_chunks, error_message } : d),
          );
        }
      } catch { /* ignore */ }
    }, 2000);
  }

  async function handleUpload(file: File) {
    if (!file.name.endsWith('.pdf')) { setError('Only PDF files are supported.'); return; }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('pdf', file);
      const res = await uploadFetch('/api/documents/upload', form);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Upload failed');
        return;
      }
      const { documentId } = await res.json();
      const newDoc: Document = {
        id: documentId,
        display_name: file.name,
        status: 'processing',
        file_size_bytes: file.size,
        total_chunks: 0,
        error_message: null,
        created_at: new Date().toISOString(),
      };
      setDocs(prev => [newDoc, ...prev]);
      pollStatus(documentId);
    } catch {
      setError('Upload failed — check your connection.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
    clearInterval(pollingRef.current[id]);
    delete pollingRef.current[id];
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Documents</h1>
        <p className="text-slate-400 text-sm mt-1">Upload compliance PDFs — employees can query these in the chat.</p>
      </div>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
          dragging ? 'border-indigo-400 bg-indigo-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/2'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
        />
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V8m0 0l-3 3m3-3l3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
          </svg>
        </div>
        {uploading ? (
          <p className="text-slate-300 text-sm">Uploading…</p>
        ) : (
          <>
            <p className="text-slate-300 text-sm font-medium">Drop a PDF here or click to browse</p>
            <p className="text-slate-500 text-xs mt-1">Max 20 MB · PDF only</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Document list */}
      {docs.length > 0 && (
        <div className="mt-8 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Uploaded documents</p>
          {docs.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[#1E293B] border border-white/5 group"
            >
              {/* PDF icon */}
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <span className="text-red-400 text-[10px] font-bold">PDF</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{doc.display_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatBytes(doc.file_size_bytes)}
                  {doc.status === 'ready' && ` · ${doc.total_chunks} chunks`}
                  {doc.status === 'error' && ` · ${doc.error_message}`}
                </p>
              </div>

              <StatusBadge status={doc.status} />

              {/* Delete */}
              <button
                onClick={() => handleDelete(doc.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 p-1"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && !uploading && (
        <p className="text-center text-slate-600 text-sm mt-10">No documents yet.</p>
      )}
    </div>
  );
}
