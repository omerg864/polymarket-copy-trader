import mongoose, { Schema, type Document } from 'mongoose';

export interface IStrategyConfigDoc extends Document {
	key: string;
	value: any;
}

const strategyConfigSchema = new Schema(
	{
		key: { type: String, required: true, unique: true, index: true },
		value: { type: Schema.Types.Mixed, required: true },
	},
	{ timestamps: true },
);

export const StrategyConfigModel = mongoose.model<IStrategyConfigDoc>(
	'StrategyConfig',
	strategyConfigSchema,
);
