import { clsx } from 'clsx';

type Status = 'answered' | 'transferred' | 'voicemail' | 'active' | 'online' | 'offline' | string;

const variants: Record<string, string> = {
  answered: 'bg-green-100 text-green-700',
  transferred: 'bg-blue-100 text-blue-700',
  voicemail: 'bg-yellow-100 text-yellow-700',
  missed: 'bg-red-100 text-red-600',
  active: 'bg-green-100 text-green-700',
  online: 'bg-green-100 text-green-700',
  offline: 'bg-gray-100 text-gray-600',
};

const labels: Record<string, string> = {
  answered: 'Risposta',
  transferred: 'Trasferita',
  voicemail: 'Voicemail',
  missed: 'Persa',
  active: 'Attivo',
  online: 'Online',
  offline: 'Offline',
};

interface Props {
  status: Status;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[status] ?? 'bg-gray-100 text-gray-600',
        className
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
