import { Controller, Get } from '@nestjs/common';

/** Public liveness route — no tenant data, no DB dependency. */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
