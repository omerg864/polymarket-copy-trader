import type { NextFunction, Request, Response } from 'express';
import config from '../config';

export type AuthRole = 'admin' | 'readonly';

declare global {
	namespace Express {
		interface Request {
			authRole?: AuthRole;
		}
	}
}

export function resolveRole(password: string): AuthRole | null {
	if (config.adminPassword && password === config.adminPassword)
		return 'admin';
	if (config.readonlyPassword && password === config.readonlyPassword)
		return 'readonly';
	// If no passwords configured, allow as admin
	if (!config.adminPassword && !config.readonlyPassword) return 'admin';
	return null;
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
	if (!config.adminPassword && !config.readonlyPassword) {
		req.authRole = 'admin';
		return next();
	}

	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		res.status(401).json({ error: 'Authentication required' });
		return;
	}

	const token = authHeader.slice(7);
	const role = resolveRole(token);
	if (!role) {
		res.status(401).json({ error: 'Invalid password' });
		return;
	}

	req.authRole = role;
	next();
}

export function adminGuard(req: Request, res: Response, next: NextFunction) {
	if (req.authRole !== 'admin') {
		res.status(403).json({ error: 'Admin access required' });
		return;
	}
	next();
}
