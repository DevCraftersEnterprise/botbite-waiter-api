import { UserResponseSanitized } from '@/modules/users/interfaces/user-response-sanitized.interface';

export interface LoginResponse {
  message: string;
  access_token: string;
  refresh_token: string;
}

export interface RefreshTokenResponse {
  user: UserResponseSanitized;
  access_token: string;
  refresh_token: string;
  accessToken: string;
  refreshToken: string;
}
