import type { Request, Response } from 'express';
import { simulationService } from '../services/simulationService';
import { SimulationParams } from '../../../shared/src/types';

/**
 * Run a historical simulation based on provided parameters.
 */
export async function runSimulation(
	req: Request,
	res: Response,
): Promise<void> {
	const params = req.body as SimulationParams;

	if (!params.type || !params.mode) {
		res.status(400).json({
			error: 'Simulation type and mode are required',
		});
		return;
	}

	try {
		const result = await simulationService.runSimulation(params);
		res.json(result);
	} catch (error: any) {
		console.error(`Simulation failed: ${error.message}`);
		res.status(500).json({
			error: error.message || 'Internal server error during simulation',
		});
	}
}

/**
 * List available simulations and their descriptions.
 */
export function getAvailableSimulations(_req: Request, res: Response): void {
	res.json([
		{
			id: 'time_windows',
			name: 'Time Windows',
			description:
				'Simulates trading only during specific high-performance time windows.',
			params: [
				{
					name: 'excludedTimeWindows',
					label: 'Exclusion Windows',
					type: 'windows',
					default: [],
				},
			],
		},
		{
			id: 'daily_tp',
			name: 'Daily Take Profit',
			description:
				'Simulates stopping trading for the day once a profit threshold is reached.',
			params: [
				{
					name: 'threshold',
					label: 'TP Threshold ($)',
					type: 'number',
					default: 160,
				},
			],
		},
	]);
}
