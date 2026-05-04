import { PartialType } from '@nestjs/mapped-types';
import { CreateEvenementDto } from './create-evenement.dto';

export class UpdateEvenementDto extends PartialType(CreateEvenementDto) {}
