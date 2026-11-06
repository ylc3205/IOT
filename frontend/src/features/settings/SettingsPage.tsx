import { Settings } from 'lucide-react';
import { PlaceholderPage } from '../../components/common/PlaceholderPage';

export function SettingsPage() {
  return (
    <PlaceholderPage
      title="Cài đặt Hệ thống & Biểu phí"
      moduleCode="MOD-SETTINGS-07"
      plannedPhase="Phase 2 (Pricing Engine)"
      description="Cấu hình bảng giá gửi xe (Pricing Rules: ban ngày, ban đêm, quá giờ), thời gian miễn phí chuyển tiếp, và tham số kết nối hệ thống."
      upcomingFeatures={[
        'Cấu hình biểu giá gửi xe lũy tiến theo block 2h / 4h / qua đêm',
        'Cài đặt thời gian nâng hạ barrier tự động (Gate Timeout: 5s - 10s)',
        'Quản lý danh sách tài khoản nhân viên vận hành cổng (Operators)',
        'Sao lưu và phục hồi dữ liệu hệ thống cục bộ'
      ]}
      icon={<Settings className="w-6 h-6 text-blue-600" />}
    />
  );
}

