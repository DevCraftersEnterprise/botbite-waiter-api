import { ConflictException } from '@nestjs/common';
import { Not, Repository } from 'typeorm';
import { Branch } from '@/modules/branches/entities/branch.entity';

interface BranchChanges {
  phoneNumberAssistant?: string | null;
}

/**
 * Regla común a crear y editar sucursales: el número del asistente identifica
 * a la sucursal, así que no puede repetirse.
 */
export const assertBranchChangesUtil = async (
  changes: BranchChanges,
  repository: Repository<Branch>,
  currentBranchId?: string,
): Promise<void> => {
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
