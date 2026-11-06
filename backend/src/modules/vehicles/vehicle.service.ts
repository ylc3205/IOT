import { prisma } from '../../integrations/database/prisma.client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { normalizeLicensePlate } from '../../common/utils/normalizers';
import {
  CreateVehicleInput,
  UpdateVehicleInput,
  ListVehiclesQuery
} from './vehicle.validation';
import { buildPaginatedResult, PaginatedResult } from '../../common/utils/pagination';
import { Vehicle } from '@prisma/client';

export class VehicleService {
  /**
   * Danh sách phương tiện có phân trang, tìm kiếm và lọc theo loại xe
   */
  public async listVehicles(query: ListVehiclesQuery): Promise<PaginatedResult<Vehicle>> {
    const { page, limit, vehicleType, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      const normalizedSearch = normalizeLicensePlate(search);
      where.licensePlate = {
        contains: normalizedSearch || search.trim()
      };
    }

    const [items, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rfidCards: {
            select: { id: true, uid: true, status: true }
          }
        }
      }),
      prisma.vehicle.count({ where })
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  /**
   * Xem chi tiết thông tin phương tiện và thẻ RFID liên kết
   */
  public async getVehicleById(id: string): Promise<Vehicle> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        rfidCards: {
          select: {
            id: true,
            uid: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        },
        _count: {
          select: { parkingSessions: true }
        }
      }
    });

    if (!vehicle) {
      throw AppError.notFound('Không tìm thấy thông tin phương tiện', ErrorCodes.VEHICLE_NOT_FOUND);
    }

    return vehicle;
  }

  /**
   * Đăng ký phương tiện mới vào hệ thống
   */
  public async createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
    const normalizedPlate = normalizeLicensePlate(input.licensePlate);

    if (!normalizedPlate) {
      throw AppError.badRequest('Biển số xe không hợp lệ sau khi chuẩn hóa', ErrorCodes.BAD_REQUEST);
    }

    const existing = await prisma.vehicle.findUnique({
      where: { licensePlate: normalizedPlate }
    });

    if (existing) {
      throw AppError.conflict(
        `Biển số xe "${normalizedPlate}" đã tồn tại trong hệ thống`,
        ErrorCodes.VEHICLE_LICENSE_PLATE_EXISTS
      );
    }

    return prisma.vehicle.create({
      data: {
        licensePlate: normalizedPlate,
        vehicleType: input.vehicleType,
        isActive: true
      }
    });
  }

  /**
   * Cập nhật thông tin phương tiện
   */
  public async updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    await this.getVehicleById(id);

    let normalizedPlate: string | undefined;

    if (input.licensePlate) {
      normalizedPlate = normalizeLicensePlate(input.licensePlate);
      if (!normalizedPlate) {
        throw AppError.badRequest('Biển số xe không hợp lệ', ErrorCodes.BAD_REQUEST);
      }

      const existing = await prisma.vehicle.findUnique({
        where: { licensePlate: normalizedPlate }
      });

      if (existing && existing.id !== id) {
        throw AppError.conflict(
          `Biển số xe "${normalizedPlate}" đã thuộc về phương tiện khác`,
          ErrorCodes.VEHICLE_LICENSE_PLATE_EXISTS
        );
      }
    }

    return prisma.vehicle.update({
      where: { id },
      data: {
        ...(normalizedPlate ? { licensePlate: normalizedPlate } : {}),
        ...(input.vehicleType ? { vehicleType: input.vehicleType } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });
  }
}

export const vehicleService = new VehicleService();

