import { DateTime } from 'luxon';
import { 
    SimulationType, 
    SimulationParams, 
    SimulationResult, 
    SimulationDailyStat,
    TradeType
} from '../../../shared/src/types';
import { TradeModel } from '../models/Trade';
import { getStrategyConfig } from './strategyConfig';

class SimulationService {
    async runSimulation(params: SimulationParams): Promise<SimulationResult> {
        const { type, mode, params: simParams } = params;
        const sc = await getStrategyConfig();
        const timezone = sc.timezone || 'Asia/Jerusalem';

        const trades = await TradeModel.find({
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

        if (type === SimulationType.TIME_WINDOWS) {
            return this.simulateTimeWindows(trades, mode, timezone, simParams);
        } else if (type === SimulationType.DAILY_TP) {
            return this.simulateDailyTP(trades, mode, timezone, simParams);
        }

        throw new Error(`Unsupported simulation type: ${type}`);
    }

    private simulateTimeWindows(
        trades: any[], 
        mode: TradeType, 
        timezone: string, 
        params: any
    ): SimulationResult {
        const statsByDay: Record<string, SimulationDailyStat> = {};

        const getDateStr = (iso: string) =>
            DateTime.fromISO(iso).setZone(timezone).toISODate() || 'unknown';

        const isAllowedTime = (iso: string) => {
            const dt = DateTime.fromISO(iso).setZone(timezone);
            const hour = dt.hour;
            
            // Default windows from script
            // Window 1: 00:00 to 01:59 (Hours 0 and 1)
            if (hour >= 0 && hour <= 1) return true;
            // Window 2: 11:00 to 23:59 (Hours 11 through 23)
            if (hour >= 11 && hour <= 23) return true;
            
            return false;
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

        return this.aggregateResults(SimulationType.TIME_WINDOWS, mode, statsByDay);
    }

    private simulateDailyTP(
        trades: any[], 
        mode: TradeType, 
        timezone: string, 
        params: any
    ): SimulationResult {
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
                    tradeId: t.tradeId,
                });
            }
            if (t.closedAt) {
                allEvents.push({
                    type: 'CLOSE',
                    time: new Date(t.closedAt).getTime(),
                    dateStr: getDateStr(t.closedAt),
                    tradeId: t.tradeId,
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

            if (executedTradeIds.has(t.tradeId)) {
                statsByDay[day].simPnL += t.pnl || 0;
                statsByDay[day].simTrades++;
                if ((t.pnl || 0) >= 0) statsByDay[day].simWins++;
            } else {
                const entryDay = getDateStr(t.enteredAt);
                if (statsByDay[entryDay]) {
                    statsByDay[entryDay].tpHit = true;
                } else {
                    // If trade was skipped but the day isn't in statsByDay yet, initialize it
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

    private aggregateResults(
        type: SimulationType, 
        mode: TradeType, 
        statsByDay: Record<string, SimulationDailyStat>
    ): SimulationResult {
        const sortedDates = Object.keys(statsByDay).sort();
        let totalActPnL = 0, totalSimPnL = 0;
        let totalActTrades = 0, totalSimTrades = 0;
        let totalActWins = 0, totalSimWins = 0;

        for (const day of sortedDates) {
            const s = statsByDay[day];
            totalActPnL += s.actPnL;
            totalSimPnL += s.simPnL;
            totalActTrades += s.actTrades;
            totalSimTrades += s.simTrades;
            totalActWins += s.actWins;
            totalSimWins += s.simWins;
        }

        const daily = sortedDates.map(day => statsByDay[day]);

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
                actWR: totalActTrades > 0 ? (totalActWins / totalActTrades) * 100 : 0,
                simWR: totalSimTrades > 0 ? (totalSimWins / totalSimTrades) * 100 : 0,
                avgDailyActPnL: sortedDates.length > 0 ? totalActPnL / sortedDates.length : 0,
                avgDailySimPnL: sortedDates.length > 0 ? totalSimPnL / sortedDates.length : 0,
                impact: totalSimPnL - totalActPnL,
            },
            daily,
        };
    }
}

export const simulationService = new SimulationService();
export default simulationService;
