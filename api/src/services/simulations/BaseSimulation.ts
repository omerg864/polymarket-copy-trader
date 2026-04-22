import {
	SimulationType,
	SimulationDailyStat,
	SimulationResult,
	TradeType,
	Trade,
} from '../../../../shared/src/types';

export interface ISimulation {
	run(
		trades: Trade[],
		mode: TradeType,
		timezone: string,
		params: any,
	): Promise<SimulationResult>;
}

export abstract class BaseSimulation {
	protected aggregateResults(
		type: SimulationType,
		mode: TradeType,
		statsByDay: Record<string, SimulationDailyStat>,
	): SimulationResult {
		const sortedDates = Object.keys(statsByDay).sort();
		let totalActPnL = 0,
			totalSimPnL = 0;
		let totalActTrades = 0,
			totalSimTrades = 0;
		let totalActWins = 0,
			totalSimWins = 0;

		for (const day of sortedDates) {
			const s = statsByDay[day];
			totalActPnL += s.actPnL;
			totalSimPnL += s.simPnL;
			totalActTrades += s.actTrades;
			totalSimTrades += s.simTrades;
			totalActWins += s.actWins;
			totalSimWins += s.simWins;
		}

		const daily = sortedDates.map((day) => statsByDay[day]);

		return {
			type,
			mode,
			overall: {
				totalActPnL,
				totalSimPnL,
				totalActTrades,
				totalSimTrades,
				totalActWins,
				totalSimWins,
				actWR:
					totalActTrades > 0
						? (totalActWins / totalActTrades) * 100
						: 0,
				simWR:
					totalSimTrades > 0
						? (totalSimWins / totalSimTrades) * 100
						: 0,
				avgDailyActPnL:
					sortedDates.length > 0
						? totalActPnL / sortedDates.length
						: 0,
				avgDailySimPnL:
					sortedDates.length > 0
						? totalSimPnL / sortedDates.length
						: 0,
				impact: totalSimPnL - totalActPnL,
			},
			daily,
		};
	}
}
