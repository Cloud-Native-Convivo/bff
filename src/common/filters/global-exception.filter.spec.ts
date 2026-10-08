import { BadRequestException, HttpException, type ArgumentsHost } from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { GlobalExceptionFilter } from './global-exception.filter';

function ejecutar(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ id: 'req-1', method: 'GET', url: '/x' }),
    }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(exception, host);
  return json.mock.calls[0][0];
}

function errorAxios(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fallo', 'ERR', config, null, { status, statusText: '', headers: {}, config, data });
}

describe('GlobalExceptionFilter con errores propios', () => {
  it('HttpException con cuerpo de texto', () => {
    const cuerpo = ejecutar(new HttpException('Prohibido', 403));
    expect(cuerpo).toMatchObject({ statusCode: 403, code: 'FORBIDDEN', message: 'Prohibido', requestId: 'req-1' });
  });

  it('HttpException de validación une los mensajes', () => {
    expect(ejecutar(new BadRequestException(['campo a', 'campo b'])).message).toBe('campo a, campo b');
  });

  it('error no HTTP responde 500 genérico sin filtrar el detalle', () => {
    const cuerpo = ejecutar(new Error('secreto interno'));
    expect(cuerpo).toMatchObject({ statusCode: 500, message: 'Error interno del servidor' });
  });
});

describe('GlobalExceptionFilter con errores del downstream', () => {
  it('usa detail cuando viene como arreglo (validación FastAPI)', () => {
    expect(ejecutar(errorAxios(422, { detail: ['a', 'b'] })).message).toBe('a, b');
  });

  it('usa detail de texto', () => {
    expect(ejecutar(errorAxios(404, { detail: 'No existe' })).message).toBe('No existe');
  });

  it('serializa detail no textual en vez de "[object Object]"', () => {
    expect(ejecutar(errorAxios(409, { detail: { campo: 'x' } })).message).toBe('{"campo":"x"}');
  });

  it('sin respuesta del downstream responde 502 sin filtrar host interno', () => {
    const cuerpo = ejecutar(new AxiosError('connect ECONNREFUSED 10.0.0.5:8082'));
    expect(cuerpo.statusCode).toBe(502);
    expect(cuerpo.message).toBe('Servicio no disponible temporalmente');
  });
});
