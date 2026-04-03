import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreatriceService } from './creatrice.service';
import { CreateCreatriceDto } from './dto/create-creatrice.dto';
import { UpdateCreatriceDto } from './dto/update-creatrice.dto';
import { QueryCreatrice } from './dto/query-creatrice.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@UseGuards(JwtGuard)
@Controller('creatrice')
export class CreatriceController {
  constructor(private readonly creatriceService: CreatriceService) {}

  @Post()
  async create(@Body() createCreatriceDto: CreateCreatriceDto) {
    return this.creatriceService.create(createCreatriceDto);
  }

  @Get()
  findAll(@Query() filters: QueryCreatrice) {
    return this.creatriceService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.creatriceService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCreatriceDto: UpdateCreatriceDto,
  ) {
    return this.creatriceService.update(id, updateCreatriceDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.creatriceService.remove(id);
  }
}
