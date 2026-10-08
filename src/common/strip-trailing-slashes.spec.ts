import { stripTrailingSlashes } from './strip-trailing-slashes';

describe('stripTrailingSlashes', () => {
  it.each([
    ['/api/v1/espacios///', '/api/v1/espacios'],
    ['http://ms:8082/', 'http://ms:8082'],
    ['/sin-slash', '/sin-slash'],
    ['///', ''],
    ['', ''],
    ['/a//b/', '/a//b'],
  ])('%p -> %p', (entrada, esperado) => {
    expect(stripTrailingSlashes(entrada)).toBe(esperado);
  });
});
