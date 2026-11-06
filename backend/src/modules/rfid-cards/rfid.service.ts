import { prisma } from '../../integrations/database/prisma.client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { normalizeRfidUid } from '../../common/utils/normalizers';
import {
  CreateRfidCardInput,
  UpdateRfidCardInput,
  AssignRfidCardInput,
  ListRfidCardsQuery
} from './rfid.validation';
import { buildPaginatedResult, PaginatedResult } from '../../common/utils/pagination';
import { RFIDCard, RfidCardStatus } from '@prisma/client';

export class RfidService {
  /**
   * Danh sách thẻ RFID có phân trang, tìm kiếm và lọc trạng thái
   */
  public async listCards(query: ListRfidCardsQuery): Promise<PaginatedResult<RFIDCard>> {
    const { page, limit, status, isAssigned, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (isAssigned !== undefined) {
      where.vehicleId = isAssigned ? { not: null } : null;
    }

    if (search) {
      const normalized = normalizeRfidUid(search);
      where.uid = {
        contains: normalized || search.trim()
      };
    }

    const [items, total] = await Promise.all([
      prisma.rFIDCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: {
            select: { id: true, licensePlate: true, vehicleType: true, isActive: true }
          }
        }
      }),
      prisma.rFIDCard.count({ where })
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  /**
   * Lấy chi tiết thẻ RFID theo ID
   */
  public async getCardById(id: string): Promise<RFIDCard> {
    const card = await prisma.rFIDCard.findUnique({
      where: { id },
      include: {
        vehicle: true,
        _count: {
          select: { parkingSessions: true }
        }
      }
    });

    if (!card) {
      throw AppError.notFound('Không tìm thấy thông tin thẻ RFID', ErrorCodes.RFID_NOT_FOUND);
    }

    return card;
  }

  /**
   * Tạo mới thẻ RFID vào kho quản lý
   */
  public async createCard(input: CreateRfidCardInput): Promise<RFIDCard> {
    const normalizedUid = normalizeRfidUid(input.uid);

    if (!normalizedUid) {
      throw AppError.badRequest('Mã UID không hợp lệ sau khi chuẩn hóa', ErrorCodes.BAD_REQUEST);
    }

    const existing = await prisma.rFIDCard.findUnique({
      where: { uid: normalizedUid }
    });

    if (existing) {
      throw AppError.conflict(
        `Thẻ RFID với mã UID "${normalizedUid}" đã tồn tại trong hệ thống`,
        ErrorCodes.RFID_UID_EXISTS
      );
    }

    if (input.vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: input.vehicleId }
      });
      if (!vehicle) {
        throw AppError.notFound('Phương tiện chỉ định không tồn tại', ErrorCodes.VEHICLE_NOT_FOUND);
      }
      if (!vehicle.isActive) {
        throw AppError.badRequest('Không thể gán thẻ cho phương tiện đã bị tạm khóa', ErrorCodes.BAD_REQUEST);
      }
    }

    return prisma.rFIDCard.create({
      data: {
        uid: normalizedUid,
        vehicleId: input.vehicleId || null,
        status: input.status || RfidCardStatus.ACTIVE
      },
      include: {
        vehicle: true
      }
    });
  }

  /**
   * Cập nhật thông tin cơ bản của thẻ
   */
  public async updateCard(id: string, input: UpdateRfidCardInput): Promise<RFIDCard> {
    await this.getCardById(id);

    let normalizedUid: string | undefined;

    if (input.uid) {
      normalizedUid = normalizeRfidUid(input.uid);
      const existing = await prisma.rFIDCard.findUnique({
        where: { uid: normalizedUid }
      });
      if (existing && existing.id !== id) {
        throw AppError.conflict(
          `Mã UID "${normalizedUid}" đã thuộc về thẻ khác`,
          ErrorCodes.RFID_UID_EXISTS
        );
      }
    }

    return prisma.rFIDCard.update({
      where: { id },
      data: {
        ...(normalizedUid ? { uid: normalizedUid } : {}),
        ...(input.status ? { status: input.status } : {})
      },
      include: {
        vehicle: true
      }
    });
  }

  /**
   * Gán thẻ RFID cho phương tiện cụ thể (Fixed RFID Model)
   */
  public async assignCard(id: string, input: AssignRfidCardInput): Promise<RFIDCard> {
    const card = await this.getCardById(id);

    if (card.status === RfidCardStatus.BLOCKED) {
      throw AppError.badRequest('Thẻ RFID đang bị khóa, không thể gán xe', ErrorCodes.RFID_CARD_BLOCKED);
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId }
    });

    if (!vehicle) {
      throw AppError.notFound('Phương tiện chỉ định không tồn tại', ErrorCodes.VEHICLE_NOT_FOUND);
    }

    if (!vehicle.isActive) {
      throw AppError.badRequest('Không thể gán thẻ cho phương tiện đã tạm ngừng hoạt động', ErrorCodes.BAD_REQUEST);
    }

    // Kiểm tra an toàn: Không cho phép đổi xe khi thẻ đang trong phiên gửi xe dở dang
    const activeSessionWithCard = await prisma.parkingSession.findFirst({
      where: {
        rfidCardId: id,
        status: { in: ['ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT'] }
      }
    });

    if (activeSessionWithCard) {
      throw AppError.badRequest(
        'Không thể thay đổi phương tiện khi thẻ RFID đang trong phiên gửi xe chưa hoàn tất',
        ErrorCodes.RFID_ACTIVE_SESSION_EXISTS
      );
    }

    // Kiểm tra phương tiện có đang trong phiên gửi xe với thẻ khác không
    const activeSessionWithVehicle = await prisma.parkingSession.findFirst({
      where: {
        vehicleId: input.vehicleId,
        status: { in: ['ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT'] }
      }
    });

    if (activeSessionWithVehicle && activeSessionWithVehicle.rfidCardId !== id) {
      throw AppError.badRequest(
        'Phương tiện này đang trong một phiên gửi xe với thẻ khác',
        ErrorCodes.CONFLICT
      );
    }

    return prisma.rFIDCard.update({
      where: { id },
      data: { vehicleId: input.vehicleId },
      include: { vehicle: true }
    });
  }

  /**
   * Hủy gán thẻ (chuyển thẻ về thẻ vãng lai / chưa gán xe)
   */
  public async unassignCard(id: string): Promise<RFIDCard> {
    await this.getCardById(id);

    // Kiểm tra phiên gửi xe dở dang
    const activeSession = await prisma.parkingSession.findFirst({
      where: {
        rfidCardId: id,
        status: { in: ['ACTIVE', 'PENDING_ENTRY', 'PENDING_EXIT'] }
      }
    });

    if (activeSession) {
      throw AppError.badRequest(
        'Không thể hủy gán phương tiện khi thẻ đang trong phiên gửi xe chưa hoàn tất',
        ErrorCodes.RFID_ACTIVE_SESSION_EXISTS
      );
    }

    return prisma.rFIDCard.update({
      where: { id },
      data: { vehicleId: null },
      include: { vehicle: true }
    });
  }

  /**
   * Khóa thẻ RFID khẩn cấp (chặn quét barrier)
   */
  public async blockCard(id: string): Promise<RFIDCard> {
    await this.getCardById(id);

    return prisma.rFIDCard.update({
      where: { id },
      data: { status: RfidCardStatus.BLOCKED },
      include: { vehicle: true }
    });
  }

  /**
   * Mở khóa kích hoạt lại thẻ RFID
   */
  public async unblockCard(id: string): Promise<RFIDCard> {
    await this.getCardById(id);

    return prisma.rFIDCard.update({
      where: { id },
      data: { status: RfidCardStatus.ACTIVE },
      include: { vehicle: true }
    });
  }
}

export const rfidService = new RfidService();

