import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MenuImportPreview } from '@/modules/menus/interfaces/menu-csv.interfaces';
import { PlanMenuImportUseCase } from '@/modules/menus/use-cases/menu-csv/plan-menu-import.usecase';

/** Lo que haría la importación, sin guardar nada. */
@Injectable()
export class PreviewMenuImportUseCase {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly planMenuImport: PlanMenuImportUseCase,
  ) {}

  async execute(
    menuId: string,
    buffer: Buffer,
    lang: string,
  ): Promise<MenuImportPreview> {
    const plan = await this.planMenuImport.execute(
      this.dataSource.manager,
      menuId,
      buffer,
      lang,
    );
    return this.planMenuImport.toPreview(plan);
  }
}
