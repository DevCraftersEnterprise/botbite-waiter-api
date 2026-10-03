import { Module } from '@nestjs/common';
import { TranslationService } from '@/common/services/translation.service';
// import { CacheService } from './services/cache.service'; // ⚠️ Cache deshabilitado
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    TranslationService,
    // CacheService, // ⚠️ Cache deshabilitado
  ],
  exports: [
    TranslationService,
    // CacheService, // ⚠️ Cache deshabilitado
  ],
})
export class CommonModule {}
