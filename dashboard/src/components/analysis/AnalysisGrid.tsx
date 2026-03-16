/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
	ModuleRegistry,
	type ColDef,
	type ValueFormatterParams,
	ClientSideRowModelModule,
	TextFilterModule,
	NumberFilterModule,
	DateFilterModule,
	PaginationModule,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import type { Trade } from '@/types';
import { formatDate } from '@/lib/utils';

// Register AG Grid modules
ModuleRegistry.registerModules([
	ClientSideRowModelModule,
	TextFilterModule,
	NumberFilterModule,
	DateFilterModule,
	PaginationModule,
]);

interface AnalysisGridProps {
	trades: Trade[];
}

export function AnalysisGrid({ trades }: AnalysisGridProps) {
	const columnDefs = useMemo<ColDef<Trade>[]>(
		() => [
			{
				field: 'id',
				headerName: 'ID',
				width: 100,
				hide: true,
			},
			{
				field: 'title',
				headerName: 'Market',
				width: 200,
				valueGetter: (params) =>
					params.data?.title?.replace('Bitcoin Up or Down - ', '') ||
					'',
				filter: 'agTextColumnFilter',
			},
			{
				field: 'direction',
				headerName: 'Dir',
				width: 80,
				cellRenderer: (params: any) => {
					const isUp = params.value === 'UP';
					return (
						<div
							className={
								isUp
									? 'text-emerald-400 font-bold'
									: 'text-red-400 font-bold'
							}
						>
							{params.value}
						</div>
					);
				},
			},
			{
				field: 'status',
				headerName: 'Status',
				width: 120,
			},
			{
				field: 'actualOutcome',
				headerName: 'Outcome',
				width: 100,
			},
			{
				field: 'enteredAt',
				headerName: 'Opened At',
				width: 160,
				valueFormatter: (params: ValueFormatterParams) =>
					params.value ? formatDate(params.value) : '',
				sort: 'desc',
			},
			{
				field: 'closedAt',
				headerName: 'Closed At',
				width: 160,
				valueFormatter: (params: ValueFormatterParams) =>
					params.value ? formatDate(params.value) : '',
			},
			{
				field: 'size',
				headerName: 'Shares',
				width: 100,
				type: 'numericColumn',
				valueFormatter: (params) =>
					params.value ? Number(params.value).toLocaleString() : '',
			},
			{
				field: 'cost',
				headerName: 'Cost',
				width: 100,
				type: 'numericColumn',
				valueFormatter: (params) =>
					params.value ? `$${Number(params.value).toFixed(2)}` : '',
			},
			{
				field: 'entryPrice',
				headerName: 'Entry $',
				width: 100,
				type: 'numericColumn',
				valueFormatter: (params) =>
					params.value ? `$${params.value.toFixed(3)}` : '',
			},
			{
				field: 'exitPrice',
				headerName: 'Exit $',
				width: 100,
				type: 'numericColumn',
				valueFormatter: (params) =>
					params.value ? `$${params.value.toFixed(3)}` : '',
			},
			{
				field: 'pnl',
				headerName: 'PnL',
				width: 100,
				type: 'numericColumn',
				cellRenderer: (params: any) => {
					const val = params.value;
					if (val === undefined || val === null) return '';
					return (
						<div
							className={
								val >= 0 ? 'text-emerald-400' : 'text-red-400'
							}
						>
							{val >= 0 ? '+' : ''}${val.toFixed(2)}
						</div>
					);
				},
			},
			{
				headerName: 'PnL %',
				width: 90,
				type: 'numericColumn',
				valueGetter: (params) => {
					if (!params.data || !params.data.cost) return 0;
					return (params.data.pnl / params.data.cost) * 100;
				},
				valueFormatter: (params) => {
					if (params.value === undefined) return '';
					return `${params.value.toFixed(2)}%`;
				},
				cellClassRules: {
					'text-emerald-400': 'x >= 0',
					'text-red-400': 'x < 0',
				},
			},
			{
				field: 'fee',
				headerName: 'Fee',
				width: 90,
				type: 'numericColumn',
				valueFormatter: (params) =>
					params.value != null ? `$${params.value.toFixed(4)}` : '',
			},
			{
				field: 'confidence',
				headerName: 'Conf',
				width: 90,
				valueFormatter: (params) =>
					params.value != null
						? `${(params.value * 100).toFixed(1)}%`
						: '',
			},
			// --- Technical Analysis (Indicators) ---
			{
				headerName: 'Entry BTC',
				width: 110,
				type: 'numericColumn',
				valueGetter: (params) => params.data?.indicators?.currentPrice,
				valueFormatter: (params) =>
					params.value
						? `$${Number(params.value).toLocaleString()}`
						: '',
			},
			{
				headerName: 'Price Beat',
				width: 110,
				type: 'numericColumn',
				valueGetter: (params) => {
					const val = params.data?.indicators?.priceToBeat;
					return val === 'N/A' || val === undefined
						? null
						: Number(val);
				},
				valueFormatter: (params) =>
					params.value ? `$${params.value.toLocaleString()}` : '',
			},
			{
				headerName: 'Entry Diff',
				width: 100,
				type: 'numericColumn',
				valueGetter: (params) => {
					const current = Number(
						params.data?.indicators?.currentPrice,
					);
					const beat = params.data?.indicators?.priceToBeat;
					if (isNaN(current) || beat === 'N/A' || beat === undefined)
						return null;
					return current - Number(beat);
				},
				cellRenderer: (params: any) => {
					const val = params.value;
					if (val === null) return '';
					return (
						<div
							className={
								val >= 0 ? 'text-emerald-400' : 'text-red-400'
							}
						>
							{val >= 0 ? '+' : ''}
							{val.toFixed(2)}
						</div>
					);
				},
			},
			{
				field: 'exitBtcPrice',
				headerName: 'Exit BTC',
				width: 110,
				type: 'numericColumn',
				valueFormatter: (params) =>
					params.value ? `$${params.value.toLocaleString()}` : '',
			},
			{
				headerName: 'Exit Diff',
				width: 100,
				type: 'numericColumn',
				valueGetter: (params) => {
					const exit = params.data?.exitBtcPrice;
					const beat = params.data?.priceToBeat;
					if (exit === undefined || !beat) return null;
					return exit - beat;
				},
				cellRenderer: (params: any) => {
					const val = params.value;
					if (val === null) return '';
					return (
						<div
							className={
								val >= 0 ? 'text-emerald-400' : 'text-red-400'
							}
						>
							{val >= 0 ? '+' : ''}
							{val.toFixed(2)}
						</div>
					);
				},
			},
			{
				headerName: 'Dist %',
				width: 90,
				valueGetter: (params) => params.data?.indicators?.distFromRef,
			},
			{
				headerName: 'VWAP',
				width: 100,
				valueGetter: (params) => params.data?.indicators?.vwap,
			},
			{
				headerName: 'StochRSI',
				width: 90,
				valueGetter: (params) => params.data?.indicators?.stochRsi,
			},
			{
				headerName: 'MicroRSI',
				width: 90,
				valueGetter: (params) => params.data?.indicators?.microRsi,
			},
			{
				headerName: 'RSI-14',
				width: 90,
				valueGetter: (params) => params.data?.indicators?.rsi14,
			},
			{
				headerName: 'EMA 3',
				width: 100,
				valueGetter: (params) => params.data?.indicators?.ema3,
			},
			{
				headerName: 'EMA 8',
				width: 100,
				valueGetter: (params) => params.data?.indicators?.ema8,
			},
			{
				headerName: 'BB Lower',
				width: 100,
				hide: true,
				valueGetter: (params) => params.data?.indicators?.bbLower,
			},
			{
				headerName: 'BB Upper',
				width: 100,
				hide: true,
				valueGetter: (params) => params.data?.indicators?.bbUpper,
			},
			{
				headerName: 'BB Pos',
				width: 80,
				valueGetter: (params) => params.data?.indicators?.bbPosition,
			},
			{
				headerName: 'Mom 3m',
				width: 90,
				valueGetter: (params) => params.data?.indicators?.momentum3,
			},
			{
				headerName: 'Volatility',
				width: 90,
				valueGetter: (params) => params.data?.indicators?.volatility,
			},
		],
		[],
	);

	const defaultColDef = useMemo<ColDef>(
		() => ({
			sortable: true,
			filter: true,
			resizable: true,
		}),
		[],
	);

	return (
		<div className="ag-theme-quartz-dark w-full h-[600px]">
			<AgGridReact
				rowData={trades}
				columnDefs={columnDefs}
				defaultColDef={defaultColDef}
				pagination={true}
				paginationPageSize={20}
				paginationPageSizeSelector={[20, 50, 100]}
			/>
		</div>
	);
}
