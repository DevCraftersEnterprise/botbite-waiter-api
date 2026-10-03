import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';

const DURATION = /^\d+[smhd]?$/;

export class EnvironmentVariables {
  @IsNumber()
  @Type(() => Number)
  PORT: number;

  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  TRUST_PROXY?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  FRONTEND_URL?: string;

  // Base de datos
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsNumber()
  @Type(() => Number)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsOptional()
  @IsBooleanString()
  DB_SSL?: string;

  @IsOptional()
  @IsBooleanString()
  DB_SSL_REJECT_UNAUTHORIZED?: string;

  @IsOptional()
  @IsString()
  DB_SSL_CA?: string;

  // JWT
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long' })
  JWT_SECRET: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET must be at least 32 characters long',
  })
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @Matches(DURATION)
  JWT_ACCESS_EXPIRY?: string;

  @IsOptional()
  @Matches(DURATION)
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @Matches(DURATION)
  JWT_REFRESH_EXPIRY?: string;

  // Servicios externos
  @IsString()
  @IsNotEmpty()
  OPENAI_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  TWILIO_AUTH_TOKEN: string;

  @IsString()
  @IsNotEmpty()
  TWILIO_ACCOUNT_SID: string;

  @IsOptional()
  @IsBooleanString()
  TWILIO_VALIDATE_SIGNATURE?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  TWILIO_WEBHOOK_BASE_URL?: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_CLOUD_NAME: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_SECRET: string;

  // Rate limiting
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  THROTTLE_TTL?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  THROTTLE_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  THROTTLE_LOGIN_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  RATE_LIMIT_TTL?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  RATE_LIMIT_MAX?: number;
}
