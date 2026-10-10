import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GastosProxyController } from './gastos-proxy.controller';
import { EspaciosProxyController } from './espacios-proxy.controller';
import { CondominiosProxyController } from './condominios-proxy.controller';
import { PanelController } from './panel.controller';
import { ProxyService } from './proxy.service';
import { EurekaDiscoveryService } from './eureka-discovery.service';

import { JobsProxyController } from './jobs-proxy.controller';
import { AsyncMutationService } from './async-mutation.service';
import { GastosPdfProxyController } from './gastos-pdf-proxy.controller';

@Module({
  imports: [HttpModule],
  controllers: [
    GastosProxyController,
    EspaciosProxyController,
    CondominiosProxyController,
    PanelController,
    JobsProxyController,
    GastosPdfProxyController,
  ],
  providers: [ProxyService, EurekaDiscoveryService, AsyncMutationService],
  exports: [EurekaDiscoveryService, AsyncMutationService],
})
export class ProxyModule {}
