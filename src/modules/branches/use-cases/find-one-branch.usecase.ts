import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { BranchResponse } from '@/modules/branches/interfaces/branches.interfaces';

/**
 * Busca una sucursal por id o por número del asistente.
 *
 * Si se indica `restaurantId`, la sucursal debe pertenecer a ese restaurante.
 * (En v1 las condiciones se combinaban con OR, así que este filtro no
 * restringía nada.)
 */
export const buildFindOneBranchWhere = (
  term: string,
  restaurantId?: string,
): FindOptionsWhere<Branch> => {
  const where: FindOptionsWhere<Branch> = isUUID(term)
    ? { id: term }
    : { phoneNumberAssistant: term };

  if (restaurantId) where.restaurantId = restaurantId;

  return where;
};

@Injectable()
export class FindOneBranchUseCase {
  private readonly logger = new Logger(FindOneBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
  ) {}

  async execute(
    term: string,
    lang: string,
    restaurantId?: string,
  ): Promise<BranchResponse> {
    const branch = await this.branchRepository.findOne({
      where: buildFindOneBranchWhere(term, restaurantId),
      relations: {
        restaurant: { user: true },
        menus: {
          menuItems: { category: true, product: true },
        },
      },
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        phoneNumberAssistant: true,
        phoneNumberReception: true,
        surveyUrl: true,
        qrUrl: true,
        qrToken: true,
        availableMessages: true,
        restaurantId: true,
        restaurant: {
          id: true,
          name: true,
          isActive: true,
          user: { id: true },
        },
        menus: true,
      },
    });

    if (!branch) {
      this.logger.warn(`Search failed - Branch not found: ${term}`);
      throw new NotFoundException(
        this.translationService.translate('errors.branch_not_found', lang),
      );
    }

    return {
      branch,
      message: this.translationService.translate('branches.branch_found', lang),
    };
  }
}
