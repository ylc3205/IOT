import { History } from 'lucide-react';
import { PlaceholderPage } from '../../components/common/PlaceholderPage';

export function ParkingSessionsPage() {
  return (
    <PlaceholderPage
      title="Lượt gửi xe & Phiên đỗ (Sessions)"
      moduleCode="MOD-SESSIONS-02"
      plannedPhase="Phase 2 (Entry/Exit Logic)"
      description="Ghi nhận toàn bộ chu kỳ xe vào - ra (Entry/Exit Session), thời gian gửi xe, kiểm tra khớp nối giữa thẻ RFID quẹt tại cổng và vị trí đỗ thực tế."
      upcomingFeatures={[
        'Danh sách phiên gửi xe đang hoạt động (Active Sessions)',
        'Lịch sử phiên gửi xe hoàn tất với mốc thời gian chi tiết',
        'Xử lý ngoại lệ cổng (sự cố quẹt thẻ, xe kẹt tại barrier)',
        'Nhật ký hình ảnh/sự kiện thời điểm xe check-in và check-out'
      ]}
      icon={<History className="w-6 h-6 text-blue-600" />}
    />
  );
}

