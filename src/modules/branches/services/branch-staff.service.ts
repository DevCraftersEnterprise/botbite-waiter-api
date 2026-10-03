import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import { BranchStaff } from '@/modules/branches/entities/branch-staff.entity';
import { User } from '@/modules/users/entities/user.entity';

export interface StaffMember {
  id: string;
  email: string;
  isActive: boolean;
  assignedAt: Date;
}

/**
 * Asignación de personal (cajeros y meseros, rol USER) a sucursales. La
 * pertenencia de la sucursal al usuario que asigna se valida en el
 * controlador.
 */
@Injectable()
export class BranchStaffService {
  private readonly logger = new Logger(BranchStaffService.name);

  constructor(
    @InjectRepository(BranchStaff)
    private readonly staffRepository: Repository<BranchStaff>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByBranch(branchId: string): Promise<{ staff: StaffMember[] }> {
    const rows = await this.staffRepository.find({
      where: { branchId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return {
      staff: rows.map((row) => ({
        id: row.user.id,
        email: row.user.email,
        isActive: row.user.isActive,
        assignedAt: row.createdAt,
      })),
    };
  }

  async assign(
    branchId: string,
    email: string,
  ): Promise<{ staff: StaffMember }> {
    const user = await this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });

    // Solo cuentas de personal: asignar a un cliente o admin no tendría efecto
    // y daría la impresión de que su acceso quedó acotado.
    if (!user || !AccessControlService.isStaff(user)) {
      throw new NotFoundException(
        'No staff account (role "user") exists with that email',
      );
    }

    if (!user.isActive) {
      throw new BadRequestException('The staff account is inactive');
    }

    await this.staffRepository
      .createQueryBuilder()
      .insert()
      .into(BranchStaff)
      .values({ branchId, userId: user.id })
      .orIgnore()
      .execute();

    const assignment = await this.staffRepository.findOneByOrFail({
      branchId,
      userId: user.id,
    });

    this.logger.log(`User ${user.id} assigned to branch ${branchId}`);

    return {
      staff: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        assignedAt: assignment.createdAt,
      },
    };
  }

  async remove(branchId: string, userId: string): Promise<void> {
    const result = await this.staffRepository.delete({ branchId, userId });

    if (!result.affected) {
      throw new NotFoundException('That user is not assigned to this branch');
    }

    this.logger.log(`User ${userId} removed from branch ${branchId}`);
  }
}
