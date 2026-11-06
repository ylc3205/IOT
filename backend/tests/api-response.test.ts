import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { sendSuccess, sendError } from '../src/common/utils/api-response';
import { ErrorCodes } from '../src/common/errors/error-codes';

describe('API Response Formatter', () => {
  const app = express();

  app.get('/test-success', (_req: Request, res: Response) => {
    sendSuccess(res, { foo: 'bar' }, 201);
  });

  app.get('/test-error', (_req: Request, res: Response) => {
    sendError(res, 400, ErrorCodes.BAD_REQUEST, 'Invalid payload', { field: 'name' });
  });

  it('sendSuccess should follow { success: true, data: ... } format', async () => {
    const res = await request(app).get('/test-success');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { foo: 'bar' }
    });
  });

  it('sendError should follow { success: false, error: ... } format', async () => {
    const res = await request(app).get('/test-error');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: ErrorCodes.BAD_REQUEST,
        message: 'Invalid payload',
        details: { field: 'name' }
      }
    });
  });
});

