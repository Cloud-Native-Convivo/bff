import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Rol, UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

/**
 * Normaliza el payload del JWT validado de Entra ID a una identidad
 * tipada del BFF.
 *
 * La lectura de roles es CONFIGURABLE a través de variables de entorno
 * (CLAIM_DE_ROL, CLAIM_SEPARADOR y CLAIM_MAPEO) porque todavía no está
 * definido el claim/App Role final de Entra ID.
 */
@Injectable()
export class IdentityMapper {
  constructor(private readonly config: ConfigService) {}

  toUsuario(payload: Record<string, unknown>): UsuarioAutenticado {
    return {
      oid: String(payload.oid),
      name: typeof payload.name === 'string' ? payload.name : undefined,
      preferredUsername:
        typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : undefined,
      correo:
        typeof payload.email === 'string' ? payload.email : undefined,
      claims: { ...payload },
      roles: this.leerRoles(payload),
    };
  }

  /** Extrae y mapea los roles del claim configurado. */
  private leerRoles(payload: Record<string, unknown>): Rol[] {
    const claim = this.config.get<string>('claimDeRol');
    const separador = this.config.get<string>('claimSeparador');
    const mapeo = this.config.get<Record<string, string>>('claimMap') ?? {};
    const raw = payload[claim ?? 'roles'];

    const valores = Array.isArray(raw)
      ? (raw as unknown[]).map(String)
      : typeof raw === 'string'
        ? raw.split(separador ?? ',')
        : [];

    const roles = valores
      .map((v) => mapeo[v] ?? v)
      .filter((v): v is Rol =>
        v === 'administrador' || v === 'conserje' || v === 'comite',
      );

    return [...new Set(roles)];
  }
}
