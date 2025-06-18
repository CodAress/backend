import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';
  const appName = configService.get<string>('APP_NAME') || 'HairyPaws';
  const appVersion = configService.get<string>('APP_VERSION') || '1.0';

  app.setGlobalPrefix(apiPrefix);
  
  // Modificación de la configuración de Helmet para permitir Swagger UI
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  }));
  
  // Configuración CORS para permitir todas las solicitudes
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: '*'
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const formattedErrors = errors.reduce((acc, err) => {
          acc[err.property] = Object.values(err.constraints || {}).join(', ');
          return acc;
        }, {});
        console.log('Validation errors:', formattedErrors);
        return new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // Configuración actualizada de Swagger
  const config = new DocumentBuilder()
    .setTitle(`${appName} API`)
    .setDescription(`${appName} pet adoption API`)
    .setVersion(appVersion)
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  
  // Ruta para servir el documento OpenAPI como JSON
  app.use(`/${apiPrefix}/docs-json`, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });
  
  // Configuración mejorada de Swagger
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: -1,
      tryItOutEnabled: true,
      url: `http://${req => req.headers.host}/${apiPrefix}/docs-json`
    },
    customSiteTitle: `${appName} API Documentation`
  });

  // Configurar para escuchar en todas las interfaces
  await app.listen(port, '0.0.0.0');
  console.log(`Documentation: http://<server-ip>:${port}/${apiPrefix}/docs`);
}
bootstrap();