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

interface AuthenticatedSocket extends Socket {
  data: { user: Pick<User, 'id' | 'roles'> };
}

/**
 * Eventos en tiempo real para el panel de caja.
 *
 * En v1 el namespace no pedía autenticación y aceptaba cualquier origen:
 * cualquiera podía unirse a la sala de cualquier sucursal y recibir las
 * notificaciones de caja (con nombre y teléfono de clientes). Ahora:
 * - la conexión exige un access token (handshake `auth.token`, cabecera
 *   Authorization o query `token`);
 * - `joinBranch` comprueba que el usuario tenga acceso a esa sucursal.
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
        .then((user) => {
          (socket as AuthenticatedSocket).data.user = user;
          next();
        })
        .catch(() => next(new Error('Unauthorized')));
    });
  }

  handleConnection(client: AuthenticatedSocket) {
    this.logger.log(
      `Client connected: ${client.id} (user ${client.data.user?.id})`,
    );
  }

  handleDisconnect(client: Socket) {
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

  emitOrderUpdate(branchId: string) {
    this.server?.to(`branch-${branchId}`).emit('orderUpdate', { branchId });
  }

  emitNotificationUpdate(branchId: string, notification: unknown) {
    this.server
      ?.to(`branch-${branchId}`)
      .emit('notificationUpdate', { branchId, notification });
  }

  private async authenticate(
    socket: Socket,
  ): Promise<Pick<User, 'id' | 'roles'>> {
    const token = this.extractToken(socket);
    if (!token) throw new Error('Missing token');

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    if (payload.type !== 'access') throw new Error('Invalid token type');

    const user = await this.userRepository.findOne({
      where: { id: payload.userId },
      select: ['id', 'roles', 'isActive'],
    });

    if (!user?.isActive) throw new Error('Inactive user');

    return { id: user.id, roles: user.roles };
  }

  private extractToken(socket: Socket): string | undefined {
    const authToken: unknown = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken)
      return authToken.replace(/^Bearer\s+/i, '');

    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.substring(7);

    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken) return queryToken;

    return undefined;
  }
}
