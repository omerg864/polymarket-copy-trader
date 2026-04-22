import { DateTime } from 'luxon';
import {
	SimulationType,
	SimulationDailyStat,
	SimulationResult,
	TradeType,
	Trade,
	isTimeExcluded,
} from '../../../../shared';
import { BaseSimulation, ISimulation } from './BaseSimulation';

export class TimeWindowsSimulation
	extends BaseSimulation
	implements ISimulation
{
	async run(
		trades: Trade[],
		mode: TradeType,
		timezone: string,
		params: any,
	): Promise<SimulationResult> {
		const statsByDay: Record<string, SimulationDailyStat> = {};
		const excludedTimeWindows = params.excludedTimeWindows || [];

		const getDateStr = (iso: string) =>
			DateTime.fromISO(iso).setZone(timezone).toISODate() || 'unknown';

		const isAllowedTime = (iso: string) => {
			if (excludedTimeWindows.length === 0) return true;

			const dt = DateTime.fromISO(iso).setZone(timezone);
			for (const window of excludedTimeWindows) {
				if (isTimeExcluded(dt, window)) return false;
			}
			return true;
		};

		for (const t of trades) {
			const entryDate = t.enteredAt;
			if (!entryDate) continue;

			const day = getDateStr(t.closedAt || entryDate);
			if (!statsByDay[day]) {
				statsByDay[day] = {
					date: day,
					actPnL: 0,
					actWins: 0,
					actTrades: 0,
					simPnL: 0,
					simWins: 0,
					simTrades: 0,
				};
			}

			statsByDay[day].actPnL += t.pnl || 0;
			statsByDay[day].actTrades++;
			if ((t.pnl || 0) >= 0) statsByDay[day].actWins++;

			if (isAllowedTime(entryDate)) {
				statsByDay[day].simPnL += t.pnl || 0;
				statsByDay[day].simTrades++;
				if ((t.pnl || 0) >= 0) statsByDay[day].simWins++;
			}
		}

		return this.aggregateResults(
			SimulationType.TIME_WINDOWS,
			mode,
			statsByDay,
		);
	}
}
