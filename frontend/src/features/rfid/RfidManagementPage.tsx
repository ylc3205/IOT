import { CreditCard } from 'lucide-react';
import { PlaceholderPage } from '../../components/common/PlaceholderPage';

export function RfidManagementPage() {
  return (
    <PlaceholderPage
      title="Quản lý Thẻ từ RFID"
      moduleCode="MOD-RFID-04"
      plannedPhase="Phase 1 (Hardware Integration)"
      description="Quản lý kho thẻ từ RFID (Mifare RC522 13.56MHz), cấp phát thẻ mới, khóa thẻ bị mất và kiểm tra tính hợp lệ của mã UID thẻ."
      upcomingFeatures={[
        'Kho thẻ từ hệ thống (UID thẻ, ngày kích hoạt, trạng thái hoạt động/khóa)',
        'Cấp phát thẻ vãng lai tại quầy kiểm soát',
        'Gán thẻ cứng cho nhân viên / sinh viên trường',
        'Nhật ký quẹt thẻ thô (Raw RFID Scan Logs) thu nhận từ MQTT'
      ]}
      icon={<CreditCard className="w-6 h-6 text-blue-600" />}
    />
  );
}

