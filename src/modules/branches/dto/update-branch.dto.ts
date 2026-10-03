import { PartialType } from '@nestjs/mapped-types';
import { CreateBranchDto } from '@/modules/branches/dto/create-branch.dto';

// qrUrl y qrToken ya no se aceptan del cliente: solo los genera el endpoint
// generate-qr.
export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
