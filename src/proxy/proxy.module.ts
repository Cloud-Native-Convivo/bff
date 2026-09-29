import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GastosProxyController } from './gastos-proxy.controller';
import { EspaciosProxyController } from './espacios-proxy.controller';
import { PanelController } from './panel.controller';
import { ProxyService } from './proxy.service';
import { EurekaDiscoveryService } from './eureka-discovery.service';

@Module({
  imports: [HttpModule],
  controllers: [GastosProxyController, EspaciosProxyController, PanelController],
  providers: [ProxyService, EurekaDiscoveryService],
  exports: [EurekaDiscoveryService],
})
export class ProxyModule {}
