/**
 * Các hàm tiện ích chuẩn hóa định dạng chuỗi dữ liệu (Data Normalizers)
 * Đảm bảo tính nhất quán giữa dữ liệu nhập từ CMS và dữ liệu truyền từ phần cứng IoT.
 */

/**
 * Chuẩn hóa biển số xe:
 * - Loại bỏ dấu cách, dấu gạch nối, dấu chấm và các ký tự đặc biệt.
 * - Chuyển toàn bộ thành chữ in hoa.
 * Ví dụ: "51a-123.45" -> "51A12345", " 59B1 - 98765 " -> "59B198765"
 */
export function normalizeLicensePlate(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Chuẩn hóa mã định danh thẻ RFID (Hardware UID):
 * - Loại bỏ dấu hai chấm, dấu gạch ngang và khoảng trắng thừa.
 * - Chuyển toàn bộ thành chữ in hoa Hex.
 * Ví dụ: "e2:00:00:19:06:00" -> "E20000190600", " a1-b2-c3-d4 " -> "A1B2C3D4"
 */
export function normalizeRfidUid(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

