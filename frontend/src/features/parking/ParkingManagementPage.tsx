import { ParkingSquare } from 'lucide-react';
import { PlaceholderPage } from '../../components/common/PlaceholderPage';

export function ParkingManagementPage() {
  return (
    <PlaceholderPage
      title="Quản lý Bãi đỗ xe & Vị trí đỗ"
      moduleCode="MOD-PARKING-01"
      plannedPhase="Phase 1 (Domain Modeling)"
      description="Phân hệ định nghĩa sơ đồ bãi đỗ xe (ParkingLot), phân chia các khu vực đỗ (Zones), và quản lý trạng thái từng vị trí (ParkingSlot: Trống, Có xe, Đang bảo trì)."
      upcomingFeatures={[
        'Khai báo thông số bãi đỗ xe (sức chứa, khu vực ô tô, xe máy)',
        'Sơ đồ mặt bằng trực quan các vị trí đỗ theo thời gian thực',
        'Liên kết vị trí đỗ với cảm biến khoảng cách/siêu âm ESP32',
        'Cấu hình biển báo điện tử hiển thị số chỗ trống còn lại'
      ]}
      icon={<ParkingSquare className="w-6 h-6 text-blue-600" />}
    />
  );
}

