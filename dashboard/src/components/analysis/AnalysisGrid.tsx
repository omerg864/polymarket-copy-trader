/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, useCallback } from 'react';
import { AgGridReact, AgGridProvider } from 'ag-grid-react';
import { DateTime } from 'luxon';
import {
	ClientSideRowModelModule,
	TextFilterModule,
	NumberFilterModule,
	DateFilterModule,
	PaginationModule,
	ValidationModule,
	type ColDef,
	type ValueFormatterParams,
	themeQuartz,
	colorSchemeDarkBlue,
} from 'ag-grid-community';
import {
	SetFilterModule,
	ColumnsToolPanelModule,
	FiltersToolPanelModule,
	RowGroupingModule,
	MenuModule,
	SideBarModule,
	PivotModule,
	AllEnterpriseModule,
} from 'ag-grid-enterprise';

import type { Trade } from '@/types';
import { formatDate } from '@/lib/utils';
import {
	DirectionBadge,
	MarketOutcomeBadge,
	StatusBadge,
	PnlBadge,
} from '../dashboard/badges';

const myTheme = themeQuartz.withPart(colorSchemeDarkBlue);

const modules = [
	ClientSideRowModelModule,
	TextFilterModule,
	NumberFilterModule,
	DateFilterModule,
	PaginationModule,
	ValidationModule,
	SetFilterModule,
	ColumnsToolPanelModule,
	FiltersToolPanelModule,
	RowGroupingModule,
	MenuModule,
	SideBarModule,
	PivotModule,
	AllEnterpriseModule,
];

interface AnalysisGridProps {
	trades: Trade[];
}

