import { HealthWidget } from '../../components/common/HealthWidget';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Layers, ShieldCheck, Cpu, Terminal, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Title & Introduction Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="max-w-3xl space-y-3">
          <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm">
            NỀN TẢNG PHA 0 &middot; SẴN SÀNG KIỂM THỬ
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            SMART PARKING IoT — CMS Management Console
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Hệ thống quản lý bãi đỗ xe thông minh kết hợp thiết bị biên ESP32, chuẩn truyền thông MQTT
            (Mosquitto Broker) và Backend Express TypeScript với cơ sở dữ liệu PostgreSQL.
          </p>
        </div>
      </div>

      {/* Realtime Backend Health Check Widget (Section 10 requirement) */}
      <HealthWidget />

      {/* Architectural Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-1">
              <Layers className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">Kiến trúc Modular Monolith</CardTitle>
            <CardDescription>Mô hình đơn khối phân tầng rõ ràng</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-2">
            <p>
              Toàn bộ dịch vụ Backend gói gọn trong một khối thống nhất, tối ưu thời gian phát triển
              và duy trì tính toàn vẹn dữ liệu qua Prisma ORM.
            </p>
            <div className="pt-2">
              <span className="font-semibold text-slate-900">Chuẩn kết nối:</span> REST API cho CMS, MQTT cho ESP32.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
              <Cpu className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">Giao thức MQTT & Broker</CardTitle>
            <CardDescription>Eclipse Mosquitto Containerized</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-2">
            <p>
              Kênh truyền tin 2 chiều cho ESP32 quét thẻ RFID, cảm biến vị trí đỗ và lệnh điều khiển
              barrier đóng/mở tự động với xác thực ACL an toàn.
            </p>
            <div className="pt-2">
              <Link to="/devices" className="text-blue-600 font-medium inline-flex items-center gap-1 hover:underline">
                Xem phân hệ thiết bị <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-1">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">Quy chuẩn Phase 0</CardTitle>
            <CardDescription>Tính trung thực & Xác minh thực tế</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-2">
            <p>
              Chỉ xây dựng bộ khung nền tảng vững chắc. Tuyệt đối không giả lập dữ liệu thống kê ảo
              trước khi tích hợp thực tế với phần cứng và nghiệp vụ bãi xe.
            </p>
            <div className="pt-2">
              <span className="font-semibold text-slate-900">Trạng thái:</span> Đã vượt qua typecheck, lint & unit tests.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terminal / Run Commands Reference */}
      <Card className="bg-slate-900 text-slate-100 border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-mono text-slate-200">Lệnh khởi động nền tảng tại chỗ (Local Runbook)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="font-mono text-xs text-slate-300 space-y-3">
          <div className="p-3 bg-slate-950 rounded border border-slate-800">
            <p className="text-slate-500"># 1. Khởi động PostgreSQL & Mosquitto Broker:</p>
            <p className="text-emerald-400">docker compose up -d</p>
          </div>
          <div className="p-3 bg-slate-950 rounded border border-slate-800">
            <p className="text-slate-500"># 2. Khởi động Backend API (Port 5000):</p>
            <p className="text-emerald-400">cd backend &amp;&amp; npm run dev</p>
          </div>
          <div className="p-3 bg-slate-950 rounded border border-slate-800">
            <p className="text-slate-500"># 3. Khởi động React CMS (Port 5173):</p>
            <p className="text-emerald-400">cd frontend &amp;&amp; npm run dev</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

