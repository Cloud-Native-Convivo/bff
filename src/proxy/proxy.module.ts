import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GastosProxyController } from './gastos-proxy.controller';
import { EspaciosProxyController } from './espacios-proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  imports: [HttpModule],
  controllers: [GastosProxyController, EspaciosProxyController],
  providers: [ProxyService],
})
export class ProxyModule {}
