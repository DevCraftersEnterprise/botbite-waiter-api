import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class EnvironmentVariables {
    @IsNumber()
    @Type(() => Number)
    PORT: number;

    @IsString()
    OPENAI_API_KEY: string;

    @IsString()
    TWILIO_AUTH_TOKEN: string;

    @IsString()
    TWILIO_ACCOUNT_SID: string;

    @IsString()
    JWT_SECRET: string;

    @IsString()
    CLOUDINARY_CLOUD_NAME: string;

    @IsString()
    CLOUDINARY_API_KEY: string;

    @IsString()
    CLOUDINARY_API_SECRET: string;
}