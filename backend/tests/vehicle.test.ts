import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';

describe('Vehicle Module API Tests', () => {
  let authToken = '';
  let createdVehicleId = '';

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator@smartparking.local',
        password: env.SEED_ADMIN_PASSWORD
      });

    authToken = loginRes.body.data.token;
  });

  it('GET /api/vehicles should return paginated list of vehicles', async () => {
    const res = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('POST /api/vehicles should create a vehicle and normalize licensePlate', async () => {
    // Gửi biển số xe có khoảng trắng và dấu gạch: "59-X1 888.99" -> phải chuẩn hóa thành "59X188899"
    const uniqueRawPlate = `59-X1 ${Date.now().toString().slice(-5)}`;
    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        licensePlate: uniqueRawPlate,
        vehicleType: 'CAR'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.licensePlate).not.toContain('-');
    expect(res.body.data.licensePlate).not.toContain(' ');
    expect(res.body.data.vehicleType).toBe('CAR');
    createdVehicleId = res.body.data.id;
  });

  it('POST /api/vehicles should reject duplicate licensePlate with 409', async () => {
    const testPlate = `51F${Date.now().toString().slice(-5)}`;
    // Tạo lần 1
    await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        licensePlate: testPlate,
        vehicleType: 'CAR'
      });

    // Thử tạo lại lần 2 với định dạng có dấu gạch ngang (kiểm tra chuẩn hóa trùng lặp)
    const formattedPlate = `${testPlate.slice(0, 3)}-${testPlate.slice(3)}`;
    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        licensePlate: formattedPlate,
        vehicleType: 'CAR'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VEHICLE_LICENSE_PLATE_EXISTS');
  });

  it('GET /api/vehicles/:id should return single vehicle with rfidCards array', async () => {
    const res = await request(app)
      .get(`/api/vehicles/${createdVehicleId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdVehicleId);
    expect(Array.isArray(res.body.data.rfidCards)).toBe(true);
  });

  it('PATCH /api/vehicles/:id should update vehicle type and status', async () => {
    const res = await request(app)
      .patch(`/api/vehicles/${createdVehicleId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        vehicleType: 'MOTORBIKE',
        isActive: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehicleType).toBe('MOTORBIKE');
  });
});
