import { IsNotEmpty, IsUUID } from 'class-validator';

export class FindConversationsByBranchDto {
  @IsUUID()
  @IsNotEmpty()
  branchId: string;
}
