import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useApi, useUploadApi } from '../utils/api';
import type { Document } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentManager() {
  const apiFetch = useApi();
  const uploadFetch = useUploadApi();

  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    void loadDocs();
    return () => { Object.values(pollingRef.current).forEach(clearInterval); };
  }, []);

  async function loadDocs() {
    const res = await apiFetch('/api/documents');
    if (res.ok) {
      const data: Document[] = await res.json();
      setDocs(data);
      data.filter(d => d.status === 'processing').forEach(d => pollStatus(d.id));
    }
  }

  function pollStatus(id: string) {
    if (pollingRef.current[id]) return;
    pollingRef.current[id] = setInterval(async () => {
      const res = await apiFetch(`/api/documents/${id}/status`);
      if (!res.ok) return;
      const { status, total_chunks, error_message } = await res.json();
      if (status !== 'processing') {
        clearInterval(pollingRef.current[id]);
        delete pollingRef.current[id];
        setDocs(prev => prev.map(d => d.id === id ? { ...d, status, total_chunks, error_message } : d));
      }
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
      if (!res.ok) { const b = await res.json().catch(() => ({})); setError((b as { error?: string }).error ?? 'Upload failed'); return; }
      const { documentId } = await res.json() as { documentId: string };
      setDocs(prev => [{
        id: documentId, display_name: file.name, status: 'processing',
        file_size_bytes: file.size, total_chunks: 0, error_message: null,
        created_at: new Date().toISOString(),
      }, ...prev]);
      pollStatus(documentId);
    } catch { setError('Upload failed — check your connection.'); }
    finally { setUploading(false); }
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
    clearInterval(pollingRef.current[id]);
    delete pollingRef.current[id];
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Upload className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">Upload compliance PDFs for employee chat.</p>
        </div>
      </div>

      {/* Upload area */}
      <Card className="mb-6 border-dashed">
        <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Upload a PDF document</p>
            <p className="text-xs text-muted-foreground mt-0.5">Max 20 MB · PDF only</p>
          </div>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ''; }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Uploading…</> : 'Choose File'}
          </Button>
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />{error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document list */}
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          <CardHeader className="px-0 pt-0 pb-2">
            <CardTitle className="text-sm">Uploaded Documents</CardTitle>
            <CardDescription>{docs.length} document{docs.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          {docs.map(doc => (
            <Card key={doc.id}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(doc.file_size_bytes)}
                    {doc.status === 'ready' && ` · ${doc.total_chunks} chunks`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {doc.status === 'ready' && <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>}
                  {doc.status === 'processing' && <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>}
                  {doc.status === 'error' && <Badge variant="destructive" title={doc.error_message ?? ''}><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(doc.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
