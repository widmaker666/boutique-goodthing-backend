import { PartialType } from '@nestjs/mapped-types';
import { CreateCreatriceDto } from './create-creatrice.dto';

export class UpdateCreatriceDto extends PartialType(CreateCreatriceDto) {}
