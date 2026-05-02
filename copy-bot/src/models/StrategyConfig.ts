import mongoose, { Schema, type Document } from 'mongoose';

export interface IStrategyConfigDoc extends Document {
	key: string;
	mode: string;
	value: any;
}

const strategyConfigSchema = new Schema(
	{
		key: { type: String, required: true, index: true },
		mode: { type: String, required: true, index: true },
		value: { type: Schema.Types.Mixed, required: true },
	},
	{ timestamps: true },
);

strategyConfigSchema.index({ key: 1, mode: 1 }, { unique: true });

export const StrategyConfigModel = mongoose.model<IStrategyConfigDoc>(
	'StrategyConfig',
	strategyConfigSchema,
);
