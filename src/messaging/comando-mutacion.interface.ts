export interface ComandoMutacion<T = unknown> {
  ticket_id: string;
  modulo: 'ESPACIOS' | 'GASTOS' | 'CONDOMINIOS';
  accion: string;
  usuario_id: string;
  usuario_email?: string;
  rol: string;
  /** Solo en editar/eliminar espacio: el consumidor los lee de primer nivel, no del payload. */
  espacio_id?: number;
  condominio_id?: number;
  path: string;
  metodo: string;
  payload: T;
  timestamp: string;
  correlation_id?: string;
}
