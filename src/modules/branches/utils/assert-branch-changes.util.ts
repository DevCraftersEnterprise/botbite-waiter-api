import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Not, Repository } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { Branch } from '@/modules/branches/entities/branch.entity';

interface BranchChanges {
  availableMessages?: number;
  phoneNumberAssistant?: string | null;
}

/**
 * Reglas comunes a crear y editar sucursales:
 * - Solo SUPER/ADMIN pueden asignar créditos de mensajes.
 * - El número del asistente identifica a la sucursal en el webhook de Twilio,
 *   así que no puede repetirse entre sucursales.
 */
export const assertBranchChangesUtil = async (
  user: { id: string; roles: UserRoles[] },
  changes: BranchChanges,
  repository: Repository<Branch>,
  currentBranchId?: string,
): Promise<void> => {
  if (
    changes.availableMessages !== undefined &&
    !AccessControlService.isPrivileged(user)
  ) {
    throw new ForbiddenException(
      'Only administrators can assign message credits',
    );
  }

  if (changes.phoneNumberAssistant) {
    const taken = await repository.exists({
      where: {
        phoneNumberAssistant: changes.phoneNumberAssistant,
        ...(currentBranchId ? { id: Not(currentBranchId) } : {}),
      },
    });

    if (taken)
      throw new ConflictException(
        'phoneNumberAssistant is already used by another branch',
      );
  }
};
