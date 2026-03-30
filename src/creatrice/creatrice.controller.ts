import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CreatriceService } from './creatrice.service';
import { CreateCreatriceDto } from './dto/create-creatrice.dto';
import { UpdateCreatriceDto } from './dto/update-creatrice.dto';

@Controller('creatrice')
export class CreatriceController {
  constructor(private readonly creatriceService: CreatriceService) {}

  @Post()
  create(@Body() createCreatriceDto: CreateCreatriceDto) {
    return this.creatriceService.create(createCreatriceDto);
  }

  @Get()
  findAll() {
    return this.creatriceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.creatriceService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCreatriceDto: UpdateCreatriceDto) {
    return this.creatriceService.update(+id, updateCreatriceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.creatriceService.remove(+id);
  }
}
