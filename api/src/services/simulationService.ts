import {
	SimulationType,
	SimulationParams,
	SimulationResult,
	Trade,
} from '../../../shared/src/types';
import { TradeModel } from '../models/Trade';
import { getStrategyConfig } from './strategyConfig';
import { TimeWindowsSimulation, DailyTPSimulation } from './simulations';

class SimulationService {
	async runSimulation(params: SimulationParams): Promise<SimulationResult> {
		const { type, mode, params: simParams } = params;
		const sc = await getStrategyConfig();
		const timezone = sc.timezone || 'Asia/Jerusalem';

		const dbTrades = await TradeModel.find({
			type: mode,
			status: {
				$in: [
					'closed_tp',
					'closed_sl',
					'closed_sell',
					'won',
					'lost',
					'closed_fct',
				],
			},
		}).lean();

		// Map database trades to Trade interface format
		const trades: Trade[] = dbTrades.map((t: any) => ({
			...t,
			id: t.tradeId,
		})) as unknown as Trade[];

		if (type === SimulationType.TIME_WINDOWS) {
			const simulation = new TimeWindowsSimulation();
			// Fallback to config if not provided in params
			const finalParams = {
				excludedTimeWindows:
					simParams.excludedTimeWindows ||
					sc.excludedTimeWindows ||
					[],
				...simParams,
			};
			return simulation.run(trades, mode, timezone, finalParams);
		} else if (type === SimulationType.DAILY_TP) {
			const simulation = new DailyTPSimulation();
			return simulation.run(trades, mode, timezone, simParams);
		}

		throw new Error(`Unsupported simulation type: ${type}`);
	}
}

export const simulationService = new SimulationService();
export default simulationService;
