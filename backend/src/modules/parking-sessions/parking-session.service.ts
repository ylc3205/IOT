import {
  ParkingSession,
  ParkingSessionStatus,
  PaymentStatus,
  PricingType,
  Prisma,
  RfidCardStatus
} from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { normalizeLicensePlate, normalizeRfidUid } from '../../common/utils/normalizers';
import { buildPaginatedResult, PaginatedResult } from '../../common/utils/pagination';
import { prisma } from '../../integrations/database/prisma.client';
import { BillingCalculator } from '../billing/billing.calculator';
import { AdmissionService } from './admission.service';
import {
  CancelEntryInput,
  ConfirmPaymentInput,
  ListSessionsQuery,
  ManualEntryInput,
  ManualExitInput
} from './parking-session.types';

export class ParkingSessionService {
  /**
   * Danh sách phiên gửi xe có phân trang, bộ lọc và tìm kiếm nâng cao
   */
  public async listSessions(query: ListSessionsQuery): Promise<PaginatedResult<ParkingSession>> {
    const {
      page = 1,
      limit = 20,
      status,
      parkingLotId,
      vehicleType,
      paymentStatus,
      search,
      startDate,
      endDate
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.ParkingSessionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (parkingLotId) {
      where.parkingLotId = parkingLotId;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (vehicleType) {
      where.vehicle = { vehicleType };
    }

    if (startDate || endDate) {
      where.entryTime = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {})
      };
    }

    if (search) {
      const normalized = normalizeLicensePlate(search);
      where.OR = [
        { vehicle: { licensePlate: { contains: normalized || search.trim() } } },
        { rfidCard: { uid: { contains: normalizeRfidUid(search) || search.trim() } } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.parkingSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryTime: 'desc' },
        include: {
          parkingLot: { select: { id: true, name: true, location: true } },
          vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
          rfidCard: { select: { id: true, uid: true, status: true } },
          payments: {
            orderBy: { paymentTime: 'asc' },
            include: { operator: { select: { id: true, fullName: true, email: true } } }
          },
          manualEntryOperator: { select: { id: true, fullName: true } },
          manualExitOperator: { select: { id: true, fullName: true } },
          paymentOperator: { select: { id: true, fullName: true } }
        }
      }),
      prisma.parkingSession.count({ where })
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  /**
   * Lấy nhanh danh sách các phiên xe đang đỗ trong bãi (ACTIVE)
   */
  public async getActiveSessions(parkingLotId?: string): Promise<ParkingSession[]> {
    return prisma.parkingSession.findMany({
      where: {
        status: ParkingSessionStatus.ACTIVE,
        ...(parkingLotId ? { parkingLotId } : {})
      },
      orderBy: { entryTime: 'desc' },
      include: {
        parkingLot: { select: { id: true, name: true } },
        vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
        rfidCard: { select: { id: true, uid: true } }
      }
    });
  }

  /**
   * Lấy chi tiết thông tin một phiên gửi xe theo ID
   */
  public async getSessionById(id: string): Promise<ParkingSession> {
    const session = await prisma.parkingSession.findUnique({
      where: { id },
      include: {
        parkingLot: { select: { id: true, name: true, location: true, totalCapacity: true } },
        vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
        rfidCard: { select: { id: true, uid: true, status: true } },
        payments: {
          orderBy: { paymentTime: 'asc' },
          include: { operator: { select: { id: true, fullName: true, email: true } } }
        },
        manualEntryOperator: { select: { id: true, fullName: true } },
        manualExitOperator: { select: { id: true, fullName: true } },
        paymentOperator: { select: { id: true, fullName: true } }
      }
    });

    if (!session) {
      throw AppError.notFound('Không tìm thấy phiên gửi xe', ErrorCodes.SESSION_NOT_FOUND);
    }

    return session;
  }

  /**
   * Yêu cầu vào bãi tự động qua quét thẻ RFID tại cổng vào (requestEntry)
   * Sử dụng bởi MQTT Worker ở Pha 4 hoặc giả lập tự động.
   */
  public async requestEntry(input: {
    parkingLotId: string;
    cardUid: string;
    deviceId?: string;
  }): Promise<ParkingSession> {
    const normalizedUid = normalizeRfidUid(input.cardUid);

    // 1. Kiểm tra thẻ tồn tại và trạng thái
    const card = await prisma.rFIDCard.findUnique({
      where: { uid: normalizedUid },
      include: { vehicle: true }
    });

    if (!card) {
      throw AppError.notFound('Thẻ RFID chưa được đăng ký trong hệ thống', ErrorCodes.RFID_NOT_FOUND);
    }

    if (card.status !== RfidCardStatus.ACTIVE) {
      throw AppError.badRequest(
        `Thẻ RFID đang ở trạng thái "${card.status}", không thể sử dụng để vào bãi`,
        ErrorCodes.RFID_CARD_BLOCKED
      );
    }

    if (!card.vehicleId || !card.vehicle) {
      throw AppError.badRequest(
        'Thẻ vãng lai chưa được gán xe cố định, vui lòng sử dụng chức năng Vào Thủ Công để khai báo biển số',
        ErrorCodes.BAD_REQUEST
      );
    }

    const vehicle = card.vehicle;
    if (!vehicle.isActive) {
      throw AppError.badRequest('Phương tiện này đang bị tạm khóa', ErrorCodes.BAD_REQUEST);
    }

    // 2. Giao dịch tiếp nhận an toàn bảo thủ
    return prisma.$transaction(async (tx) => {
      // Sức chứa bảo thủ với khóa hàng FOR UPDATE
      await AdmissionService.executeConservativeAdmission(tx, input.parkingLotId);

      // Kiểm tra xe và thẻ không có phiên chưa hoàn tất
      const existingSession = await tx.parkingSession.findFirst({
        where: {
          OR: [{ vehicleId: vehicle.id }, { rfidCardId: card.id }],
          status: { in: [ParkingSessionStatus.PENDING_ENTRY, ParkingSessionStatus.ACTIVE, ParkingSessionStatus.PENDING_EXIT] }
        }
      });

      if (existingSession) {
        throw AppError.conflict(
          'Phương tiện hoặc thẻ RFID này đang có một phiên gửi xe chưa hoàn tất',
          ErrorCodes.ACTIVE_SESSION_EXISTS
        );
      }

      // Snapshot biểu giá
      const snapshot = await BillingCalculator.resolvePricingSnapshot(
        input.parkingLotId,
        vehicle.vehicleType,
        undefined,
        tx as any
      );

      return tx.parkingSession.create({
        data: {
          parkingLotId: input.parkingLotId,
          vehicleId: vehicle.id,
          rfidCardId: card.id,
          status: ParkingSessionStatus.PENDING_ENTRY,
          entryTime: new Date(),
          pricingRuleId: snapshot.pricingRuleId,
          pricingType: snapshot.pricingType,
          pricingRate: snapshot.pricingRate,
          totalFee: new Prisma.Decimal(0),
          paidAmount: new Prisma.Decimal(0),
          paymentStatus: PaymentStatus.UNPAID
        },
        include: {
          parkingLot: { select: { id: true, name: true } },
          vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
          rfidCard: { select: { id: true, uid: true } }
        }
      });
    });
  }

  /**
   * Xác nhận xe đã qua barrier vào bãi an toàn (confirmEntryPassage)
   * Sử dụng khóa dòng FOR UPDATE để giải quyết nguyên tử tranh chấp với Entry Timeout.
   */
  public async confirmEntryPassage(sessionId: string): Promise<ParkingSession> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM parking_sessions WHERE id = ${sessionId} FOR UPDATE`;

      const session = await tx.parkingSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw AppError.notFound('Không tìm thấy phiên gửi xe', ErrorCodes.SESSION_NOT_FOUND);
      }

      // Idempotent: Nếu đã là ACTIVE, trả về kết quả thành công mà không báo lỗi
      if (session.status === ParkingSessionStatus.ACTIVE) {
        return session;
      }

      if (session.status === ParkingSessionStatus.CANCELLED) {
        throw AppError.badRequest(
          'Phiên chờ vào đã bị hủy hoặc hết hạn chờ (Timeout)',
          ErrorCodes.SESSION_ALREADY_CANCELLED
        );
      }

      if (session.status !== ParkingSessionStatus.PENDING_ENTRY) {
        throw AppError.badRequest(
          `Không thể xác nhận qua cổng cho phiên ở trạng thái "${session.status}"`,
          ErrorCodes.INVALID_SESSION_STATE_TRANSITION
        );
      }

      return tx.parkingSession.update({
        where: { id: sessionId },
        data: { status: ParkingSessionStatus.ACTIVE },
        include: {
          parkingLot: { select: { id: true, name: true } },
          vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
          rfidCard: { select: { id: true, uid: true } }
        }
      });
    });
  }

  /**
   * Tác vụ nội bộ quét hủy phiên chờ vào quá hạn (cancelExpiredEntrySession)
   * Đồng bộ nguyên tử với confirmEntryPassage bằng khóa dòng FOR UPDATE.
   */
  public async cancelExpiredEntrySession(
    sessionId: string,
    reason = 'ENTRY_TIMEOUT_EXPIRED'
  ): Promise<ParkingSession | null> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM parking_sessions WHERE id = ${sessionId} FOR UPDATE`;

      const session = await tx.parkingSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) return null;

