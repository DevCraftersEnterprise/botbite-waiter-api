import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import { BotBranchResponse } from '@/modules/bot/dto/bot-branch.response';
import {
  ADMIN_ONLY_BOT_FIELDS,
  UpdateBotConfigDto,
} from '@/modules/bot/dto/update-bot-config.dto';
import {
  toBotBranchConfig,
  toBotCatalog,
} from '@/modules/bot/utils/bot-view.util';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { User } from '@/modules/users/entities/user.entity';

/** Los DTO traen como undefined lo que no se envió: copiarlo borraría valores. */
const definedOnly = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;

@Injectable()
export class BotConfigService {
  private readonly logger = new Logger(BotConfigService.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  /** Configuración y catálogo que consume el bot. */
  async findBotBranch(branchId: string): Promise<BotBranchResponse> {
    const [branch, menus] = await Promise.all([
      this.branchRepository.findOne({
        where: { id: branchId },
        relations: { restaurant: true },
      }),
      this.menuRepository.find({
        where: { branchId, isActive: true },
        relations: { menuItems: { product: true, category: true } },
        order: { createdAt: 'ASC' },
      }),
    ]);

    if (!branch) throw new NotFoundException('Branch not found');

    const { restaurant } = branch;

    return {
      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
        walletPct: Number(restaurant.walletPct),
      },
      branch: toBotBranchConfig(branch),
      menuPdfUrl: menus.find((menu) => menu.pdfLink)?.pdfLink ?? null,
      catalog: toBotCatalog(menus.flatMap((menu) => menu.menuItems)),
    };
  }

  async findConfig(branchId: string) {
    return toBotBranchConfig(await this.findBranch(branchId));
  }

  async updateConfig(branchId: string, dto: UpdateBotConfigDto, user: User) {
    this.assertCanChange(dto, user);

    const branch = await this.findBranch(branchId);
    const { features, validTables, botBaseUrl, ...changes } = dto;

    Object.assign(branch, definedOnly(changes));
    if (features) {
      branch.features = { ...branch.features, ...definedOnly(features) };
    }
    if (validTables) branch.validTables = this.cleanTables(validTables);
    if (botBaseUrl !== undefined) {
      branch.botBaseUrl = botBaseUrl?.replace(/\/+$/, '') ?? null;
    }

    if (
      branch.verifyLocation &&
      (branch.latitude === null || branch.longitude === null)
    ) {
      throw new BadRequestException(
        'latitude and longitude are required to verify the location',
      );
    }

    await this.assertAvailable(branch, dto);

    // El QR impreso lleva el slug: si cambia, hay que generarlo de nuevo.
    if (dto.slug) branch.qrUrl = null;

    await this.branchRepository.save(branch);

    this.logger.log(`Bot config updated: ${branchId} by user: ${user.id}`);

    return toBotBranchConfig(branch);
  }

  private assertCanChange(dto: UpdateBotConfigDto, user: User): void {
    if (AccessControlService.isPrivileged(user)) return;

    const forbidden = ADMIN_ONLY_BOT_FIELDS.filter(
      (field) => dto[field] !== undefined,
    );

    if (forbidden.length > 0) {
      throw new ForbiddenException(
        `Only administrators can change: ${forbidden.join(', ')}`,
      );
    }
  }

  private async assertAvailable(
    branch: Branch,
    dto: UpdateBotConfigDto,
  ): Promise<void> {
    const taken = (field: 'slug' | 'whatsappPhoneNumberId', value: string) =>
      this.branchRepository.exists({
        where: { [field]: value, id: Not(branch.id) },
        withDeleted: true,
      });

    if (dto.slug && (await taken('slug', dto.slug))) {
      throw new ConflictException('The slug is already in use');
    }

    if (
      dto.whatsappPhoneNumberId &&
      (await taken('whatsappPhoneNumberId', dto.whatsappPhoneNumberId))
    ) {
      throw new ConflictException(
        'whatsappPhoneNumberId is already used by another branch',
      );
    }
  }

  private cleanTables(tables: string[]): string[] {
    return [...new Set(tables.map((table) => table.trim()).filter(Boolean))];
  }

  private async findBranch(branchId: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });

    if (!branch) throw new NotFoundException('Branch not found');

    return branch;
  }
}
