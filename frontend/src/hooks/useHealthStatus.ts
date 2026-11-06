import { useQuery } from '@tanstack/react-query';
import { healthService } from '../services/health.service';

/**
 * Custom hook truy vấn trạng thái sức khỏe Backend (Liveness & Readiness).
 * Tự động cập nhật mỗi 10 giây để hiển thị trạng thái hệ thống trên CMS Top Navbar / Dashboard.
 */
export function useHealthStatus() {
  const livenessQuery = useQuery({
    queryKey: ['system-health', 'liveness'],
    queryFn: healthService.getLiveness,
    refetchInterval: 10000,
    retry: 2
  });

  const readinessQuery = useQuery({
    queryKey: ['system-health', 'readiness'],
    queryFn: healthService.getReadiness,
    refetchInterval: 10000,
    retry: 2
  });

  return {
    liveness: livenessQuery.data?.data,
    readiness: readinessQuery.data?.data,
    isLoading: livenessQuery.isLoading || readinessQuery.isLoading,
    isError: livenessQuery.isError,
    refetch: () => {
      livenessQuery.refetch();
      readinessQuery.refetch();
    }
  };
}

