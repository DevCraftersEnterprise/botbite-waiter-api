import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Lo consulta Render cada pocos segundos (Health Check Path) y el panel
   * cuando no tiene conexión en vivo. No toca la base: si lo hiciera, Neon
   * nunca se apagaría y se pagaría cómputo las 24 horas (issue #46). Solo
   * dice que el proceso responde.
   */
  @Get()
  @SkipThrottle()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Con la base: para revisarla a mano o desde un monitor que la consulte cada
   * varios minutos. No lo pongas como Health Check Path de Render.
   */
  @Get('db')
  async databaseCheck() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
