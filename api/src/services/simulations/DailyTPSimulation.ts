import { DateTime } from 'luxon';
import {
	SimulationType,
	SimulationDailyStat,
	SimulationResult,
	TradeType,
	Trade,
} from '../../../../shared';
import { BaseSimulation, ISimulation } from './BaseSimulation';

export class DailyTPSimulation extends BaseSimulation implements ISimulation {
	async run(
		trades: Trade[],
		mode: TradeType,
		timezone: string,
		params: any,
	): Promise<SimulationResult> {
		const dailyTPThreshold = params.threshold || 160;
		const executedTradeIds = new Set<string>();
		const dailyRealizedPnL: Record<string, number> = {};

		const getDateStr = (iso: string) =>
			DateTime.fromISO(iso).setZone(timezone).toISODate() || 'unknown';

		const allEvents: any[] = [];
		for (const t of trades) {
			if (t.enteredAt) {
				allEvents.push({
					type: 'OPEN',
					time: new Date(t.enteredAt).getTime(),
					dateStr: getDateStr(t.enteredAt),
					tradeId: t.id,
				});
			}
			if (t.closedAt) {
				allEvents.push({
					type: 'CLOSE',
					time: new Date(t.closedAt).getTime(),
					dateStr: getDateStr(t.closedAt),
					tradeId: t.id,
					pnl: t.pnl || 0,
				});
			}
		}

		allEvents.sort((a, b) => {
			if (a.time !== b.time) return a.time - b.time;
			return a.type === 'CLOSE' ? -1 : 1;
		});

		for (const e of allEvents) {
			const day = e.dateStr;
			if (dailyRealizedPnL[day] === undefined) dailyRealizedPnL[day] = 0;

			if (e.type === 'OPEN') {
				if (dailyRealizedPnL[day] < dailyTPThreshold) {
					executedTradeIds.add(e.tradeId);
				}
			} else {
				if (executedTradeIds.has(e.tradeId)) {
					dailyRealizedPnL[day] += e.pnl;
				}
			}
		}

		const statsByDay: Record<string, SimulationDailyStat> = {};
		for (const t of trades) {
			const day = getDateStr(t.closedAt || t.enteredAt);
			if (!statsByDay[day]) {
				statsByDay[day] = {
					date: day,
					actPnL: 0,
					actWins: 0,
					actTrades: 0,
					simPnL: 0,
					simWins: 0,
					simTrades: 0,
					tpHit: false,
				};
			}

			statsByDay[day].actPnL += t.pnl || 0;
			statsByDay[day].actTrades++;
			if ((t.pnl || 0) >= 0) statsByDay[day].actWins++;

			if (executedTradeIds.has(t.id)) {
				statsByDay[day].simPnL += t.pnl || 0;
				statsByDay[day].simTrades++;
				if ((t.pnl || 0) >= 0) statsByDay[day].simWins++;
			} else {
				const entryDay = getDateStr(t.enteredAt);
				if (statsByDay[entryDay]) {
					statsByDay[entryDay].tpHit = true;
				} else {
					statsByDay[entryDay] = {
						date: entryDay,
						actPnL: 0,
						actWins: 0,
						actTrades: 0,
						simPnL: 0,
						simWins: 0,
						simTrades: 0,
						tpHit: true,
					};
				}
			}
		}

		return this.aggregateResults(SimulationType.DAILY_TP, mode, statsByDay);
	}
}
