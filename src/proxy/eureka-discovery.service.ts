import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { stripTrailingSlashes } from '../common/strip-trailing-slashes';

interface CacheEntry {
  url: string;
  expiresAt: number;
}

@Injectable()
export class EurekaDiscoveryService {
  private readonly logger = new Logger(EurekaDiscoveryService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 30_000;

  constructor(private readonly config: ConfigService) {}

  async resolveServiceUrl(appName: string, fallbackUrl: string): Promise<string> {
    const cached = this.cache.get(appName);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.url;
    }

    const eurekaUrl = this.config.get<string>('eurekaUrl');
    if (!eurekaUrl) {
      return fallbackUrl;
    }

    try {
      const cleanEureka = stripTrailingSlashes(eurekaUrl);
      const response = await axios.get(`${cleanEureka}/apps/${appName}`, {
        headers: { Accept: 'application/json' },
        timeout: 1500,
      });

      const instances = response.data?.application?.instance;
      const instance = Array.isArray(instances) ? instances[0] : instances;

      if (instance) {
        const homePageUrl: string | undefined = instance.homePageUrl;
        const ipAddr: string | undefined = instance.ipAddr;
        const portObj = instance.port;
        const portNumber = typeof portObj === 'object' ? portObj['$'] : portObj;

        let resolvedUrl = homePageUrl ? stripTrailingSlashes(homePageUrl) : null;
        if (!resolvedUrl && ipAddr && portNumber) {
          resolvedUrl = `http://${ipAddr}:${portNumber}`;
        }

        if (resolvedUrl) {
          this.cache.set(appName, {
            url: resolvedUrl,
            expiresAt: Date.now() + this.cacheTtlMs,
          });
          return resolvedUrl;
        }
      }
    } catch {
      this.logger.debug(
        `Eureka no disponible o servicio ${appName} no registrado — usando fallback: ${fallbackUrl}`,
      );
    }

    return fallbackUrl;
  }
}
