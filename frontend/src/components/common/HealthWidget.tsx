import { CheckCircle2, AlertCircle, RefreshCw, Server, Database, Radio } from 'lucide-react';
import { useHealthStatus } from '../../hooks/useHealthStatus';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function HealthWidget() {
  const { liveness, readiness, isLoading, isError, refetch } = useHealthStatus();

  return (
    <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-semibold">Trạng thái Hạ tầng Backend (Realtime)</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
        <CardDescription>
          Widget giám sát trực tiếp endpoint <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">/api/health</code> của Node.js Backend.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Liveness Service Status */}
          <div className="p-3 rounded-lg border border-slate-200/80 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-xs font-medium text-slate-500">API Service</p>
                <p className="text-sm font-semibold text-slate-900">{liveness?.service || 'smart-parking-api'}</p>
              </div>
            </div>
            {isError ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" /> Offline
              </Badge>
            ) : liveness?.status === 'ok' ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> Online
              </Badge>
            ) : (
              <Badge variant="warning">Đang kết nối...</Badge>
            )}
          </div>

          {/* Database Status */}
          <div className="p-3 rounded-lg border border-slate-200/80 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-xs font-medium text-slate-500">PostgreSQL</p>
                <p className="text-sm font-semibold text-slate-900">Database</p>
              </div>
            </div>
            {readiness?.database === 'connected' ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> Kết nối tốt
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" /> Mất kết nối
              </Badge>
            )}
          </div>

          {/* MQTT Mosquitto Status */}
          <div className="p-3 rounded-lg border border-slate-200/80 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-xs font-medium text-slate-500">Mosquitto Broker</p>
                <p className="text-sm font-semibold text-slate-900">MQTT IoT</p>
              </div>
            </div>
            {readiness?.mqtt === 'connected' ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> Kết nối tốt
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" /> Mất kết nối
              </Badge>
            )}
          </div>
        </div>

        {readiness?.timestamp && (
          <p className="mt-3 text-right text-xs text-slate-400">
            Lần kiểm tra gần nhất: {new Date(readiness.timestamp).toLocaleTimeString('vi-VN')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

