import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnimalController } from '../controllers/animal.controller';
import { AnimalEntity } from '../../infrastructure/database/mysql/entities/animal.entity';
import { AnimalImageEntity } from '../../infrastructure/database/mysql/entities/animal-image.entity';
import { AnimalRepository } from '../../infrastructure/database/mysql/repositories/animal.repository';
import { CreateAnimalUseCase } from '../../application/use-cases/animal/create-animal.use-case';
import { AwsModule } from '../../infrastructure/services/aws/aws.module';

import { AdoptionModule } from './adoption.module';
import { UpdateAnimalUseCase } from '../../application/use-cases/animal/update-animal.use-case';
import { DeleteAnimalUseCase } from '../../application/use-cases/animal/delete-animal.use-case';
import { GetAnimalsUseCase } from '../../application/use-cases/animal/get-animals.use-case';
import { GetAnimalUseCase } from '../../application/use-cases/animal/get-animal.use-case';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnimalEntity, AnimalImageEntity]),
    AwsModule,
    forwardRef(() => AdoptionModule)
  ],
  controllers: [AnimalController],
  providers: [
    AnimalRepository,
    CreateAnimalUseCase,
    UpdateAnimalUseCase,
    GetAnimalUseCase,
    GetAnimalsUseCase,
    DeleteAnimalUseCase,
  ],
  exports: [
    AnimalRepository,
  ],
})
export class AnimalModule {}