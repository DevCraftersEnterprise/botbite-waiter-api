import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { BotBranchId } from '@/modules/bot/decorators/bot-branch-id.decorator';
import { AddBotRoundDto } from '@/modules/bot/dto/add-bot-round.dto';
import { BotBranchResponse } from '@/modules/bot/dto/bot-branch.response';
import {
  BotOrderResponse,
  BotRoundResponse,
} from '@/modules/bot/dto/bot-order.response';
import { CreateBotNotificationDto } from '@/modules/bot/dto/create-bot-notification.dto';
import { OpenBotOrderDto } from '@/modules/bot/dto/open-bot-order.dto';
import { UpdateBotOrderDto } from '@/modules/bot/dto/update-bot-order.dto';
import { BotKeyGuard } from '@/modules/bot/guards/bot-key.guard';
import { BotConfigService } from '@/modules/bot/services/bot-config.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Order } from '@/modules/orders/entities/order.entity';
import { OrderSource } from '@/modules/orders/enums/order.enums';
import {
  OrderAccountsService,
  RoundResult,
} from '@/modules/orders/services/order-accounts.service';
import {
  toOrderView,
  toRoundView,
} from '@/modules/orders/utils/order-view.util';

const toRoundResponse = ({ created, order, round }: RoundResult) => ({
  created,
  order: toOrderView(order),
  round: toRoundView(round),
});

/**
 * Rutas que consume el mesero de n8n. Todas las peticiones salen de la misma IP
 * (el VPS), así que llevan un límite propio más alto que el del panel.
 */
@ApiTags('Bot')
@ApiSecurity('bot-key')
@ApiUnauthorizedResponse({ description: 'Llave faltante, inválida o revocada' })
@Controller('bot')
@UseGuards(BotKeyGuard)
@Throttle({ default: { limit: 1000, ttl: 60_000 } })
export class BotController {
  constructor(
    private readonly botConfigService: BotConfigService,
    private readonly accounts: OrderAccountsService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  @Get('branch')
  @ApiOperation({
    summary: 'Configuración y catálogo de la sucursal de la llave',
    description:
      'Responde con ETag: al guardarla en caché, envía If-None-Match y la API contesta 304 si nada cambió.',
  })
  @ApiOkResponse({ type: BotBranchResponse })
  findBranch(@BotBranchId() branchId: string): Promise<BotBranchResponse> {
    return this.botConfigService.findBotBranch(branchId);
  }

  @Post('orders')
  @ApiOperation({
    summary: 'Abre la cuenta con su primera ronda',
    description:
      'Reenviar el mismo `code` no duplica nada: responde 200 con `created: false`. La API calcula precios y totales con el menú vigente.',
  })
  @ApiCreatedResponse({ type: BotRoundResponse })
  @ApiOkResponse({ type: BotRoundResponse, description: 'Era un reintento' })
  async openOrder(
    @BotBranchId() branchId: string,
    @Body() dto: OpenBotOrderDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.accounts.openAccount({
      ...dto,
      branchId,
      source: OrderSource.WHATSAPP,
    });

    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);

    return toRoundResponse(result);
  }

  @Post('orders/:code/rounds')
  @ApiOperation({
    summary: 'Agrega una ronda (comanda) a la cuenta',
    description:
      'Reenviar el mismo `number` no duplica la comanda: responde 200 con `created: false`. Solo se aceptan rondas con la cuenta en `open`.',
  })
  @ApiCreatedResponse({ type: BotRoundResponse })
  @ApiOkResponse({ type: BotRoundResponse, description: 'Era un reintento' })
  async addRound(
    @BotBranchId() branchId: string,
    @Param('code') code: string,
    @Body() dto: AddBotRoundDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.accounts.addBotRound(
      branchId,
      code,
      dto.number,
      dto.items,
    );

    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);

    return toRoundResponse(result);
  }

  @Patch('orders/:code')
  @ApiOperation({
    summary: 'Avanza el estado de la cuenta',
    description:
      'Avisa a caja al pedir la cuenta y al elegir pagar con el mesero. Un cambio de estado no permitido responde 409.',
  })
  @ApiOkResponse({ type: BotOrderResponse })
  async updateOrder(
    @BotBranchId() branchId: string,
    @Param('code') code: string,
    @Body() dto: UpdateBotOrderDto,
  ) {
    const order = await this.accounts.updateFromBot(branchId, code, dto.status);

    return { order: toOrderView(order) };
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Aviso para caja que no sale de una cuenta' })
  @ApiCreatedResponse({ description: 'Aviso creado' })
  async createNotification(
    @BotBranchId() branchId: string,
    @Body() dto: CreateBotNotificationDto,
  ) {
    let orderId: string | null = null;

    if (dto.orderCode) {
      const order = await this.orderRepository.findOne({
        where: { code: dto.orderCode, branchId },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Account not found');
      orderId = order.id;
    }

    const { id } = await this.notificationsService.create({
      branchId,
      type: dto.type,
      message: dto.message,
      orderId,
    });

    return { id };
  }
}
