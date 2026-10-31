import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { errorMessage } from '@/common/utils/error.util';
import { BotApiKey } from '@/modules/bot/entities/bot-api-key.entity';
import { generateBotKey, hashBotKey } from '@/modules/bot/utils/bot-key.util';

// lastUsedAt es informativo: no vale una escritura en cada petición del bot.
const LAST_USED_RESOLUTION_MS = 60_000;

@Injectable()
export class BotKeysService {
  private readonly logger = new Logger(BotKeysService.name);

  constructor(
    @InjectRepository(BotApiKey)
    private readonly botKeyRepository: Repository<BotApiKey>,
  ) {}

  findByBranch(branchId: string): Promise<BotApiKey[]> {
    return this.botKeyRepository.find({
      where: { branchId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(branchId: string, name: string) {
    const { secret, keyPrefix, keyHash } = generateBotKey();
    const key = await this.botKeyRepository.save(
      this.botKeyRepository.create({ branchId, name, keyPrefix, keyHash }),
    );

    this.logger.log(`Bot key created: ${key.id} for branch ${branchId}`);

    return { key, secret };
  }

  async revoke(branchId: string, keyId: string): Promise<void> {
    const { affected } = await this.botKeyRepository.update(
      { id: keyId, branchId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    if (!affected) throw new NotFoundException('Bot key not found');

    this.logger.log(`Bot key revoked: ${keyId} for branch ${branchId}`);
  }

  /** Devuelve la sucursal a la que pertenece una llave válida. */
  async authenticate(secret: string): Promise<string> {
    const key = await this.botKeyRepository.findOne({
      where: { keyHash: hashBotKey(secret), revokedAt: IsNull() },
      relations: { branch: { restaurant: true } },
    });

    if (!key) throw new UnauthorizedException('Invalid bot key');

    if (!key.branch?.isActive || !key.branch.restaurant?.isActive) {
      throw new ForbiddenException('The branch is not active');
    }

    this.touch(key);

    return key.branchId;
  }

  private touch(key: BotApiKey): void {
    const now = Date.now();
    if (
      key.lastUsedAt &&
      now - key.lastUsedAt.getTime() < LAST_USED_RESOLUTION_MS
    ) {
      return;
    }

    this.botKeyRepository
      .update({ id: key.id }, { lastUsedAt: new Date(now) })
      .catch((error) =>
        this.logger.warn(`Could not update lastUsedAt: ${errorMessage(error)}`),
      );
  }
}
