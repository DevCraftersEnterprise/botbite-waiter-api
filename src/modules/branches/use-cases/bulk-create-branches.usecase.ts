import { errorMessage, errorStack } from '@/common/utils/error.util';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { Repository } from 'typeorm';
import { TranslationService } from '@/common/services/translation.service';
import { CreateBranchDto } from '@/modules/branches/dto/create-branch.dto';
import { Branch } from '@/modules/branches/entities/branch.entity';
import {
  BulkCreateBranchesResponse,
  CsvBranchRow,
} from '@/modules/branches/interfaces/branches.interfaces';

@Injectable()
export class BulkCreateBranchesUseCase {
  private readonly logger = new Logger(BulkCreateBranchesUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
  ) {}

  async execute(
    restaurantId: string,
    file: Express.Multer.File,
    lang: string,
  ): Promise<BulkCreateBranchesResponse> {
    try {
      const stream = Readable.from(file.buffer.toString());

      const branches: CreateBranchDto[] =
        await this.parseBranchesCsvFile(stream);

      if (branches.length === 0) {
        throw new BadRequestException(
          this.translationService.translate('errors.empty_csv_file', lang),
        );
      }

      const newBranches = branches.map((branch) =>
        this.branchRepository.create({ ...branch, restaurantId }),
      );

      await this.branchRepository.save(newBranches);

      this.logger.log(
        `Bulk created ${newBranches.length} branches for restaurant: ${restaurantId}`,
      );

      return {
        branches: newBranches,
        count: newBranches.length,
        message: this.translationService.translate(
          'branches.branches_bulk_created',
          lang,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Bulk create failed for restaurant ${restaurantId}: ${errorMessage(error)}`,
        errorStack(error),
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        this.translationService.translate('errors.csv_processing_failed', lang),
      );
    }
  }

  private parseBranchesCsvFile = (
    stream: Readable,
  ): Promise<CreateBranchDto[]> => {
    return new Promise((resolve, reject) => {
      const branches: CreateBranchDto[] = [];

      stream
        .pipe(csv())
        .on('data', (row: CsvBranchRow) => {
          if (row.nombre && row.nombre.trim()) {
            branches.push({
              name: row.nombre.trim(),
              address: row.direccion?.trim() || '',
            });
          }
        })
        .on('end', () => {
          resolve(branches);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  };
}
