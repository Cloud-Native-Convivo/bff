import { Logger } from '@nestjs/common';
import axios from 'axios';

const APLICACION = 'bff';
const PERFIL = 'native';
const ESQUEMAS_PERMITIDOS = new Set(['http:', 'https:']);

// Las credenciales (RabbitMQ, Eureka) no se mapean: siguen solo en variables de entorno.
const MAPA_CLAVES: Record<string, string> = {
  port: 'PORT',
  'global-prefix': 'GLOBAL_PREFIX',
  'service-name': 'SERVICE_NAME',
  'proxy.timeout-ms': 'PROXY_TIMEOUT_MS',
  'rabbitmq.enabled': 'RABBITMQ_ENABLED',
  'rabbitmq.exchange': 'RABBITMQ_EXCHANGE',
};

interface RespuestaConfigServer {
  propertySources?: { source?: Record<string, unknown> }[];
}

/**
 * Completa process.env con lo servido por config-server, sin pisar variables ya definidas.
 * Precedencia: variable de entorno real > config-server > default de configuration.ts.
 * Best-effort: un config-server caído no impide el arranque.
 */
export async function cargarConfiguracionRemota(
  urlBase: string | undefined = process.env.CONFIG_SERVER_URL,
): Promise<void> {
  if (!urlBase) return;
  const logger = new Logger('ConfigServer');

  let esquema: string;
  try {
    esquema = new URL(urlBase).protocol;
  } catch {
    logger.warn('CONFIG_SERVER_URL inválida — se ignora');
    return;
  }
  if (!ESQUEMAS_PERMITIDOS.has(esquema)) {
    logger.warn(`CONFIG_SERVER_URL con esquema no permitido (${esquema}) — se ignora`);
    return;
  }

  let datos: RespuestaConfigServer;
  try {
    // El error de axios incluye la URL con credenciales: no se loguea el objeto.
    const respuesta = await axios.get<RespuestaConfigServer>(
      `${urlBase.replace(/\/+$/, '')}/${APLICACION}/${PERFIL}`,
      { timeout: 3000 },
    );
    datos = respuesta.data;
  } catch {
    logger.warn('config-server no disponible — usando configuración local');
    return;
  }

  for (const fuente of datos.propertySources ?? []) {
    for (const [clave, valor] of Object.entries(fuente.source ?? {})) {
      const variable = MAPA_CLAVES[clave];
      const texto = String(valor);
      // Spring Cloud Config no resuelve ${...}: un valor así llegaría literal, se descarta.
      if (variable && !(variable in process.env) && !texto.includes('${')) {
        process.env[variable] = texto;
      }
    }
  }
}
