import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

export interface AdmissionCapacityResult {
  parkingLotId: string;
  parkingLotName: string;
  totalCapacity: number;
  logicalOccupiedCount: number;
  physicalOccupiedCount: number;
  maintenanceCount: number;
  unknownCount: number;
  safeAvailableSpaces: number;
}

export class AdmissionService {
  /**
   * Thuật toán tiếp nhận sức chứa bảo thủ (Conservative Admission Algorithm)
   * Bắt buộc thực thi bên trong một Prisma Transaction đang giữ khóa hàng bi quan (SELECT ... FOR UPDATE).
   * - Loại trừ hoàn toàn nguy cơ trừ trùng giữa MAINTENANCE và UNKNOWN.
   * - Loại trừ nguy cơ đếm trùng giữa ô cảm biến OCCUPIED và phiên ACTIVE.
   * - Tính đến tải giữ chỗ của PENDING_ENTRY (Reservation) và PENDING_EXIT.
   */
  public static async executeConservativeAdmission(
    tx: Prisma.TransactionClient,
    parkingLotId: string
  ): Promise<AdmissionCapacityResult> {
    // 1. Xác lập khóa bi quan (Pessimistic Row Lock) trên bản ghi bãi đỗ xe để tuần tự hóa
    const lots = await tx.$queryRaw<Array<{ id: string; totalCapacity: number; isActive: boolean; name: string }>>`
      SELECT id, "totalCapacity", "isActive", name
      FROM "parking_lots"
      WHERE id = ${parkingLotId}
      FOR UPDATE
    `;

    const lot = lots[0];
    if (!lot) {
      throw AppError.notFound('Bãi đỗ xe không tồn tại', ErrorCodes.PARKING_LOT_NOT_FOUND);
    }
    if (!lot.isActive) {
      throw AppError.badRequest('Bãi đỗ xe hiện đang tạm ngừng hoạt động', ErrorCodes.BAD_REQUEST);
    }

    // 2. Đọc tải phiên logic đang hoạt động (Source of Truth logic: PENDING_ENTRY, ACTIVE, PENDING_EXIT)
    const logicalOccupiedCount = await tx.parkingSession.count({
      where: {
        parkingLotId,
        status: { in: ['PENDING_ENTRY', 'ACTIVE', 'PENDING_EXIT'] }
      }
    });

    // 3. Đọc hiện trạng cảm biến các vị trí đỗ vật lý (Source of Truth cảm biến)
    const slots = await tx.parkingSlot.findMany({
      where: { parkingLotId, isActive: true },
      select: { operationalStatus: true, sensorStatus: true }
    });

    let maintCount = 0;
    let unknownCount = 0;
    let physOccupiedCount = 0;
    let safeAvailableSpaces = lot.totalCapacity - logicalOccupiedCount;

    if (slots.length > 0) {
      // Phân rã 100% ô đỗ thành các tập hợp rời nhau hoàn toàn (Zero Double-Counting)
      for (const slot of slots) {
        if (slot.operationalStatus === 'MAINTENANCE') {
          maintCount++;
        } else if (slot.sensorStatus === 'UNKNOWN') {
          // Chỉ tính UNKNOWN cho các ô KHÔNG ở chế độ bảo trì -> Không trừ trùng
          unknownCount++;
        } else if (slot.operationalStatus === 'OCCUPIED' || slot.sensorStatus === 'OCCUPIED') {
          physOccupiedCount++;
        }
      }

      // Số ô đỗ lành lặn vận hành được
      const healthySlots = Math.max(0, slots.length - maintCount - unknownCount);

      // Số chỗ vật lý thực sự khả dụng sau khi trừ số xe trong bãi chưa vào ô
      const physicalAvailable = healthySlots - Math.max(physOccupiedCount, logicalOccupiedCount);
      const logicalAvailable = lot.totalCapacity - logicalOccupiedCount;

      // Sức chứa an toàn = min(Logical Available, Physical Available)
      safeAvailableSpaces = Math.min(logicalAvailable, physicalAvailable);
    }

    // 4. Quyết định tiếp nhận
    if (safeAvailableSpaces <= 0) {
      throw AppError.conflict(
        `Bãi đỗ xe "${lot.name}" đã hết chỗ trống khả dụng`,
        ErrorCodes.PARKING_LOT_FULL
      );
    }

    return {
      parkingLotId: lot.id,
      parkingLotName: lot.name,
      totalCapacity: lot.totalCapacity,
      logicalOccupiedCount,
      physicalOccupiedCount: physOccupiedCount,
      maintenanceCount: maintCount,
      unknownCount,
      safeAvailableSpaces
    };
  }
}