      // Nếu xe đã qua barrier chuyển sang ACTIVE, tuyệt đối không hủy
      if (session.status === ParkingSessionStatus.ACTIVE) {
        return null;
      }

      if (session.status !== ParkingSessionStatus.PENDING_ENTRY) {
        return null;
      }

      return tx.parkingSession.update({
        where: { id: sessionId },
        data: {
          status: ParkingSessionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason
        }
      });
    });
  }

  /**
   * Nhân viên trực cổng bấm hủy phiên chờ vào (cancelEntry)
   */
  public async cancelEntry(
    sessionId: string,
    input: CancelEntryInput
  ): Promise<ParkingSession> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM parking_sessions WHERE id = ${sessionId} FOR UPDATE`;

      const session = await tx.parkingSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw AppError.notFound('Không tìm thấy phiên gửi xe', ErrorCodes.SESSION_NOT_FOUND);
      }

      if (session.status !== ParkingSessionStatus.PENDING_ENTRY) {
        throw AppError.badRequest(
          'Chỉ có thể hủy phiên đang ở trạng thái PENDING_ENTRY',
          ErrorCodes.CANNOT_CANCEL_NON_PENDING_SESSION
        );
      }

      return tx.parkingSession.update({
        where: { id: sessionId },
        data: {
          status: ParkingSessionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: input.cancelReason
        }
      });
    });
  }

  /**
   * Vào bãi thủ công qua giao diện CMS (manualEntry)
   * Tạo trực tiếp phiên ACTIVE kèm đầy đủ vết kiểm toán. Tuyệt đối không điều khiển Servo.
   */
  public async manualEntry(
    operatorId: string,
    input: ManualEntryInput
  ): Promise<ParkingSession> {
    const normalizedPlate = normalizeLicensePlate(input.licensePlate);
    if (!normalizedPlate) {
      throw AppError.badRequest('Biển số xe không hợp lệ', ErrorCodes.BAD_REQUEST);
    }

    if (!input.manualEntryReason || input.manualEntryReason.trim().length < 5) {
      throw AppError.badRequest(
        'Lý do vào thủ công bắt buộc phải có ít nhất 5 ký tự',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // 1. Tìm hoặc tạo phương tiện
    let vehicle = await prisma.vehicle.findUnique({
      where: { licensePlate: normalizedPlate }
    });

    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          licensePlate: normalizedPlate,
          vehicleType: input.vehicleType,
          isActive: true
        }
      });
    }

    // 2. Tìm hoặc gán thẻ RFID
    let rfidCardId: string;
    if (input.rfidCardUid) {
      const normalizedUid = normalizeRfidUid(input.rfidCardUid);
      let card = await prisma.rFIDCard.findUnique({ where: { uid: normalizedUid } });
      if (!card) {
        // Tự động tạo thẻ vãng lai mới nếu chưa có trong kho (bảo vệ xung đột đồng thời)
        try {
          card = await prisma.rFIDCard.create({
            data: { uid: normalizedUid, status: RfidCardStatus.ACTIVE }
          });
        } catch (err: any) {
          if (err.code === 'P2002') {
            card = await prisma.rFIDCard.findUnique({ where: { uid: normalizedUid } });
          } else {
            throw err;
          }
        }
      }
      if (!card || card.status !== RfidCardStatus.ACTIVE) {
        throw AppError.badRequest(
          `Thẻ RFID "${normalizedUid}" đang bị khóa (${card?.status}), không thể sử dụng`,
          ErrorCodes.RFID_CARD_BLOCKED
        );
      }
      rfidCardId = card.id;
    } else {
      // Khi vào thủ công không quét thẻ, tự động cấp thẻ vãng lai placeholder định danh duy nhất
      const placeholderCard = await prisma.rFIDCard.create({
        data: {
          uid: `MAN_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          status: RfidCardStatus.ACTIVE
        }
      });
      rfidCardId = placeholderCard.id;
    }

    // 3. Thực thi giao dịch tiếp nhận đơn nhất có khóa hàng bi quan
    return prisma.$transaction(async (tx) => {
      await AdmissionService.executeConservativeAdmission(tx, input.parkingLotId);

      // Kiểm tra xe và thẻ không có phiên đang chạy
      const activeSession = await tx.parkingSession.findFirst({
        where: {
          OR: [{ vehicleId: vehicle.id }, { rfidCardId }],
          status: { in: [ParkingSessionStatus.PENDING_ENTRY, ParkingSessionStatus.ACTIVE, ParkingSessionStatus.PENDING_EXIT] }
        }
      });

      if (activeSession) {
        throw AppError.conflict(
          'Phương tiện hoặc thẻ RFID này đang có một phiên gửi xe chưa hoàn tất',
          ErrorCodes.ACTIVE_SESSION_EXISTS
        );
      }

      // Snapshot biểu giá
      const snapshot = await BillingCalculator.resolvePricingSnapshot(
        input.parkingLotId,
        input.vehicleType,
        input.preferredPricingType,
        tx as any
      );

      return tx.parkingSession.create({
        data: {
          parkingLotId: input.parkingLotId,
          vehicleId: vehicle.id,
          rfidCardId,
          status: ParkingSessionStatus.ACTIVE,
          entryTime: new Date(),
          pricingRuleId: snapshot.pricingRuleId,
          pricingType: snapshot.pricingType,
          pricingRate: snapshot.pricingRate,
          totalFee: new Prisma.Decimal(0),
          paidAmount: new Prisma.Decimal(0),
          paymentStatus: PaymentStatus.UNPAID,
          isManualEntry: true,
          manualEntryReason: input.manualEntryReason.trim(),
          manualEntryOperatorId: operatorId
        },
        include: {
          parkingLot: { select: { id: true, name: true } },
          vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
          rfidCard: { select: { id: true, uid: true } },
          manualEntryOperator: { select: { id: true, fullName: true } }
        }
      });
    });
  }

  /**
   * Tính toán trước hoặc chốt cước phí gửi xe (calculateFee)
   */
  public async calculateFee(
    sessionId: string,
    lockCutoff = false
  ): Promise<{ session: ParkingSession; feeResult: ReturnType<typeof BillingCalculator.calculateParkingFee> }> {
    const session = await this.getSessionById(sessionId);

    if (
      session.status === ParkingSessionStatus.COMPLETED ||
      session.status === ParkingSessionStatus.CANCELLED
    ) {
      throw AppError.badRequest(
        'Không thể tính phí cho phiên gửi xe đã hoàn thành hoặc đã bị hủy',
        ErrorCodes.INVALID_SESSION_STATE_TRANSITION
      );
    }

    if (!session.pricingType || !session.pricingRate) {
      throw AppError.badRequest('Phiên gửi xe thiếu thông tin snapshot biểu giá', ErrorCodes.BAD_REQUEST);
    }

    const cutoffTime = new Date();
    const feeResult = BillingCalculator.calculateParkingFee({
      entryTime: session.entryTime,
      cutoffTime,
      pricingType: session.pricingType,
      rate: session.pricingRate,
      paidAmount: session.paidAmount,
      lastPaymentTime: session.paymentTime
    });

    if (lockCutoff) {
      const updated = await prisma.parkingSession.update({
        where: { id: sessionId },
        data: {
          status: ParkingSessionStatus.PENDING_EXIT,
          billingCutoffTime: cutoffTime,
          durationMinutes: feeResult.durationMinutes,
          billableHours: feeResult.billableHours,
          totalFee: feeResult.totalFee
        },
        include: {
          parkingLot: { select: { id: true, name: true } },
          vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
          rfidCard: { select: { id: true, uid: true } },
          payments: true
        }
      });

      return { session: updated, feeResult };
    }

    return { session, feeResult };
  }

  /**
   * Xác nhận thu tiền mặt tại quầy (confirmPayment)
   * Hỗ trợ thanh toán nhiều đợt và phụ thu quá giờ, bảo toàn lịch sử không thu trùng tiền.
   */
  public async confirmPayment(
    operatorId: string,
    sessionId: string,
    input: ConfirmPaymentInput
  ): Promise<{ session: ParkingSession; paymentRecord: any }> {
    const inputAmount = new Prisma.Decimal(input.amount);
    if (inputAmount.lessThanOrEqualTo(0)) {
      throw AppError.badRequest('Số tiền thu phải lớn hơn 0', ErrorCodes.VALIDATION_ERROR);
    }

    return prisma.$transaction(async (tx) => {
      // Khóa dòng phiên để bảo đảm giao dịch tài chính nguyên tử
      await tx.$queryRaw`SELECT id FROM parking_sessions WHERE id = ${sessionId} FOR UPDATE`;

      const session = await tx.parkingSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw AppError.notFound('Không tìm thấy phiên gửi xe', ErrorCodes.SESSION_NOT_FOUND);
      }

      if (
        session.status === ParkingSessionStatus.COMPLETED ||
        session.status === ParkingSessionStatus.CANCELLED
      ) {
        throw AppError.badRequest(
          'Không thể thu tiền cho phiên đã kết thúc hoặc đã bị hủy',
          ErrorCodes.INVALID_SESSION_STATE_TRANSITION
        );
      }

      // Tính số tiền còn thiếu
      const amountDue = session.totalFee.greaterThan(session.paidAmount)
        ? session.totalFee.sub(session.paidAmount)
        : new Prisma.Decimal(0);

      // Idempotency: Nếu đã thanh toán đủ và không còn thiếu tiền
      if (amountDue.equals(0) && session.paymentStatus === PaymentStatus.PAID) {
        return {
          session,
          paymentRecord: {
            id: 'IDEMPOTENT_ALREADY_PAID',
            amount: new Prisma.Decimal(0),
            note: 'Session is already fully settled'
          }
        };
      }

      // Xác minh số tiền khớp với khoản nợ
      if (!inputAmount.equals(amountDue)) {
        throw AppError.badRequest(
          `Số tiền thu (${inputAmount.toString()}) không khớp với số tiền còn thiếu (${amountDue.toString()})`,
          ErrorCodes.PAYMENT_AMOUNT_MISMATCH
        );
      }

      const newPaidAmount = session.paidAmount.add(inputAmount);
      const isFullySettled = newPaidAmount.greaterThanOrEqualTo(session.totalFee);

      // 1. Ghi bản ghi thanh toán mới
      const paymentRecord = await tx.parkingSessionPayment.create({
        data: {
          sessionId,
          amount: inputAmount,
          operatorId,
          paymentType: 'CASH',
          note: input.note || (session.paidAmount.equals(0) ? 'INITIAL_PAYMENT' : 'OVERTIME_SURCHARGE')
        }
      });

      // 2. Cập nhật trạng thái thanh toán trên phiên
      const updatedSession = await tx.parkingSession.update({
        where: { id: sessionId },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus: isFullySettled ? PaymentStatus.PAID : PaymentStatus.UNPAID,
          paymentTime: new Date(),
          paymentOperatorId: operatorId
        },
        include: {
          parkingLot: { select: { id: true, name: true } },
          vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
          rfidCard: { select: { id: true, uid: true } },
          payments: { orderBy: { paymentTime: 'asc' } }
        }
      });

      return { session: updatedSession, paymentRecord };
    });
  }

  /**
   * Ra bãi thủ công qua giao diện CMS (manualExit)
   * Cho phép gọi từ ACTIVE hoặc PENDING_EXIT.
   * Cấm gọi từ PENDING_ENTRY, COMPLETED, CANCELLED.
   * Tuyệt đối không gửi bản tin GATE_COMMAND qua MQTT.
   */
  public async manualExit(
    operatorId: string,
    sessionId: string,
    input: ManualExitInput
  ): Promise<ParkingSession> {
    if (!input.manualExitReason || input.manualExitReason.trim().length < 5) {
      throw AppError.badRequest(
        'Lý do ra thủ công bắt buộc phải có ít nhất 5 ký tự',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!input.vehicleDepartedConfirmed) {
      throw AppError.badRequest(
        'Bắt buộc phải có xác nhận phương tiện đã thực tế rời bãi an toàn',
        ErrorCodes.VEHICLE_DEPARTURE_NOT_CONFIRMED
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM parking_sessions WHERE id = ${sessionId} FOR UPDATE`;

      const session = await tx.parkingSession.findUnique({
        where: { id: sessionId },
        include: { rfidCard: true }
      });

      if (!session) {
        throw AppError.notFound('Không tìm thấy phiên gửi xe', ErrorCodes.SESSION_NOT_FOUND);
      }

      // RÀNG BUỘC CHUYỂN DỊCH: Chỉ cho phép từ ACTIVE hoặc PENDING_EXIT
      if (
        session.status !== ParkingSessionStatus.ACTIVE &&
        session.status !== ParkingSessionStatus.PENDING_EXIT
      ) {
        throw AppError.badRequest(
          `Không thể thực hiện ra thủ công cho phiên ở trạng thái "${session.status}". Chỉ cho phép từ ACTIVE hoặc PENDING_EXIT.`,
          ErrorCodes.INVALID_SESSION_STATE_TRANSITION
        );
      }

      const now = new Date();

      // Nếu phiên đang ở ACTIVE mà chưa chốt cước, tính cước ngay tại thời điểm ra
      let currentTotalFee = session.totalFee;
      let durationMinutes = session.durationMinutes;
      let billableHours = session.billableHours;

      if (!session.billingCutoffTime && session.pricingType && session.pricingRate) {
        const feeRes = BillingCalculator.calculateParkingFee({
          entryTime: session.entryTime,
          cutoffTime: now,
          pricingType: session.pricingType,
          rate: session.pricingRate,
          paidAmount: session.paidAmount,
          lastPaymentTime: session.paymentTime
        });

        currentTotalFee = feeRes.totalFee;
        durationMinutes = feeRes.durationMinutes;
        billableHours = feeRes.billableHours;
      } else if (session.paymentTime && session.pricingType === PricingType.PER_HOUR && session.pricingRate) {
        // Kiểm tra quá hạn ân hạn rời bãi (Grace Period)
        const feeRes = BillingCalculator.calculateParkingFee({
          entryTime: session.entryTime,
          cutoffTime: now,
          pricingType: session.pricingType,
          rate: session.pricingRate,
          paidAmount: session.paidAmount,
          lastPaymentTime: session.paymentTime
        });

        if (feeRes.isOvertimeSurchargeRequired) {
          // Cập nhật tăng cước và chuyển paymentStatus sang UNPAID bằng tx
          await tx.parkingSession.update({
            where: { id: sessionId },
            data: {
              totalFee: feeRes.totalFee,
              durationMinutes: feeRes.durationMinutes,
              billableHours: feeRes.billableHours,
              paymentStatus: PaymentStatus.UNPAID
            }
          });

          return {
            overtimeSurcharge: {
              feeRes,
              sessionPaidAmount: session.paidAmount
            }
          };
        }
      }

      // Kiểm tra nghĩa vụ tài chính
      const amountDue = currentTotalFee.greaterThan(session.paidAmount)
        ? currentTotalFee.sub(session.paidAmount)
        : new Prisma.Decimal(0);

      if (amountDue.greaterThan(0) && session.paymentStatus !== PaymentStatus.EXEMPT) {
        throw AppError.badRequest(
          `Phiên gửi xe chưa thanh toán đủ cước phí. Còn thiếu: ${amountDue.toString()} VND`,
          ErrorCodes.PAYMENT_REQUIRED,
          { amountDue: amountDue.toString(), totalFee: currentTotalFee.toString(), paidAmount: session.paidAmount.toString() }
        );
      }

      // Cập nhật trạng thái thẻ nếu bị báo mất (không thu phạt trong Phase 3)
      if (input.markCardAsLost && session.rfidCardId) {
        await tx.rFIDCard.update({
          where: { id: session.rfidCardId },
          data: { status: RfidCardStatus.LOST }
        });
      }

      // Hoàn thành phiên đỗ an toàn
      const completedSession = await tx.parkingSession.update({
        where: { id: sessionId },
        data: {
          status: ParkingSessionStatus.COMPLETED,
          exitTime: now,
          totalFee: currentTotalFee,
          durationMinutes,
          billableHours,
          isManualExit: true,
          manualExitOperatorId: operatorId,
          manualExitReason: input.manualExitReason.trim()
        },
        include: {
          parkingLot: { select: { id: true, name: true } },
          vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
          rfidCard: { select: { id: true, uid: true, status: true } },
          manualExitOperator: { select: { id: true, fullName: true } }
        }
      });

      return { completedSession };
    });

    if (result.overtimeSurcharge) {
      const { feeRes, sessionPaidAmount } = result.overtimeSurcharge;
      throw AppError.badRequest(
        `Phương tiện đã quá thời gian ân hạn rời bãi và phát sinh thêm cước. Số tiền cần thu thêm: ${feeRes.amountDue.toString()} VND`,
        ErrorCodes.ADDITIONAL_PAYMENT_REQUIRED,
        {
          amountDue: feeRes.amountDue.toString(),
          totalFee: feeRes.totalFee.toString(),
          paidAmount: sessionPaidAmount.toString()
        }
      );
    }

    return result.completedSession!;
  }

  /**
   * Hồi bỏ yêu cầu ra bãi (rollbackExit)
   * Đưa trạng thái từ PENDING_EXIT trở lại ACTIVE khi khách lùi xe lại bãi đỗ.
   */
  public async rollbackExit(sessionId: string): Promise<ParkingSession> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.parkingSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw AppError.notFound('Không tìm thấy phiên gửi xe', ErrorCodes.SESSION_NOT_FOUND);
      }

      if (session.status !== ParkingSessionStatus.PENDING_EXIT) {
        throw AppError.badRequest(
          'Chỉ có thể hồi bỏ yêu cầu ra bãi cho phiên đang ở PENDING_EXIT',
          ErrorCodes.INVALID_SESSION_STATE_TRANSITION
        );
      }

      return tx.parkingSession.update({
        where: { id: sessionId },
        data: {
          status: ParkingSessionStatus.ACTIVE,
          billingCutoffTime: null
        }
      });
    });
  }
}

export const parkingSessionService = new ParkingSessionService();
