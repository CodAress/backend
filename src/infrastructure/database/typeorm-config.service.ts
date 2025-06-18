import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { join } from 'path';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'mysql',
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      username: this.configService.get<string>('DB_USERNAME'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_DATABASE'),
      entities: [join(__dirname, 'mysql/entities/**/*.entity{.ts,.js}')],
      migrations: [join(__dirname, 'mysql/migrations/**/*{.ts,.js}')],
      synchronize: this.configService.get<boolean>('DB_SYNCHRONIZE'),
      logging: this.configService.get<string>('NODE_ENV') === 'development',
      charset: 'utf8mb4',
      timezone: '+00:00',
      ssl: {
      rejectUnauthorized: true,
      },
      extra: {
        ssl: {
          rejectUnauthorized: true,
        }
      }
    };
  }
}