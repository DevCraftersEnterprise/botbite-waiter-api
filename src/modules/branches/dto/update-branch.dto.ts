import { PartialType } from '@nestjs/mapped-types';
import { CreateBranchDto } from '@/modules/branches/dto/create-branch.dto';

// qrUrl ya no se acepta del cliente: solo lo genera el endpoint
// generate-qr.
export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
