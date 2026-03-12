import { NextFunction, Request, Response } from 'express';
import config from '../config';

export const apiAuthGuard = (req: Request, res: Response, next: NextFunction) => {
	const apiPassword = req.headers['x-api-password'];

	if (!config.apiPassword || apiPassword !== config.apiPassword) {
		return res.status(401).json({ error: 'Unauthorized: Invalid API Password' });
	}

	next();
};
