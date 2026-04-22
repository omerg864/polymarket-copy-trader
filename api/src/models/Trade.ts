import mongoose, { Schema, type Document } from 'mongoose';
import { Trade, TradeType } from '@shared/types';

export interface ITradeDoc extends Document, Omit<Trade, 'id'> {
	tradeId: string; // Map 'id' from Trade interface to 'tradeId' in Mongo to avoid _id conflicts
}

const tradeSchema = new Schema(
	{
		tradeId: { type: String, required: true, unique: true, index: true },
		type: { type: String, enum: Object.values(TradeType), required: true, index: true },
		direction: { type: String, enum: ['UP', 'DOWN'], required: true },
		tokenId: { type: String, required: true },
		conditionId: { type: String, required: true },
		slug: { type: String },
		eventTicker: { type: String },
		title: { type: String },
		side: { type: String },
		entryPrice: { type: Number, required: true },
		currentPrice: { type: Number },
		exitPrice: { type: Number },
		exitBtcPrice: { type: Number },
		size: { type: Number, required: true },
		cost: { type: Number, required: true },
		fee: { type: Number, required: true },
		status: { type: String, required: true },
		startTime: { type: String, required: true },
		endTime: { type: String, required: true },
		enteredAt: { type: String, required: true },
		closedAt: { type: String, index: true },
		priceToBeat: { type: Number, required: true },
		pnl: { type: Number, required: true },
		pctChange: { type: Number },
		confidence: { type: Number },
		indicators: { type: Schema.Types.Mixed },
		actualOutcome: { type: String, enum: ['UP', 'DOWN', 'UNKNOWN'] },
	},
	{ timestamps: true },
);

// Compound index for faster filtering in dashboard
tradeSchema.index({ type: 1, closedAt: -1 });

export const TradeModel = mongoose.model<ITradeDoc>('Trade', tradeSchema);
