import { prisma } from '../../integrations/database/prisma.client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  CreateParkingLotInput,
  UpdateParkingLotInput,
  ListParkingLotsQuery
} from './parking-lot.validation';
import { buildPaginatedResult, PaginatedResult } from '../../common/utils/pagination';
import { ParkingLot } from '@prisma/client';

export interface ParkingLotOccupancyResult {
  parkingLotId: string;
  parkingLotName: string;
  totalCapacity: number;
  configuredSlots: number;
  available: number;
  occupied: number;
  maintenance: number;
  unknown: number;
}

export class ParkingLotService {
  /**
   * Danh sách bãi đỗ xe có phân trang và lọc theo trạng thái
   */
  public async listParkingLots(query: ListParkingLotsQuery): Promise<PaginatedResult<ParkingLot>> {
    const { page, limit, isActive } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(isActive !== undefined ? { isActive } : {})
    };

    const [items, total] = await Promise.all([
      prisma.parkingLot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              parkingSlots: true,
              devices: true
            }
          }
        }
      }),
      prisma.parkingLot.count({ where })
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  /**
   * Xem chi tiết thông tin một bãi đỗ xe
   */
  public async getParkingLotById(id: string): Promise<ParkingLot> {
    const lot = await prisma.parkingLot.findUnique({
      where: { id },
      include: {
        devices: {
          select: { id: true, deviceCode: true, deviceType: true, status: true }
        },
        _count: {
          select: {
            parkingSlots: true,
            pricingRules: true
          }
        }
      }
    });

    if (!lot) {
      throw AppError.notFound('Không tìm thấy thông tin bãi đỗ xe', ErrorCodes.PARKING_LOT_NOT_FOUND);
    }

    return lot;
  }

  /**
   * Tạo mới một bãi đỗ xe
   */
  public async createParkingLot(input: CreateParkingLotInput): Promise<ParkingLot> {
    return prisma.parkingLot.create({
      data: {
        name: input.name,
        location: input.location,
        totalCapacity: input.totalCapacity,
        isActive: true
      }
    });
  }

  /**
   * Cập nhật thông số bãi đỗ xe
   */
  public async updateParkingLot(id: string, input: UpdateParkingLotInput): Promise<ParkingLot> {
    await this.getParkingLotById(id);

    return prisma.parkingLot.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.totalCapacity !== undefined ? { totalCapacity: input.totalCapacity } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });
  }

  /**
   * Tính toán báo cáo sức chứa và độ lấp đầy (Occupancy Calculation):
   * - Nếu bãi đã thiết lập các vị trí đỗ riêng biệt (ParkingSlot > 0):
   *   Số liệu thời gian thực được tính trực tiếp từ trạng thái cảm biến và vận hành của slot.
   * - Nếu chưa cấu hình slot:
   *   Sử dụng sức chứa lý thuyết (totalCapacity) đối chiếu với các phiên gửi xe đang hoạt động (ACTIVE).
   */
  public async getOccupancy(id: string): Promise<ParkingLotOccupancyResult> {
    const lot = await this.getParkingLotById(id);

    // Đếm số lượng vị trí đỗ thực tế
    const slots = await prisma.parkingSlot.findMany({
      where: { parkingLotId: id, isActive: true }
    });

    if (slots.length > 0) {
      const configuredSlots = slots.length;
      let available = 0;
      let occupied = 0;
      let maintenance = 0;
      let unknown = 0;

      for (const slot of slots) {
        if (slot.operationalStatus === 'MAINTENANCE') {
          maintenance++;
        } else if (
          slot.operationalStatus === 'OCCUPIED' ||
          slot.sensorStatus === 'OCCUPIED'
        ) {
          occupied++;
        } else if (
          slot.operationalStatus === 'AVAILABLE' &&
          slot.sensorStatus === 'EMPTY'
        ) {
          available++;
        } else if (slot.sensorStatus === 'UNKNOWN') {
          unknown++;
        }
      }

      return {
        parkingLotId: lot.id,
        parkingLotName: lot.name,
        totalCapacity: configuredSlots,
        configuredSlots,
        available,
        occupied,
        maintenance,
        unknown
      };
    }

    // Dự phòng khi chưa có cảm biến từng slot: Tính theo phiên đỗ xe thực tế đang diễn ra
    const activeSessionsCount = await prisma.parkingSession.count({
      where: {
        parkingLotId: id,
        status: { in: ['ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT'] }
      }
    });

    const available = Math.max(0, lot.totalCapacity - activeSessionsCount);

    return {
      parkingLotId: lot.id,
      parkingLotName: lot.name,
      totalCapacity: lot.totalCapacity,
      configuredSlots: 0,
      available,
      occupied: activeSessionsCount,
      maintenance: 0,
      unknown: 0
    };
  }
}

export const parkingLotService = new ParkingLotService();

