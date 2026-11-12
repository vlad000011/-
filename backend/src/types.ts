import { Request } from "express";
export type AuthUser = { id: string; email: string; roles: string[] };
export interface AuthRequest extends Request { user?: AuthUser }
