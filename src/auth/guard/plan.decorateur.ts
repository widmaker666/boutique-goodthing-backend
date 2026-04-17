import { SetMetadata } from '@nestjs/common';
import { Plan } from 'src/generated/enums';

export const Plans = (...plans: Plan[]) => SetMetadata('plans', plans);
