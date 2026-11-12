import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import { Namespace, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import { JwtPayload } from '@/core/auth/interfaces/jwt-payload.interface';
import { User } from '@/modules/users/entities/user.entity';

interface SocketSession {
  user: Pick<User, 'id' | 'roles'>;
  /** Cuándo vence el access token del handshake (ms). */
  expiresAt: number;
  expiryTimer?: ReturnType<typeof setTimeout>;
}

interface AuthenticatedSocket extends Socket {
  data: SocketSession;
}

/** setTimeout no acepta más de ~24.8 días. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Eventos en tiempo real para el panel de caja.
 *
 * En v1 el namespace no pedía autenticación y aceptaba cualquier origen:
 * cualquiera podía unirse a la sala de cualquier sucursal y recibir las
 * notificaciones de caja (con nombre y teléfono de clientes). Ahora:
 * - la conexión exige un access token (handshake `auth.token` o cabecera
 *   Authorization; ya no por query, porque queda en los logs);
 * - `joinBranch` comprueba que el usuario tenga acceso a esa sucursal;
 * - la conexión se cierra cuando vence el token, cuando se desactiva al
 *   usuario, y sale de la sala cuando lo quitan de la sucursal (#37). El panel
 *   vuelve a conectar con un token renovado.
 * Los orígenes CORS los fija el adaptador de Socket.IO (ver main.ts).
 */
@WebSocketGateway({ namespace: 'orders' })
export class OrdersGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly accessControl: AccessControlService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  afterInit(server: Namespace) {
    server.use((socket, next) => {
      this.authenticate(socket)
        .then((session) => {
          Object.assign((socket as AuthenticatedSocket).data, session);
          next();
        })
        .catch(() => next(new Error('Unauthorized')));
    });
  }

  handleConnection(client: AuthenticatedSocket) {
    this.logger.log(
      `Client connected: ${client.id} (user ${client.data.user?.id})`,
    );

    // Con el token vencido, la conexión se cierra: el panel reconecta con uno nuevo.
    const remaining = client.data.expiresAt - Date.now();
    if (remaining <= 0) {
      client.disconnect(true);
      return;
    }
    client.data.expiryTimer = setTimeout(
      () => {
        this.logger.log(`Access token expired, closing socket ${client.id}`);
        client.disconnect(true);
      },
      Math.min(remaining, MAX_TIMER_MS),
    );
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data?.expiryTimer) clearTimeout(client.data.expiryTimer);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinBranch')
  async handleJoinBranch(
    @MessageBody() branchId: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (typeof branchId !== 'string' || !isUUID(branchId)) {
      return { success: false, error: 'Invalid branchId' };
    }

    if (
      !(await this.accessControl.canAccessBranch(client.data.user, branchId))
    ) {
      this.logger.warn(
        `User ${client.data.user.id} denied access to branch room ${branchId}`,
      );
      return { success: false, error: 'Forbidden' };
    }

    for (const room of client.rooms) {
      if (room.startsWith('branch-')) await client.leave(room);
    }

    const roomName = `branch-${branchId}`;
    await client.join(roomName);

    return { success: true, room: roomName };
  }

  @SubscribeMessage('leaveBranch')
  async handleLeaveBranch(
    @MessageBody() branchId: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    if (typeof branchId === 'string') await client.leave(`branch-${branchId}`);
    return { success: true };
  }

  /** Al desactivar a un usuario: sus conexiones abiertas se cierran. */
  disconnectUser(userId: string): void {
    for (const socket of this.socketsOf(userId)) socket.disconnect(true);
  }

  /** Al quitar a alguien de una sucursal: deja de recibir sus avisos. */
  async removeFromBranch(userId: string, branchId: string): Promise<void> {
    for (const socket of this.socketsOf(userId)) {
      await socket.leave(`branch-${branchId}`);
    }
  }

  private socketsOf(userId: string): AuthenticatedSocket[] {
    if (!this.server) return [];
    return [...this.server.sockets.values()].filter(
      (socket) => (socket as AuthenticatedSocket).data?.user?.id === userId,
    ) as AuthenticatedSocket[];
  }

  emitOrderUpdate(branchId: string) {
    this.server?.to(`branch-${branchId}`).emit('orderUpdate', { branchId });
  }

  emitNotificationUpdate(branchId: string, notification: unknown) {
    this.server
      ?.to(`branch-${branchId}`)
      .emit('notificationUpdate', { branchId, notification });
  }

  private async authenticate(socket: Socket): Promise<SocketSession> {
    const token = this.extractToken(socket);
    if (!token) throw new Error('Missing token');

    const payload = await this.jwtService.verifyAsync<
      JwtPayload & { exp?: number }
    >(token);
    if (payload.type !== 'access') throw new Error('Invalid token type');
    if (!payload.exp) throw new Error('Token without expiry');

    const user = await this.userRepository.findOne({
      where: { id: payload.userId },
      select: ['id', 'roles', 'isActive'],
    });

    if (!user?.isActive) throw new Error('Inactive user');

    return {
      user: { id: user.id, roles: user.roles },
      expiresAt: payload.exp * 1000,
    };
  }

  private extractToken(socket: Socket): string | undefined {
    const authToken: unknown = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken)
      return authToken.replace(/^Bearer\s+/i, '');

    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.substring(7);

    return undefined;
  }
}
