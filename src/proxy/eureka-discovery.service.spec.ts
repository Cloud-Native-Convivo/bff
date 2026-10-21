import type { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EurekaDiscoveryService } from './eureka-discovery.service';

jest.mock('axios');
const axiosGet = axios.get as jest.Mock;

function servicio(eurekaUrl?: string): EurekaDiscoveryService {
  return new EurekaDiscoveryService({ get: () => eurekaUrl } as unknown as ConfigService);
}

describe('EurekaDiscoveryService.resolveServiceUrl', () => {
  beforeEach(() => axiosGet.mockReset());

  it('usa el fallback si no hay eurekaUrl', async () => {
    await expect(servicio().resolveServiceUrl('MS-X', 'http://fallback')).resolves.toBe('http://fallback');
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('limpia slashes finales de eurekaUrl y de homePageUrl', async () => {
    axiosGet.mockResolvedValue({ data: { application: { instance: [{ homePageUrl: 'http://ms:8082//' }] } } });
    const url = await servicio('http://eureka:8761/eureka//').resolveServiceUrl('MS-X', 'http://fallback');
    expect(url).toBe('http://ms:8082');
    expect(axiosGet.mock.calls[0][0]).toBe('http://eureka:8761/eureka/apps/MS-X');
  });

  it('arma la URL con ipAddr y puerto si no hay homePageUrl', async () => {
    axiosGet.mockResolvedValue({ data: { application: { instance: { ipAddr: '10.0.0.5', port: { $: 8083 } } } } });
    await expect(servicio('http://eureka').resolveServiceUrl('MS-Y', 'http://fallback')).resolves.toBe(
      'http://10.0.0.5:8083',
    );
  });

  it('cae al fallback si Eureka falla', async () => {
    axiosGet.mockRejectedValue(new Error('timeout'));
    await expect(servicio('http://eureka').resolveServiceUrl('MS-Z', 'http://fallback')).resolves.toBe(
      'http://fallback',
    );
  });
});
