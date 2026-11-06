import { Cpu } from 'lucide-react';
import { PlaceholderPage } from '../../components/common/PlaceholderPage';

export function DevicesPage() {
  return (
    <PlaceholderPage
      title="Quản lý Thiết bị IoT & Node Biên ESP32"
      moduleCode="MOD-DEVICES-05"
      plannedPhase="Phase 1 (Device Registry)"
      description="Giám sát tình trạng hoạt động của các nút điều khiển biên ESP32 tại cổng vào/ra (Gate Nodes) và các nút cảm biến vị trí đỗ (Sensor Nodes)."
      upcomingFeatures={[
        'Danh sách Node IoT (Device ID, MAC Address, IP, Firmware Version)',
        'Theo dõi trạng thái nhịp tim (Heartbeat) và cường độ sóng Wi-Fi (RSSI)',
        'Báo cáo thiết bị mất kết nối (Offline Alert)',
        'Nhật ký lệnh gửi xuống thiết bị và xác nhận phản hồi (Command ACK)'
      ]}
      icon={<Cpu className="w-6 h-6 text-blue-600" />}
    />
  );
}

