import axios, { AxiosError, AxiosResponse } from 'axios';

/**
 * Cấu hình Axios Client giao tiếp với Backend Express REST API.
 * Tuân thủ chuẩn Response:
 * - Thành công: { "success": true, "data": ... }
 * - Thất bại: { "success": false, "error": { "code": ..., "message": ... } }
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response Interceptor bóc tách dữ liệu và chuẩn hóa lỗi
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error: AxiosError<{ success: false; error?: { code: string; message: string } }>) => {
    const errorPayload = error.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: error.message || 'Không thể kết nối đến máy chủ Backend'
    };

    return Promise.reject(errorPayload);
  }
);

