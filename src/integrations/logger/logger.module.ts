import { SeqLoggerModule } from '@jasonsoft/nestjs-seq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from '@/integrations/logger/logging.interceptor';
import type { EnvConfig } from '@/shared/config';

@Module({
  imports: [
    SeqLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        serverUrl: config.get('SEQ_SERVER_URL'),
        apiKey: config.get('SEQ_API_KEY'),
        extendMetaProperties: {
          serviceName: config.get('SEQ_SERVICE_NAME'),
        },
      }),
    }),
  ],
  providers: [LoggingInterceptor],
  exports: [LoggingInterceptor],
})
export class LoggerModule {}
