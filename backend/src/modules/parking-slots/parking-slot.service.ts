import { prisma } from '../../integrations/database/prisma.client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  CreateParkingSlotInput,
  UpdateParkingSlotInput,
  ListSlotsQuery
} from './parking-slot.validation';
import { ParkingSlot, SensorStatus } from '@prisma/client';

export class ParkingSlotService {
  /**
   * Danh sách vị trí đỗ của một bãi đỗ xe cụ thể
   */
  public async listSlotsByLot(lotId: string, query: ListSlotsQuery): Promise<ParkingSlot[]> {
    const lotExists = await prisma.parkingLot.findUnique({
      where: { id: lotId }
    });

    if (!lotExists) {
      throw AppError.notFound('Không tìm thấy bãi đỗ xe chỉ định', ErrorCodes.PARKING_LOT_NOT_FOUND);
    }

    const where = {
      parkingLotId: lotId,
      ...(query.operationalStatus ? { operationalStatus: query.operationalStatus } : {}),
      ...(query.sensorStatus ? { sensorStatus: query.sensorStatus } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {})
    };

    return prisma.parkingSlot.findMany({
      where,
      orderBy: { slotCode: 'asc' },
      include: {
        sensorDevice: {
          select: { id: true, deviceCode: true, status: true }
        }
      }
    });
  }

  /**
   * Lấy chi tiết thông tin một vị trí đỗ theo ID
   */
  public async getSlotById(id: string): Promise<ParkingSlot> {
    const slot = await prisma.parkingSlot.findUnique({
      where: { id },
      include: {
        parkingLot: {
          select: { id: true, name: true, location: true }
        },
        sensorDevice: {
          select: { id: true, deviceCode: true, deviceType: true, status: true }
        }
      }
    });

    if (!slot) {
      throw AppError.notFound('Không tìm thấy thông tin vị trí đỗ xe', ErrorCodes.PARKING_SLOT_NOT_FOUND);
    }

    return slot;
  }

  /**
   * Tạo mới một vị trí đỗ xe trong bãi
   */
  public async createSlot(lotId: string, input: CreateParkingSlotInput): Promise<ParkingSlot> {
    // 1. Kiểm tra sự tồn tại của bãi đỗ xe
    const lot = await prisma.parkingLot.findUnique({
      where: { id: lotId }
    });
    if (!lot) {
      throw AppError.notFound('Không tìm thấy bãi đỗ xe', ErrorCodes.PARKING_LOT_NOT_FOUND);
    }

    // 2. Kiểm tra tính duy nhất của slotCode trong bãi đỗ
    const existingCode = await prisma.parkingSlot.findUnique({
      where: {
        parkingLotId_slotCode: {
          parkingLotId: lotId,
          slotCode: input.slotCode
        }
      }
    });
    if (existingCode) {
      throw AppError.conflict(
        `Mã vị trí đỗ "${input.slotCode}" đã tồn tại trong bãi xe này`,
        ErrorCodes.PARKING_SLOT_CODE_EXISTS
      );
    }

    // 3. Kiểm tra tính hợp lệ của cảm biến nếu được gán
    if (input.sensorDeviceId && input.sensorChannel) {
      await this.validateSensorMapping(lotId, input.sensorDeviceId, input.sensorChannel);
    }

    return prisma.parkingSlot.create({
      data: {
        parkingLotId: lotId,
        slotCode: input.slotCode,
        sensorDeviceId: input.sensorDeviceId || null,
        sensorChannel: input.sensorChannel || null,
        operationalStatus: input.operationalStatus || 'AVAILABLE',
        sensorStatus: 'UNKNOWN',
        isActive: true
      },
      include: {
        sensorDevice: {
          select: { id: true, deviceCode: true, status: true }
        }
      }
    });
  }

