import { Request } from 'express';

export type Role = 'CUSTOMER' | 'ADMIN';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: UserSession;
}
