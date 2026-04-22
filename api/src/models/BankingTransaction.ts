import mongoose, { Schema, type Document } from 'mongoose';
import { BankingTransaction, TradeType } from '../../../shared';

export interface IBankingTransactionDoc
	extends Document, Omit<BankingTransaction, 'id'> {}

const bankingTransactionSchema = new Schema(
	{
		amount: { type: Number, required: true },
		type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
		mode: {
			type: String,
			enum: Object.values(TradeType),
			required: true,
			index: true,
		},
		description: { type: String },
		createdAt: { type: String, required: true, index: true },
	},
	{
		timestamps: true,
		collection: 'bankingTransactions',
	},
);

export const BankingTransactionModel = mongoose.model<IBankingTransactionDoc>(
	'BankingTransaction',
	bankingTransactionSchema,
);
