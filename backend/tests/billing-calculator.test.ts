import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BillingCalculator } from '../src/modules/billing/billing.calculator';
import { PricingType, VehicleType, Prisma } from '@prisma/client';
import { prisma } from '../src/integrations/database/prisma.client';

describe('BillingCalculator Unit & Integration Tests', () => {
  const testRunId = `TEST_BIL_${Date.now()}`;
  let testLotId: string;

  beforeAll(async () => {
    // Tạo bãi xe và biểu phí phục vụ kiểm thử snapshot
    const lot = await prisma.parkingLot.create({
      data: {
        name: `Bãi Test Billing ${testRunId}`,
        totalCapacity: 50,
        isActive: true
      }
    });
    testLotId = lot.id;

    await prisma.pricingRule.create({
      data: {
        parkingLotId: testLotId,
        vehicleType: VehicleType.CAR,
        pricingType: PricingType.PER_HOUR,
        amount: new Prisma.Decimal('15000.00'),
        isActive: true
      }
    });

    await prisma.pricingRule.create({
      data: {
        parkingLotId: testLotId,
        vehicleType: VehicleType.MOTORBIKE,
        pricingType: PricingType.PER_VISIT,
        amount: new Prisma.Decimal('5000.00'),
        isActive: true
      }
    });
  });

  afterAll(async () => {
    await prisma.pricingRule.deleteMany({ where: { parkingLotId: testLotId } });
    await prisma.parkingLot.delete({ where: { id: testLotId } });
  });

  it('BIL-01: Tính phí theo lượt (PER_VISIT) cho đỗ 10 phút', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const cutoffTime = new Date('2026-11-06T08:10:00.000Z');

    const result = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime,
      pricingType: PricingType.PER_VISIT,
      rate: '5000.00'
    });

    expect(result.durationMinutes).toBe(10);
    expect(result.billableHours).toBeNull();
    expect(result.totalFee.toString()).toBe('5000');
    expect(result.amountDue.toString()).toBe('5000');
  });

  it('BIL-02: Tính phí theo lượt (PER_VISIT) cho đỗ dài ngày (72 giờ) không tăng phí', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const cutoffTime = new Date('2026-11-09T08:00:00.000Z'); // 72 giờ

    const result = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime,
      pricingType: PricingType.PER_VISIT,
      rate: '5000.00'
    });

    expect(result.durationMinutes).toBe(72 * 60);
    expect(result.totalFee.toString()).toBe('5000');
    expect(result.amountDue.toString()).toBe('5000');
  });

  it('BIL-03: Tính phí theo giờ (PER_HOUR): Đỗ 12 phút tính tối thiểu 1 giờ', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const cutoffTime = new Date('2026-11-06T08:12:00.000Z');

    const result = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime,
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00'
    });

    expect(result.durationMinutes).toBe(12);
    expect(result.billableHours).toBe(1);
    expect(result.totalFee.toString()).toBe('15000');
    expect(result.amountDue.toString()).toBe('15000');
  });

  it('BIL-04: Tính phí theo giờ (PER_HOUR): Đỗ đúng 60 phút tính 1 giờ', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const cutoffTime = new Date('2026-11-06T09:00:00.000Z');

    const result = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime,
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00'
    });

    expect(result.durationMinutes).toBe(60);
    expect(result.billableHours).toBe(1);
    expect(result.totalFee.toString()).toBe('15000');
  });

  it('BIL-05: Tính phí theo giờ (PER_HOUR): Đỗ 61 phút làm tròn lên giờ thứ 2', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const cutoffTime = new Date('2026-11-06T09:01:00.000Z');

    const result = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime,
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00'
    });

    expect(result.durationMinutes).toBe(61);
    expect(result.billableHours).toBe(2);
    expect(result.totalFee.toString()).toBe('30000');
  });

  it('BIL-05b: Quy chuẩn kiểm thử lũy tiến theo giờ: 70 phút, 80 phút (tính 2 giờ), 125 phút (tính 3 giờ)', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');

    // 70 phút -> 2 giờ (30,000 VND)
    const res70 = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime: new Date(entryTime.getTime() + 70 * 60 * 1000),
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00'
    });
    expect(res70.durationMinutes).toBe(70);
    expect(res70.billableHours).toBe(2);
    expect(res70.totalFee.toString()).toBe('30000');

    // 80 phút -> 2 giờ (30,000 VND)
    const res80 = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime: new Date(entryTime.getTime() + 80 * 60 * 1000),
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00'
    });
    expect(res80.durationMinutes).toBe(80);
    expect(res80.billableHours).toBe(2);
    expect(res80.totalFee.toString()).toBe('30000');

    // 125 phút -> 3 giờ (45,000 VND)
    const res125 = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime: new Date(entryTime.getTime() + 125 * 60 * 1000),
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00'
    });
    expect(res125.durationMinutes).toBe(125);
    expect(res125.billableHours).toBe(3);
    expect(res125.totalFee.toString()).toBe('45000');
  });

  it('BIL-06: Tính phí theo giờ (PER_HOUR): Đỗ 24 giờ 1 phút tính 25 giờ', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const cutoffTime = new Date('2026-11-07T08:01:00.000Z'); // 1441 phút

    const result = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime,
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00'
    });

    expect(result.durationMinutes).toBe(1441);
    expect(result.billableHours).toBe(25);
    expect(result.totalFee.toString()).toBe('375000');
  });

  it('BIL-07: Độ chính xác số học Decimal, không bị trôi số dấu phẩy động', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const cutoffTime = new Date('2026-11-06T11:00:00.000Z'); // 3 giờ

    const result = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime,
      pricingType: PricingType.PER_HOUR,
      rate: new Prisma.Decimal('13333.33')
    });

    expect(result.billableHours).toBe(3);
    expect(result.totalFee.toString()).toBe('39999.99');
  });

  it('BIL-08: Chụp ảnh biểu giá (Price Snapshot) độc lập khi biểu phí bãi xe thay đổi', async () => {
    const snapshot = await BillingCalculator.resolvePricingSnapshot(testLotId, VehicleType.CAR);
    expect(snapshot.pricingType).toBe(PricingType.PER_HOUR);
    expect(snapshot.pricingRate.toString()).toBe('15000');

    // Giả sử quản trị viên thay đổi giá trong bãi thành 25,000 VND
    await prisma.pricingRule.update({
      where: { id: snapshot.pricingRuleId },
      data: { amount: new Prisma.Decimal('25000.00') }
    });

    // Phiên đỗ cũ tính tiền dựa trên snapshotRate 15,000, không bị ảnh hưởng bởi giá mới 25,000
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const cutoffTime = new Date('2026-11-06T10:00:00.000Z'); // 2 giờ

    const sessionFee = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime,
      pricingType: snapshot.pricingType,
      rate: snapshot.pricingRate
    });

    expect(sessionFee.totalFee.toString()).toBe('30000'); // 15,000 * 2 = 30,000 (không phải 50,000)
  });

  it('BIL-09: Thời gian ân hạn rời bãi (Grace Period) và phụ thu không thu trùng tiền', () => {
    const entryTime = new Date('2026-11-06T08:00:00.000Z');
    const firstPaymentTime = new Date('2026-11-06T09:00:00.000Z'); // Thanh toán 1 giờ (15k)

    // TH1: Xe xuất bãi lúc 09:08 (trong thời gian ân hạn 10 phút)
    const exitWithinGrace = new Date('2026-11-06T09:08:00.000Z');
    const res1 = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime: exitWithinGrace,
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00',
      paidAmount: '15000.00',
      lastPaymentTime: firstPaymentTime,
      gracePeriodMinutes: 10
    });

    expect(res1.isGracePeriodActive).toBe(true);
    expect(res1.isOvertimeSurchargeRequired).toBe(false);

    // TH2: Xe nán lại bãi đến 09:45 (quá 10 phút và bước sang giờ thứ 2: 105 phút)
    const exitAfterGrace = new Date('2026-11-06T09:45:00.000Z');
    const res2 = BillingCalculator.calculateParkingFee({
      entryTime,
      cutoffTime: exitAfterGrace,
      pricingType: PricingType.PER_HOUR,
      rate: '15000.00',
      paidAmount: '15000.00',
      lastPaymentTime: firstPaymentTime,
      gracePeriodMinutes: 10
    });

    expect(res2.isGracePeriodActive).toBe(false);
    expect(res2.isOvertimeSurchargeRequired).toBe(true);
    expect(res2.durationMinutes).toBe(105);
    expect(res2.billableHours).toBe(2);
    expect(res2.totalFee.toString()).toBe('30000'); // Tổng cước cho 2 giờ
    expect(res2.paidAmount.toString()).toBe('15000'); // Đã trả trước 15,000
    expect(res2.amountDue.toString()).toBe('15000'); // CHỈ CẦN THU THÊM 15,000, KHÔNG THU LẠI 30,000
  });
});
