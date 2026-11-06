import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center border-slate-200 shadow-md">
        <CardHeader className="py-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <FileQuestion className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl text-slate-800">404 — Không tìm thấy trang</CardTitle>
          <CardDescription className="text-slate-500 mt-2">
            Đường dẫn bạn yêu cầu không tồn tại hoặc đã được chuyển sang phân hệ khác.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <Link to="/">
            <Button className="w-full flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Quay lại Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

