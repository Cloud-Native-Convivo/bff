export interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
}
