import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BotBranchId } from '@/modules/bot/decorators/bot-branch-id.decorator';
import { BotBranchResponse } from '@/modules/bot/dto/bot-branch.response';
import { BotKeyGuard } from '@/modules/bot/guards/bot-key.guard';
import { BotConfigService } from '@/modules/bot/services/bot-config.service';

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
  constructor(private readonly botConfigService: BotConfigService) {}

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
}
