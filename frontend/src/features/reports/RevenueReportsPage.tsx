import { BarChart3 } from 'lucide-react';
import { PlaceholderPage } from '../../components/common/PlaceholderPage';

export function RevenueReportsPage() {
  return (
    <PlaceholderPage
      title="Báo cáo Doanh thu & Thống kê"
      moduleCode="MOD-REPORTS-06"
      plannedPhase="Phase 3 (Billing & Analytics)"
      description="Tổng hợp doanh thu tiền mặt thu tại cổng, thống kê lưu lượng xe theo khung giờ cao điểm và tỷ lệ lấp đầy bãi đỗ xe."
      upcomingFeatures={[
        'Thống kê doanh thu theo ngày, tuần, tháng cho ca trực',
        'Biểu đồ mật độ lưu lượng xe ra vào theo giờ cao điểm',
        'Tỷ lệ quay vòng vị trí đỗ (Turnover Rate)',
        'Xuất dữ liệu đối soát bảng kê thu ngân ra định dạng CSV/Excel'
      ]}
      icon={<BarChart3 className="w-6 h-6 text-blue-600" />}
    />
  );
}

