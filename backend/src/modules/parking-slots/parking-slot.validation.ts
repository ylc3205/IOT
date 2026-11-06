import { z } from 'zod';
import { SensorStatus, SlotOperationalStatus } from '@prisma/client';

export const createParkingSlotSchema = z
  .object({
    slotCode: z
      .string({ required_error: 'Mã vị trí đỗ không được để trống' })
      .min(1, 'Mã vị trí đỗ không được để trống')
      .trim()
      .toUpperCase(),
    sensorDeviceId: z.string().uuid('ID thiết bị cảm biến phải là UUID').optional().nullable(),
    sensorChannel: z.number().int().positive('Kênh cảm biến phải là số nguyên dương (> 0)').optional().nullable(),
    operationalStatus: z.nativeEnum(SlotOperationalStatus).optional()
  })
  .refine(
    (data) => {
      const hasDevice = data.sensorDeviceId !== null && data.sensorDeviceId !== undefined;
      const hasChannel = data.sensorChannel !== null && data.sensorChannel !== undefined;
      return (hasDevice && hasChannel) || (!hasDevice && !hasChannel);
    },
    {
      message: 'Thiết bị cảm biến (sensorDeviceId) và Kênh cảm biến (sensorChannel) phải cùng được cung cấp hoặc cùng để trống',
      path: ['sensorChannel']
    }
  );

export const updateParkingSlotSchema = z
  .object({
    slotCode: z.string().min(1).trim().toUpperCase().optional(),
    sensorDeviceId: z.string().uuid().optional().nullable(),
    sensorChannel: z.number().int().positive().optional().nullable(),
    operationalStatus: z.nativeEnum(SlotOperationalStatus).optional(),
    isActive: z.boolean().optional()
  })
  .refine(
    (data) => {
      const deviceProvided = data.sensorDeviceId !== undefined;
      const channelProvided = data.sensorChannel !== undefined;

      if (deviceProvided || channelProvided) {
        const hasDevice = data.sensorDeviceId !== null && data.sensorDeviceId !== undefined;
        const hasChannel = data.sensorChannel !== null && data.sensorChannel !== undefined;
        return (hasDevice && hasChannel) || (!hasDevice && !hasChannel);
      }
      return true;
    },
    {
      message: 'Thiết bị cảm biến và Kênh cảm biến phải cùng được gán hoặc cùng xóa (null)',
      path: ['sensorChannel']
    }
  );

export const parkingLotSlotParamsSchema = z.object({
  lotId: z.string().uuid('ID bãi đỗ xe phải là UUID hợp lệ')
});

export const parkingSlotParamsSchema = z.object({
  id: z.string().uuid('ID vị trí đỗ phải là UUID hợp lệ')
});

export const listSlotsQuerySchema = z.object({
  operationalStatus: z.nativeEnum(SlotOperationalStatus).optional(),
  sensorStatus: z.nativeEnum(SensorStatus).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? val === 'true' : undefined))
});

export type CreateParkingSlotInput = z.infer<typeof createParkingSlotSchema>;
export type UpdateParkingSlotInput = z.infer<typeof updateParkingSlotSchema>;
export type ListSlotsQuery = z.infer<typeof listSlotsQuerySchema>;

