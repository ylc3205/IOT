import { Car } from 'lucide-react';
import { PlaceholderPage } from '../../components/common/PlaceholderPage';

export function VehicleManagementPage() {
  return (
    <PlaceholderPage
      title="Quản lý Phương tiện (Vehicles)"
      moduleCode="MOD-VEHICLES-03"
      plannedPhase="Phase 2 (Vehicle Registry)"
      description="Quản lý danh sách phương tiện gửi thường xuyên (Vé tháng/Cư dân/Nhân viên) và phương tiện vãng lai (Khách gửi vé lượt theo giờ)."
      upcomingFeatures={[
        'Đăng ký phương tiện vé tháng (biển số xe, chủ sở hữu, loại xe)',
        'Liên kết xe với thẻ từ RFID cố định',
        'Tra cứu lịch sử ra/vào theo biển số xe',
        'Bộ lọc phân loại: Xe máy, Ô tô 4-7 chỗ, Xe tải nhỏ'
      ]}
      icon={<Car className="w-6 h-6 text-blue-600" />}
    />
  );
}

