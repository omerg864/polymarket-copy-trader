import type { NextFunction, Request, Response } from 'express';
import config from '../config';

export function authGuard(req: Request, res: Response, next: NextFunction) {
	if (!config.authPassword) {
		return next();
	}

	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		res.status(401).json({ error: 'Authentication required' });
		return;
	}

	const token = authHeader.slice(7);
	if (token !== config.authPassword) {
		res.status(401).json({ error: 'Invalid password' });
		return;
	}

	next();
}
