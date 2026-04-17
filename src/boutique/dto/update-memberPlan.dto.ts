import { IsEnum } from 'class-validator';
import { Plan } from 'src/generated/enums';

export class UpdatePlanMemberDto {
  @IsEnum(Plan)
  plan!: Plan;
}
