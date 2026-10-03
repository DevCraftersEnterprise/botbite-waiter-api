import { Module } from '@nestjs/common';
import { OpenAIService } from '@/modules/openai/openai.service';

@Module({
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
