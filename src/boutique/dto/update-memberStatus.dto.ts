import { IsEnum } from 'class-validator';
import { Status } from 'src/generated/enums';

export class UpdateMemberStatusDto {
  @IsEnum(Status)
  status!: Status;
}
