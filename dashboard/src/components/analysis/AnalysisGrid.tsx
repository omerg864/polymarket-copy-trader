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
import {
	DirectionBadge,
	MarketOutcomeBadge,
	StatusBadge,
	PnlBadge,
	ExpectedOutcomeBadge,
} from '../dashboard/badges';
import { useConfig } from '@/hooks/use-api';
import { formatGlobalDateTime } from '@/lib/utils';

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
	const { data: config } = useConfig();
	const timezone = config?.timezone || 'Asia/Jerusalem';
	const [pinnedBottomRowData, setPinnedBottomRowData] = useState<any[]>([]);

	const formatWithTimezone = useCallback(
		(iso: string | undefined) => {
			return formatGlobalDateTime(iso, timezone);
		},
		[timezone],
	);

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
				headerName: 'Expected Outcome',
				width: 140,
				enableRowGroup: true,
				filter: 'agSetColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data || params.data.isTotalRow) return null;
					if (
						!params.data.actualOutcome ||
						params.data.actualOutcome === 'UNKNOWN'
					)
						return null;
					return params.data.direction === params.data.actualOutcome;
				},
				cellRenderer: (params: any) => {
					if (params.data?.isTotalRow) return '';
					return <ExpectedOutcomeBadge isCorrect={params.value} />;
				},
			},
			{
				field: 'enteredAt',
				headerName: 'Opened At',
				filter: 'agDateColumnFilter',
				width: 160,
				valueFormatter: (params: ValueFormatterParams) =>
					formatWithTimezone(params.value),
				sort: 'desc',
			},
			{
				headerName: 'Day',
				width: 100,
				enableRowGroup: true,
				filter: 'agSetColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data?.enteredAt) return '';
					return DateTime.fromISO(params.data.enteredAt)
						.setZone(timezone)
						.toFormat('cccc');
				},
			},
			{
				headerName: 'Hour',
				width: 90,
				enableRowGroup: true,
				filter: 'agSetColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data?.enteredAt) return '';
					return DateTime.fromISO(params.data.enteredAt)
						.setZone(timezone)
						.toFormat('HH:00');
				},
			},
			{
				headerName: 'Sec After Open',
				width: 120,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				sortable: true,
				valueGetter: (params: any) => {
					if (!params.data?.startTime || !params.data?.enteredAt)
						return null;
					const start = DateTime.fromISO(params.data.startTime);
					const entered = DateTime.fromISO(params.data.enteredAt);
					return Math.floor(entered.diff(start, 'seconds').seconds);
				},
				valueFormatter: (params: any) => {
					if (params.value == null) return '';
					return `${params.value}s`;
				},
			},
			{
				field: 'closedAt',
				headerName: 'Closed At',
				filter: 'agDateColumnFilter',
				width: 160,
				valueFormatter: (params: ValueFormatterParams) =>
					formatWithTimezone(params.value),
			},
			{
				headerName: 'Secs Before Close',
				width: 150,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				sortable: true,
				valueGetter: (params: any) => {
					if (!params.data?.endTime || !params.data?.closedAt)
						return null;
					const end = DateTime.fromISO(params.data.endTime);
					const closed = DateTime.fromISO(params.data.closedAt);
					return Math.floor(end.diff(closed, 'seconds').seconds);
				},
				valueFormatter: (params: any) => {
					if (params.value == null) return '';
					return `${params.value}s`;
				},
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
				headerName: 'Overall Confidence',
				width: 120,
				type: 'numericColumn',
				aggFunc: 'avg',
				filter: 'agNumberColumnFilter',
				valueGetter: (params: any) => {
					if (!params.data) return params.value;
					if (params.data.isTotalRow) return null;
					const confidence = params.data.confidence ?? 0;
					const entryPrice = params.data.entryPrice ?? 0;
					return (confidence * 100 + entryPrice * 100) / 2;
				},
				valueFormatter: (params: any) => {
					if (params.value == null) return '';
					const val = Number(params.value);
					return isNaN(val) ? '' : `${val.toFixed(1)}%`;
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
		],
		[timezone, formatWithTimezone],
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