  /**
   * Cập nhật thông số vị trí đỗ xe
   */
  public async updateSlot(id: string, input: UpdateParkingSlotInput): Promise<ParkingSlot> {
    const existing = await this.getSlotById(id);

    // 1. Nếu thay đổi slotCode, kiểm tra xung đột trong bãi
    if (input.slotCode && input.slotCode !== existing.slotCode) {
      const codeConflict = await prisma.parkingSlot.findUnique({
        where: {
          parkingLotId_slotCode: {
            parkingLotId: existing.parkingLotId,
            slotCode: input.slotCode
          }
        }
      });
      if (codeConflict && codeConflict.id !== id) {
        throw AppError.conflict(
          `Mã vị trí đỗ "${input.slotCode}" đã tồn tại trong bãi xe`,
          ErrorCodes.PARKING_SLOT_CODE_EXISTS
        );
      }
    }

    // 2. Xác định cấu hình cảm biến mới
    let targetDeviceId = existing.sensorDeviceId;
    let targetChannel = existing.sensorChannel;

    if (input.sensorDeviceId !== undefined) {
      targetDeviceId = input.sensorDeviceId;
    }
    if (input.sensorChannel !== undefined) {
      targetChannel = input.sensorChannel;
    }

    // Kiểm tra tính hợp lệ nếu có thay đổi ánh xạ cảm biến
    if (
      (targetDeviceId !== existing.sensorDeviceId || targetChannel !== existing.sensorChannel) &&
      targetDeviceId &&
      targetChannel
    ) {
      await this.validateSensorMapping(
        existing.parkingLotId,
        targetDeviceId,
        targetChannel,
        id
      );
    }

    return prisma.parkingSlot.update({
      where: { id },
      data: {
        ...(input.slotCode !== undefined ? { slotCode: input.slotCode } : {}),
        ...(input.sensorDeviceId !== undefined ? { sensorDeviceId: input.sensorDeviceId } : {}),
        ...(input.sensorChannel !== undefined ? { sensorChannel: input.sensorChannel } : {}),
        ...(input.operationalStatus !== undefined ? { operationalStatus: input.operationalStatus } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      },
      include: {
        sensorDevice: {
          select: { id: true, deviceCode: true, status: true }
        }
      }
    });
  }

  /**
   * Phương thức nội bộ: Cập nhật trạng thái cảm biến (phục vụ MQTT Broker xử lý ở pha tiếp theo)
   */
  public async updateSensorStatus(id: string, status: SensorStatus): Promise<ParkingSlot> {
    await this.getSlotById(id);

    return prisma.parkingSlot.update({
      where: { id },
      data: {
        sensorStatus: status,
        lastSensorUpdate: new Date()
      }
    });
  }

  /**
   * Hàm kiểm tra tính hợp lệ và không xung đột của ánh xạ cảm biến vật lý
   */
  private async validateSensorMapping(
    lotId: string,
    deviceId: string,
    channel: number,
    excludeSlotId?: string
  ): Promise<void> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      throw AppError.notFound('Thiết bị cảm biến không tồn tại', ErrorCodes.DEVICE_NOT_FOUND);
    }

    if (device.parkingLotId !== lotId) {
      throw AppError.badRequest(
        'Thiết bị cảm biến phải thuộc cùng bãi đỗ xe với vị trí đỗ',
        ErrorCodes.BAD_REQUEST
      );
    }

    const conflict = await prisma.parkingSlot.findUnique({
      where: {
        sensorDeviceId_sensorChannel: {
          sensorDeviceId: deviceId,
          sensorChannel: channel
        }
      }
    });

    if (conflict && conflict.id !== excludeSlotId) {
      throw AppError.conflict(
        `Cổng cảm biến số ${channel} trên thiết bị "${device.deviceCode}" đã được gán cho vị trí "${conflict.slotCode}"`,
        ErrorCodes.PARKING_SLOT_SENSOR_CONFLICT
      );
    }
  }
}

export const parkingSlotService = new ParkingSlotService();

