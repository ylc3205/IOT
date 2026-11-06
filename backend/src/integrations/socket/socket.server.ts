import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '../../config/env';
import { logger } from '../../common/utils/logger';
import { verifyToken, AuthTokenPayload } from '../../common/utils/jwt';
import { SocketEvent } from './socket.types';

export interface AuthenticatedSocket extends Socket {
  user?: AuthTokenPayload;
}

/**
 * Socket.IO Server Management Layer
 * Cung cấp kênh truyền thông hai chiều thời gian thực (Real-time Full-Duplex)
 * giữa Express Backend và React CMS Web.
 */
class SocketService {
  private io: SocketIOServer | null = null;
  private connectedSocketsCount = 0;

  /**
   * Khởi tạo Socket.IO Server gắn kết vào HTTP Server hiện hành
   */
  public init(httpServer: HttpServer): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Middleware bảo mật xác thực WebSocket handshake bằng JWT (Khắc phục SEC-01)
    this.io.use((socket: Socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : undefined);

      if (!token) {
        logger.warn(`❌ Socket.IO từ chối kết nối: Thiếu authentication token [ID: ${socket.id}]`);
        return next(new Error('AUTHENTICATION_ERROR: Missing authentication token'));
      }

      try {
        const payload = verifyToken(token);
        (socket as AuthenticatedSocket).user = payload;
        next();
      } catch {
        logger.warn(`❌ Socket.IO từ chối kết nối: Token không hợp lệ [ID: ${socket.id}]`);
        return next(new Error('AUTHENTICATION_ERROR: Invalid or expired token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      this.connectedSocketsCount++;
      const userEmail = (socket as AuthenticatedSocket).user?.email || 'authenticated-client';
      logger.info(`🔌 CMS Client kết nối Socket.IO mới: [ID: ${socket.id}, User: ${userEmail}]. Tổng client: ${this.connectedSocketsCount}`);

      // Xử lý khi Client ngắt kết nối
      socket.on('disconnect', (reason) => {
        this.connectedSocketsCount = Math.max(0, this.connectedSocketsCount - 1);
        logger.info(`❌ CMS Client ngắt kết nối [ID: ${socket.id}]: ${reason}. Tổng client còn lại: ${this.connectedSocketsCount}`);
      });

      // Lắng nghe lỗi socket
      socket.on('error', (err) => {
        logger.error(`Lỗi socket [ID: ${socket.id}]:`, err);
      });
    });

    logger.info('✅ Socket.IO Server đã khởi tạo thành công với JWT handshake authentication.');
    return this.io;
  }

  /**
   * Phát sự kiện (Emit) tới toàn bộ CMS clients đang kết nối
   */
  public emitToAll<T = unknown>(event: SocketEvent | string, data: T): void {
    if (!this.io) {
      logger.warn(`Không thể emit sự kiện "${event}": Socket.IO Server chưa khởi tạo.`);
      return;
    }
    this.io.emit(event, data);
  }

  /**
   * Trả về số lượng Client CMS đang kết nối realtime
   */
  public getActiveCount(): number {
    return this.connectedSocketsCount;
  }

  /**
   * Lấy instance Server của Socket.IO
   */
  public getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Đóng Socket.IO Server an toàn (Graceful Shutdown)
   */
  public async close(): Promise<void> {
    if (this.io) {
      logger.info('Đang ngắt kết nối các client Socket.IO...');
      return new Promise((resolve) => {
        this.io!.close(() => {
          logger.info('Đã đóng Socket.IO Server an toàn.');
          this.io = null;
          resolve();
        });
      });
    }
  }
}

export const socketService = new SocketService();

