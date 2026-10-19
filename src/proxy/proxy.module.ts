import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuthModule } from "../auth/auth.module";
import { GastosProxyController } from "./gastos-proxy.controller";
import { EspaciosProxyController } from "./espacios-proxy.controller";
import { CondominiosProxyController } from "./condominios-proxy.controller";
import { PanelController } from "./panel.controller";
import { ProxyService } from "./proxy.service";
import { EurekaDiscoveryService } from "./eureka-discovery.service";

import { JobsProxyController } from "./jobs-proxy.controller";
import { AsyncMutationService } from "./async-mutation.service";
import { GastosPdfProxyController } from "./gastos-pdf-proxy.controller";

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [
    GastosProxyController,
    EspaciosProxyController,
    CondominiosProxyController,
    PanelController,
    JobsProxyController,
    GastosPdfProxyController,
  ],
  providers: [ProxyService, EurekaDiscoveryService, AsyncMutationService],
  exports: [EurekaDiscoveryService, AsyncMutationService, ProxyService],
})
export class ProxyModule {}
