export interface ComandoMutacion<T = unknown> {
  ticket_id: string;
  modulo: 'ESPACIOS' | 'GASTOS' | 'CONDOMINIOS';
  accion: string;
  usuario_id: string;
  rol: string;
  path: string;
  metodo: string;
  payload: T;
  timestamp: string;
  correlation_id?: string;
}
