import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/generated/enums';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
