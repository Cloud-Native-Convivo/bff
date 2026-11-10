import axios from 'axios';
import { cargarConfiguracionRemota } from './cargar-configuracion-remota';

jest.mock('axios');
const axiosGet = axios.get as jest.Mock;

const VARIABLES = ['PORT', 'GLOBAL_PREFIX', 'RABBITMQ_ENABLED', 'RABBITMQ_URLS'];

describe('cargarConfiguracionRemota', () => {
  beforeEach(() => {
    axiosGet.mockReset();
    for (const v of VARIABLES) delete process.env[v];
  });

  it('no hace nada si no hay CONFIG_SERVER_URL', async () => {
    await cargarConfiguracionRemota(undefined);
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('rechaza esquemas no permitidos sin hacer la petición', async () => {
    await cargarConfiguracionRemota('file:///etc/passwd');
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('no lanza si el config-server está caído', async () => {
    axiosGet.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(cargarConfiguracionRemota('http://u:p@config:8888')).resolves.toBeUndefined();
  });

  it('completa solo ausentes, ignora placeholders y claves no mapeadas', async () => {
    process.env.GLOBAL_PREFIX = 'ya-definido';
    axiosGet.mockResolvedValue({
      data: {
        propertySources: [
          {
            source: {
              port: 3999,
              'global-prefix': 'remoto',
              'rabbitmq.enabled': true,
              'rabbitmq.urls': 'amqp://${RABBITMQ_USER:guest}@localhost',
              'eureka.url': 'http://x',
            },
          },
        ],
      },
    });

    await cargarConfiguracionRemota('http://u:p@config:8888/');

    expect(axiosGet.mock.calls[0][0]).toBe('http://u:p@config:8888/bff/native');
    expect(process.env.PORT).toBe('3999'); // completa la ausente
    expect(process.env.GLOBAL_PREFIX).toBe('ya-definido'); // no la pisa
    expect(process.env.RABBITMQ_ENABLED).toBe('true');
    expect(process.env.RABBITMQ_URLS).toBeUndefined(); // credenciales y placeholders nunca
  });
});
