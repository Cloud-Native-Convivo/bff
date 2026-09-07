import { SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta como pública (no exige token JWT).
 * Ejemplo: `@Controller('health')` + `@IsPublic()`.
 */
export const IsPublic = () => SetMetadata(PUBLIC_KEY, true);
