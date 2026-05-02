import { FileText, File, Trash2 } from 'lucide-react';

interface Document {
  id: number;
  original_name: string;
  file_type: string;
  chunk_count: number;
  file_size: number;
  uploaded_at: string;
}

interface Props {
  document: Document;
  onDelete: (id: number) => void;
  deleting?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentCard({ document: doc, onDelete, deleting }: Props) {
  const Icon = doc.file_type === 'pdf' ? FileText : File;
  const iconColor = doc.file_type === 'pdf' ? 'text-red-500' : 'text-blue-500';

  return (
    <div className="flex items-center gap-3 p-3 lg:p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
      <div className={`w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.original_name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {doc.chunk_count} chunk · {formatSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString('it-IT')}
        </p>
      </div>
      <span className="hidden sm:inline text-xs font-medium text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded">
        {doc.file_type}
      </span>
      <button
        onClick={() => onDelete(doc.id)}
        disabled={deleting}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        title="Elimina documento"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
