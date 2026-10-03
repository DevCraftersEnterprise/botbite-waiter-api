import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { errorMessage } from '@/common/utils/error.util';

type TranslationTree = { [key: string]: string | TranslationTree };

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly translation: Record<string, TranslationTree> = {};

  constructor() {
    this.loadTranslations();
  }

  private loadTranslations() {
    const langs = ['es', 'en'];

    for (const lang of langs) {
      const filePath = path.join(
        __dirname,
        '..',
        '..',
        'i18n',
        lang,
        'translation.json',
      );

      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        this.translation[lang] = JSON.parse(data) as TranslationTree;
      } catch (err) {
        this.logger.warn(
          `No se pudieron cargar las traducciones de '${lang}': ${errorMessage(err)}`,
        );
      }
    }
  }

  translate(
    key: string,
    lang: string = 'es',
    variables?: Record<string, string>,
  ): string {
    // Idiomas sin archivo propio caen a español en lugar de devolver la clave.
    let result: string | TranslationTree | undefined =
      this.translation[lang] ?? this.translation.es;

    for (const part of key.split('.')) {
      if (result && typeof result === 'object' && result[part]) {
        result = result[part];
      } else {
        return key;
      }
    }

    if (typeof result !== 'string') return key;

    if (variables) {
      for (const [varName, value] of Object.entries(variables)) {
        const pattern = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
        result = result.replace(pattern, value);
      }
    }

    return result;
  }
}
