import { Injectable } from '@nestjs/common';
import { CreateCreatriceDto } from './dto/create-creatrice.dto';
import { UpdateCreatriceDto } from './dto/update-creatrice.dto';

@Injectable()
export class CreatriceService {
  create(createCreatriceDto: CreateCreatriceDto) {
    return 'This action adds a new creatrice';
  }

  findAll() {
    return `This action returns all creatrice`;
  }

  findOne(id: string) {
    return `This action returns a #${id} creatrice`;
  }

  update(id: string, UpdateCreatriceDto: UpdateCreatriceDto) {
    return `This action updates a #${id} creatrice`;
  }

  remove(id: string) {
    return `This action removes a #${id} creatrice`;
  }
}
