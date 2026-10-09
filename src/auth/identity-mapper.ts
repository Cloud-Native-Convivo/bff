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
/** Claim de texto o '' si viene ausente o con otro tipo (los claims estándar de JWT son string). */
function claimTexto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function esRol(v: string): v is Rol {
  return (
    v === 'residente' ||
    v === 'propietario' ||
    v === 'admin' ||
    v === 'administrador' ||
    v === 'conserje' ||
    v === 'comite'
  );
}

@Injectable()
export class IdentityMapper {
  constructor(private readonly config: ConfigService) {}

  toUsuario(payload: Record<string, unknown>): UsuarioAutenticado {
    const sub = claimTexto(payload.sub ?? payload.oid);
    return {
      sub,
      oid: claimTexto(payload.oid) || sub,
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

  toUsuarioCognito(payload: Record<string, unknown>): UsuarioAutenticado {
    const sub = claimTexto(payload.sub);
    const name = claimTexto(payload.name) || claimTexto(payload.given_name) || undefined;
    const correo =
      typeof payload.email === 'string' ? payload.email : undefined;
    const username =
      typeof payload.username === 'string' ? payload.username : undefined;

    return {
      sub,
      oid: sub,
      name,
      preferredUsername: correo ?? username,
      correo,
      claims: { ...payload },
      roles: ['residente'],
    };
  }

  /** Extrae y mapea los roles del claim configurado. */
  private leerRoles(payload: Record<string, unknown>): Rol[] {
    const claim = this.config.get<string>('claimDeRol');
    const separador = this.config.get<string>('claimSeparador');
    const mapeo = this.config.get<Record<string, string>>('claimMap') ?? {};
    const raw = payload[claim ?? 'roles'];

    let valores: string[] = [];
    if (Array.isArray(raw)) {
      valores = raw.filter((v): v is string => typeof v === 'string');
    } else if (typeof raw === 'string') {
      valores = raw.split(separador ?? ',');
    }

    const roles = valores
      .map((v) => mapeo[v] ?? v)
      .filter(esRol)
      .map((v) => (v === 'admin' ? 'administrador' : v));

    const rolesUnicos = [...new Set(roles)];
    if (rolesUnicos.length > 0) {
      return rolesUnicos;
    }

    // Principio de mínimo privilegio (PoLP / OWASP A01): un usuario de
    // Entra ID sin App Role asignado cae al rol de menor privilegio,
    // igual que Cognito. Nunca se eleva por configuración ni por headers.
    return ['residente'];
  }
}
