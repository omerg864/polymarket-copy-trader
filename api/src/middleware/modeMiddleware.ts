import { TradeType } from '../../../shared/src/types';
import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to extract the trade mode from the 'x-mode' header.
 * Defaults to 'demo' if the header is missing or invalid.
 */
export function modeMiddleware(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const modeHeader = req.header('x-mode');

	if (modeHeader === TradeType.LIVE || modeHeader === 'live') {
		req.mode = TradeType.LIVE;
	} else if (modeHeader === TradeType.TEST || modeHeader === 'test') {
		req.mode = TradeType.TEST;
	} else {
		req.mode = TradeType.DEMO;
	}

	// console.log(`[API] Mode set to: ${(req as any).mode} (header: ${modeHeader})`);
	next();
}
