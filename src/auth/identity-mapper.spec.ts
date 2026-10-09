import type { ConfigService } from '@nestjs/config';
import { IdentityMapper } from './identity-mapper';

function mapper(config: Record<string, unknown> = {}): IdentityMapper {
  return new IdentityMapper({ get: (k: string) => config[k] } as unknown as ConfigService);
}

describe('IdentityMapper', () => {
  it('Entra ID: usa oid como sub de respaldo y mapea roles desde arreglo', () => {
    const u = mapper({ claimMap: { 'Convivo.Admin': 'admin' } }).toUsuario({
      oid: 'oid-1',
      roles: ['Convivo.Admin', 42],
    });
    expect(u.sub).toBe('oid-1');
    expect(u.oid).toBe('oid-1');
    // 'admin' se normaliza a 'administrador'; el 42 (no string) se descarta
    expect(u.roles).toEqual(['administrador']);
  });

  it('Entra ID: lee roles desde string con separador configurado', () => {
    const u = mapper({ claimDeRol: 'grupos', claimSeparador: ';' }).toUsuario({
      sub: 's-1',
      grupos: 'residente;conserje',
    });
    expect(u.sub).toBe('s-1');
    expect(u.oid).toBe('s-1');
    expect(u.roles).toContain('residente');
  });

  it('Entra ID: claim de rol ausente o con otro tipo da lista vacía', () => {
    expect(mapper().toUsuario({ sub: 's', roles: { x: 1 } }).roles).toEqual([]);
  });

  it('Cognito: name cae a given_name y el rol es siempre residente', () => {
    const u = mapper().toUsuarioCognito({ sub: 'c-1', given_name: 'Ana', email: 'a@b.cl' });
    expect(u.name).toBe('Ana');
    expect(u.correo).toBe('a@b.cl');
    expect(u.preferredUsername).toBe('a@b.cl');
    expect(u.roles).toEqual(['residente']);
    expect(mapper().toUsuarioCognito({ sub: { raro: true } }).sub).toBe('');
  });

  it('Cognito: usa username como preferredUsername si correo no viene en el token', () => {
    const u = mapper().toUsuarioCognito({ sub: 'c-1', username: 'ana.cognito' });
    expect(u.preferredUsername).toBe('ana.cognito');
    expect(u.correo).toBeUndefined();
  });
});
