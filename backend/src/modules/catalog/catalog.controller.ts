import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CatalogService } from './catalog.service';
import { CreateBranchDto, CreateProgramDto, CreateSubjectDto } from './dto/catalog.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('programs')
  listPrograms() {
    return this.catalog.listPrograms();
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('programs')
  createProgram(@Body() dto: CreateProgramDto) {
    return this.catalog.createProgram(dto);
  }

  @Get('subjects')
  listSubjects() {
    return this.catalog.listSubjects();
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.catalog.createSubject(dto);
  }

  @Get('branches')
  listBranches() {
    return this.catalog.listBranches();
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto) {
    return this.catalog.createBranch(dto);
  }
}
