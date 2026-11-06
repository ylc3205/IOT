import React from 'react';
import { Construction, ArrowRight, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface PlaceholderPageProps {
  title: string;
  moduleCode: string;
  plannedPhase: string;
  description: string;
  upcomingFeatures: string[];
  icon?: React.ReactNode;
}

export function PlaceholderPage({
  title,
  moduleCode,
  plannedPhase,
  description,
  upcomingFeatures,
  icon
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            {icon}
            {title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Mã phân hệ: <span className="font-mono text-slate-700">{moduleCode}</span></p>
        </div>
        <div>
          <Badge variant="warning" className="px-3 py-1 text-xs gap-1.5 font-medium">
            <Construction className="w-3.5 h-3.5" /> {plannedPhase} — Chưa hiện thực
          </Badge>
        </div>
      </div>

      {/* Main card */}
      <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
        <CardHeader className="text-center py-8">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Construction className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl text-slate-800">Phân hệ đang trong lộ trình phát triển</CardTitle>
          <CardDescription className="max-w-lg mx-auto text-slate-600 mt-2">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-xl mx-auto pb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Các tính năng dự kiến triển khai trong pha tiếp theo:
            </h4>
            <ul className="space-y-2">
              {upcomingFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                  <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Theo quy chuẩn Pha 0, hệ thống tuyệt đối không hiển thị dữ liệu giả định (mock data).
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

