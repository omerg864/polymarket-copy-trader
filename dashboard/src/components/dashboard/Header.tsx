import {
	getAuthRole,
	useConfig,
	useResetBot,
	useRedisStats,
	useSummary,
	useToggleStop,
	useTradeHistory,
	useNotificationConfig,
} from '@/hooks/use-api';
import { useMemoizedFn } from 'ahooks';
import { saveAs } from 'file-saver';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { ActionsDropdown } from './ActionsDropdown';
import { NotificationConfigDialog } from './NotificationConfigDialog';
import { StrategyConfigDialog } from './StrategyConfigDialog';
import { StartTimeDialog } from './StartTimeDialog';
import RedisStats from './RedisStats';
import MongoStats from './MongoStats';
import { formatBtcPrice, formatGlobalDateTime } from '@/lib/utils';

export function Header() {
	const { data: summary, refetch: refetchSummary } = useSummary();
	const { data: history } = useTradeHistory();
	const { data: config, refetch: refetchConfig } = useConfig();
	const { data: notificationConfig, refetch: refetchNotificationConfig } =
		useNotificationConfig();
	const toggleStop = useToggleStop();
	const { refetch: refetchRedisStats } = useRedisStats();
	const resetBot = useResetBot();
	const isReadonly = getAuthRole() === 'readonly';
	const isAdmin = getAuthRole() === 'admin';

	const [configOpen, setConfigOpen] = useState(false);
	const [notificationOpen, setNotificationOpen] = useState(false);
	const [startTimeOpen, setStartTimeOpen] = useState(false);

	const handleExport = useMemoizedFn(() => {
		if (!history || !summary || !config) return;

		// 1. Trades Sheet
		const tradesData = history.map((t) => ({
			ID: t.id,
			Status: t.status,
			Direction: t.direction,
			Market: t.title,
			Shares: t.size,
			'Entry Price': t.entryPrice,
			'Exit Price': t.exitPrice ?? '',
			Cost: t.cost,
			Fee: t.fee ?? '',
			'Fee %':
				t.fee && t.cost
					? `${((t.fee / t.cost) * 100).toFixed(2)}%`
					: '',
			'P&L': t.pnl,
			'P&L Before Fee': t.fee != null ? t.pnl + t.fee : t.pnl,
			'Result Money': t.cost + t.pnl,
			'Pct Change': t.pctChange
				? `${(t.pctChange * 100).toFixed(2)}%`
				: '',
			Confidence: t.confidence
				? `${(t.confidence * 100).toFixed(1)}%`
				: '',
			'Price to Beat': t.priceToBeat ? formatBtcPrice(t.priceToBeat) : '',
			'BTC Price': t.indicators?.currentPrice ? formatBtcPrice(t.indicators?.currentPrice) : '',
			'Dist From Ref': t.indicators?.distFromRef ?? '',
			VWAP: t.indicators?.vwap ?? '',
			'VWAP Distance %': t.indicators?.vwapDistancePct ?? '',
			StochRSI: t.indicators?.stochRsi ?? '',
			MicroRSI: t.indicators?.microRsi ?? '',
			'RSI-14': t.indicators?.rsi14 ?? '',
			'EMA-3': t.indicators?.ema3 ?? '',
			'EMA-8': t.indicators?.ema8 ?? '',
			'BB Lower': t.indicators?.bbLower ?? '',
			'BB Middle': t.indicators?.bbMiddle ?? '',
			'BB Upper': t.indicators?.bbUpper ?? '',
			'BB Position %': t.indicators?.bbPosition ?? '',
			'Momentum (3m)': t.indicators?.momentum3 ?? '',
			Volatility: t.indicators?.volatility ?? '',
			'Market Start': t.startTime
				? formatGlobalDateTime(t.startTime, config?.timezone || 'Asia/Jerusalem')
				: '',
			'Market End': t.endTime ? formatGlobalDateTime(t.endTime, config?.timezone || 'Asia/Jerusalem') : '',
			'Opened At': t.enteredAt
				? formatGlobalDateTime(t.enteredAt, config?.timezone || 'Asia/Jerusalem')
				: '',
			'Closed At': t.closedAt
				? formatGlobalDateTime(t.closedAt, config?.timezone || 'Asia/Jerusalem')
				: '',
		}));
		const wsTrades = XLSX.utils.json_to_sheet(tradesData);

		// 2. Summary Sheet
		const summaryData = [
			{ Metric: 'Balance', Value: summary.balance },
			{ Metric: 'Total P&L', Value: summary.totalPnl },
			{ Metric: 'Total Trades', Value: summary.totalTrades },
			{ Metric: 'Wins', Value: summary.wins },
			{ Metric: 'Losses', Value: summary.losses },
			{ Metric: 'Win Rate', Value: `${summary.winRate}%` },
		];
		const wsSummary = XLSX.utils.json_to_sheet(summaryData);

		// 3. Config Sheet
		const configData = Object.entries(config).map(([key, value]) => ({
			Setting: key,
			Value: value,
		}));
		const wsConfig = XLSX.utils.json_to_sheet(configData);

		// Build Workbook
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, wsTrades, 'Trades');
		XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
		XLSX.utils.book_append_sheet(wb, wsConfig, 'Configuration');

		// Export
		const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
		const data = new Blob([excelBuffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		});
		saveAs(
			data,
			`polymarket-bot-export-${new Date().toISOString().split('T')[0]}.xlsx`,
		);
	});

	return (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div>
				<h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
					📊 Polymarket Trading Dashboard
				</h1>
				<p className="text-xs sm:text-sm text-zinc-500 mt-1">
					BTC 5-Minute Up/Down Markets • Auto-refreshes every 5s •{' '}
					<RedisStats /> <MongoStats />
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-2 sm:gap-4">
				<ActionsDropdown
					summary={summary}
					history={history}
					config={config}
					isReadonly={isReadonly}
					isAdmin={isAdmin}
					onToggleStop={(stopping) =>
						toggleStop.mutate(stopping, {
							onSuccess: () => refetchSummary(),
						})
					}
					onOpenAlerts={() => setNotificationOpen(true)}
					onOpenConfig={() => setConfigOpen(true)}
					onOpenStartTime={() => setStartTimeOpen(true)}
					onOpenReset={() =>
						resetBot.mutate(undefined, {
							onSuccess: () => {
								refetchRedisStats();
								refetchSummary();
							},
						})
					}
					onExport={handleExport}
					isTogglePending={toggleStop.isPending}
					isResetPending={resetBot.isPending}
				/>

				<StrategyConfigDialog
					open={configOpen}
					onOpenChange={setConfigOpen}
					config={config}
					isAdmin={isAdmin}
					refetchConfig={refetchConfig}
				/>

				<NotificationConfigDialog
					open={notificationOpen}
					onOpenChange={setNotificationOpen}
					notificationConfig={notificationConfig}
					isAdmin={isAdmin}
					refetchNotificationConfig={refetchNotificationConfig}
				/>

				<StartTimeDialog
					key={startTimeOpen ? `open-${summary?.botStartTime}` : 'closed'}
					open={startTimeOpen}
					onOpenChange={setStartTimeOpen}
					currentStartTime={summary?.botStartTime}
					onSuccess={() => {
						refetchSummary();
					}}
				/>
			</div>
		</div>
	);
}