export function AnalysisGrid({ trades }: AnalysisGridProps) {
	const [pinnedBottomRowData, setPinnedBottomRowData] = useState<any[]>([]);

	// Handle total recalculation when filters change
	const onModelUpdated = useCallback((params: any) => {
		const gridApi = params.api;
		let totalShares = 0;
		let totalCost = 0;
		let totalPnl = 0;
		let totalFee = 0;

		gridApi.forEachNodeAfterFilter((node: any) => {
			if (node.data && !node.data.isTotalRow) {
				totalShares += node.data.size || 0;
				totalCost += node.data.cost || 0;
				totalPnl += node.data.pnl || 0;
				totalFee += node.data.fee || 0;
			}
		});

		setPinnedBottomRowData([
			{
				title: 'TOTALS',
				size: totalShares,
				cost: totalCost,
				pnl: totalPnl,
				fee: totalFee,
				isTotalRow: true,
			},
		]);
	}, []);

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
				enableRowGroup: true,
			},
			{
				field: 'direction',
				headerName: 'Dir',
				width: 100,
				enableRowGroup: true,
				filter: 'agSetColumnFilter',
				cellRenderer: (params: any) => {
					if (params.data?.isTotalRow) return '';
					return <DirectionBadge direction={params.value} />;
				},
			},
			{
				field: 'status',
				headerName: 'Status',
				width: 160,
				enableRowGroup: true,
				filter: 'agSetColumnFilter',
				cellRenderer: (params: any) => {
					if (params.data?.isTotalRow) return '';
					return <StatusBadge status={params.value?.toLowerCase()} />;
				},
			},
			{
				field: 'actualOutcome',
				headerName: 'Outcome',
				width: 120,
				enableRowGroup: true,
				filter: 'agSetColumnFilter',
				cellRenderer: (params: any) => {
					if (params.data?.isTotalRow) return '';
					return <MarketOutcomeBadge outcome={params.value} />;
				},
			},
			{
				field: 'enteredAt',
				headerName: 'Opened At',
				filter: 'agDateColumnFilter',
				width: 160,
				valueFormatter: (params: ValueFormatterParams) =>
					params.value ? formatDate(params.value) : '',
				sort: 'desc',
			},
			{
				headerName: 'Day',
				width: 100,
				enableRowGroup: true,
				filter: 'agSetColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data?.enteredAt) return '';
					return DateTime.fromISO(params.data.enteredAt).toFormat(
						'cccc',
					);
				},
			},
			{
				headerName: 'Hour',
				width: 90,
				enableRowGroup: true,
				filter: 'agSetColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data?.enteredAt) return '';
					return DateTime.fromISO(params.data.enteredAt).toFormat(
						'HH:00',
					);
				},
			},
			{
				field: 'closedAt',
				headerName: 'Closed At',
				filter: 'agDateColumnFilter',
				width: 160,
				valueFormatter: (params: ValueFormatterParams) =>
					params.value ? formatDate(params.value) : '',
			},
			{
				field: 'size',
				headerName: 'Shares',
				width: 100,
				type: 'numericColumn',
				aggFunc: 'sum',
				filter: 'agNumberColumnFilter',
				valueFormatter: (params: any) =>
					params.value ? Number(params.value).toLocaleString() : '',
			},
			{
				field: 'cost',
				headerName: 'Cost',
				width: 100,
				type: 'numericColumn',
				aggFunc: 'sum',
				filter: 'agNumberColumnFilter',
				valueFormatter: (params: any) =>
					params.value ? `$${Number(params.value).toFixed(2)}` : '',
			},
			{
				field: 'entryPrice',
				headerName: 'Entry $',
				width: 100,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueFormatter: (params: any) => {
					if (params.value == null) return '';
					const val = Number(params.value);
					return isNaN(val) ? '' : `$${val.toFixed(3)}`;
				},
			},
			{
				field: 'exitPrice',
				headerName: 'Exit $',
				width: 100,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueFormatter: (params: any) => {
					if (params.value == null) return '';
					const val = Number(params.value);
					return isNaN(val) ? '' : `$${val.toFixed(3)}`;
				},
			},
			{
				field: 'pnl',
				headerName: 'PnL',
				width: 140,
				type: 'numericColumn',
				aggFunc: 'sum',
				filter: 'agNumberColumnFilter',
				cellRenderer: (params: any) => {
					const val = params.value;
					if (val === undefined || val === null) return '';
					// Handle group row aggregation access
					const cost =
						params.data?.cost || params.node?.aggData?.cost || 0;
					return <PnlBadge pnl={val} cost={cost} />;
				},
			},
			{
				headerName: 'PnL %',
				width: 90,
				type: 'numericColumn',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) => {
					const pnl = params.data
						? params.data.pnl
						: params.node.aggData?.pnl;
					const cost = params.data
						? params.data.cost
						: params.node.aggData?.cost;
					if (!cost) return 0;
					return (pnl / cost) * 100;
				},
				valueFormatter: (params: any) => {
					if (params.value == null) return '';
					const val = Number(params.value);
					return isNaN(val) ? '' : `${val.toFixed(2)}%`;
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
				aggFunc: 'sum',
				filter: 'agNumberColumnFilter',
				valueFormatter: (params: any) => {
					if (params.value == null) return '';
					const val = Number(params.value);
					return isNaN(val) ? '' : `$${val.toFixed(4)}`;
				},
			},
			{
				field: 'confidence',
				headerName: 'Conf',
				width: 90,
				filter: 'agNumberColumnFilter',
				valueFormatter: (params: any) => {
					if (params.value == null) return '';
					const val = Number(params.value);
					return isNaN(val) ? '' : `${(val * 100).toFixed(1)}%`;
				},
			},
			// --- Technical Analysis (Indicators) ---
			{
				headerName: 'Entry BTC',
				width: 110,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.currentPrice
						: params.value,
				valueFormatter: (params: any) =>
					params.value
						? `$${Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
						: '',
			},
			{
				headerName: 'Price Beat',
				width: 110,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data) return params.value;
					const val = params.data?.indicators?.priceToBeat;
					return val === 'N/A' || val === undefined
						? null
						: Number(val);
				},
				valueFormatter: (params: any) =>
					params.value
						? `$${params.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
						: '',
			},
			{
				headerName: 'Entry Diff',
				width: 100,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data) return params.value;
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
					if (val === null || val === undefined) return '';
					return (
						<div
							className={
								val >= 0 ? 'text-emerald-400' : 'text-red-400'
							}
						>
							{val >= 0 ? '+' : ''}
							{Number(val).toFixed(2)}
						</div>
					);
				},
			},
			{
				field: 'exitBtcPrice',
				headerName: 'Exit BTC',
				width: 110,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueFormatter: (params: any) =>
					params.value
						? `$${params.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
						: '',
			},
			{
				headerName: 'Exit Diff',
				width: 100,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data) return params.value;
					const exit = params.data?.exitBtcPrice;
					const beat = params.data?.priceToBeat;
					if (exit === undefined || !beat) return null;
					return exit - beat;
				},
				cellRenderer: (params: any) => {
					const val = params.value;
					if (val === null || val === undefined) return '';
					return (
						<div
							className={
								val >= 0 ? 'text-emerald-400' : 'text-red-400'
							}
						>
							{val >= 0 ? '+' : ''}
							{Number(val).toFixed(2)}
						</div>
					);
				},
			},
			{
				headerName: 'Dist %',
				width: 90,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.distFromRef
						: params.value,
			},
			{
				headerName: 'VWAP',
				width: 100,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data ? params.data?.indicators?.vwap : params.value,
			},
			{
				headerName: 'StochRSI',
				width: 90,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.stochRsi
						: params.value,
			},
			{
				headerName: 'MicroRSI',
				width: 90,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.microRsi
						: params.value,
			},
			{
				headerName: 'RSI-14',
				width: 90,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data ? params.data?.indicators?.rsi14 : params.value,
			},
			{
				headerName: 'EMA 3',
				width: 100,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data ? params.data?.indicators?.ema3 : params.value,
			},
			{
				headerName: 'EMA 8',
				width: 100,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data ? params.data?.indicators?.ema8 : params.value,
			},
			{
				headerName: 'BB Lower',
				width: 100,
				hide: true,
				aggFunc: 'avg',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.bbLower
						: params.value,
			},
			{
				headerName: 'BB Upper',
				width: 100,
				hide: true,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.bbUpper
						: params.value,
			},
			{
				headerName: 'BB Pos',
				width: 80,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.bbPosition
						: params.value,
			},
			{
				headerName: 'Mom 3m',
				width: 90,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.momentum3
						: params.value,
			},
			{
				width: 90,
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) =>
					params.data
						? params.data?.indicators?.volatility
						: params.value,
				valueFormatter: (params: any) =>
					params.value != null ? Number(params.value).toFixed(2) : '',
			},
		],
		[],
	);

	const defaultColDef = useMemo<ColDef>(
		() => ({
			flex: 1,
			minWidth: 100,
			enableValue: true,
			enableRowGroup: true,
			enablePivot: true,
			filter: true,
			sortable: true,
			resizable: true,
		}),
		[],
	);

	const autoGroupColumnDef = useMemo<ColDef>(() => {
		return {
			minWidth: 200,
		};
	}, []);

	return (
		<AgGridProvider modules={modules}>
			<div className="w-full h-[750px] bg-[#0c0c0e] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
				<AgGridReact
					theme={myTheme}
					rowData={trades}
					cellSelection
					columnDefs={columnDefs}
					defaultColDef={defaultColDef}
					autoGroupColumnDef={autoGroupColumnDef}
					pinnedBottomRowData={pinnedBottomRowData}
					onModelUpdated={onModelUpdated}
					animateRows={true}
					rowHeight={50}
					headerHeight={48}
					sideBar={true}
					rowGroupPanelShow="always"
					overlayNoRowsTemplate="<span class='text-zinc-500'>No trades found</span>"
				/>
			</div>
		</AgGridProvider>
	);
}
