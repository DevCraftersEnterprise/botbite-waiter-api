import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditAction,
  AuditLog,
} from '@/modules/audit/entities/audit-log.entity';

export interface AuditEntry {
  userId: string;
  restaurantId: string;
  action: AuditAction;
  recordCount?: number;
  subjectId?: string | null;
}

/** Registra las consultas de datos personales. Sin teléfonos ni nombres. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.auditRepository.insert({
      userId: entry.userId,
      restaurantId: entry.restaurantId,
      action: entry.action,
      recordCount: entry.recordCount ?? 1,
      subjectId: entry.subjectId ?? null,
    });

    this.logger.log(
      `${entry.action} by user ${entry.userId} in restaurant ${entry.restaurantId} (${entry.recordCount ?? 1})`,
    );
  }
}
