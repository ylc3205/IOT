import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function LoadingSpinner({
  className,
  text = 'Đang tải dữ liệu...'
}: {
  className?: string;
  text?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 space-y-3', className)}>
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      {text && <p className="text-sm text-slate-500 font-medium">{text}</p>}
    </div>
  );
}

