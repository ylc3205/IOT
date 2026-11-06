import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../integrations/database/prisma.client';
import { ErrorCodes } from '../errors/error-codes';

/**
 * Middleware đảm bảo tính Idempotent cho các Endpoint HTTP POST/PATCH/DELETE
 * Lưu vết và khóa trạng thái trực tiếp trong bảng idempotency_keys của PostgreSQL.
 */
export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const idempotencyKey = req.header('Idempotency-Key') || req.header('idempotency-key');

  // Nếu client không truyền Idempotency-Key, tiếp tục xử lý thông thường
  if (!idempotencyKey) {
    return next();
  }

  // 1. Kiểm tra tính hợp lệ của Key (định dạng UUID hoặc chuỗi định danh từ 16 đến 128 ký tự)
  const trimmedKey = idempotencyKey.trim();
  if (trimmedKey.length < 8 || trimmedKey.length > 128) {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Tiêu đề Idempotency-Key không hợp lệ (yêu cầu từ 8 đến 128 ký tự)'
      }
    });
    return;
  }

  // 2. Tính toán mã băm (Request Fingerprint Hash)
  const userIdentifier = (req as any).user?.id || 'anonymous';
  const targetPath = req.baseUrl + req.path;
  const payloadToHash = `${req.method}:${targetPath}:${userIdentifier}:${JSON.stringify(req.body || {})}`;
  const requestHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

  const now = new Date();
  const lockExpiration = new Date(now.getTime() + 30 * 1000); // Khóa trong 30 giây

  try {
    // 3. Tìm bản ghi khóa đã tồn tại trong CSDL
    let existingRecord = await prisma.idempotencyKey.findUnique({
      where: { key: trimmedKey }
    });

    if (existingRecord) {
      // TÌNH HUỐNG 2: Cùng Key nhưng Payload khác nhau
      if (existingRecord.requestHash !== requestHash) {
        res.status(422).json({
          success: false,
          error: {
            code: ErrorCodes.IDEMPOTENCY_KEY_PAYLOAD_MISMATCH,
            message: 'Idempotency-Key này đã được sử dụng với một payload yêu cầu khác'
          }
        });
        return;
      }

      // TÌNH HUỐNG 3: Phát lại yêu cầu đã thành công trước đó (Successful Replay)
      if (existingRecord.responseStatus !== null && existingRecord.responseBody !== null) {
        res.setHeader('X-Idempotency-Replay', 'true');
        res.status(existingRecord.responseStatus).json(existingRecord.responseBody);
        return;
      }

      // TÌNH HUỐNG 1: Yêu cầu đang được xử lý dở dang (In-Progress Concurrency)
      if (existingRecord.lockedUntil > now) {
        res.status(409).json({
          success: false,
          error: {
            code: ErrorCodes.IDEMPOTENCY_KEY_IN_PROGRESS,
            message: 'Một yêu cầu với Idempotency-Key này đang trong quá trình xử lý, vui lòng chờ'
          }
        });
        return;
      }

      // Nếu khóa trước đó đã hết hạn (stale lock do crash), gia hạn lại khóa
      await prisma.idempotencyKey.update({
        where: { key: trimmedKey },
        data: { lockedUntil: lockExpiration }
      });
    } else {
      // Tạo mới bản ghi khóa trong CSDL
      try {
        await prisma.idempotencyKey.create({
          data: {
            key: trimmedKey,
            targetPath,
            requestHash,
            lockedUntil: lockExpiration
          }
        });
      } catch (err: any) {
        // Tranh chấp đồng thời khi 2 request cùng tạo key cùng mili-giây
        if (err.code === 'P2002') {
          res.status(409).json({
            success: false,
            error: {
              code: ErrorCodes.IDEMPOTENCY_KEY_IN_PROGRESS,
              message: 'Một yêu cầu đồng thời với Idempotency-Key này đang được xử lý'
            }
          });
          return;
        }
        throw err;
      }
    }

    // 4. Hook vào res.json để lưu trữ kết quả phản hồi khi Controller hoàn thành
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Chỉ lưu trữ phản hồi khi HTTP status < 500 (tránh lưu lỗi máy chủ 500)
      if (res.statusCode < 500) {
        prisma.idempotencyKey
          .update({
            where: { key: trimmedKey },
            data: {
              responseStatus: res.statusCode,
              responseBody: body
            }
          })
          .catch((e) => console.error('Lỗi lưu cache Idempotency:', e));
      } else {
        // Nếu lỗi 500, xóa key để cho phép client retry sạch sẽ
        prisma.idempotencyKey
          .delete({ where: { key: trimmedKey } })
          .catch(() => {});
      }

      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
}
