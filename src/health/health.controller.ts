import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsPublic } from '../auth/public.decorator';

interface HealthResponse {
  status: 'ok';
  service: string;
  uptime: number;
  timestamp: string;
}

@IsPublic()
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: this.config.get<string>('serviceName') ?? 'convivo-bff',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
