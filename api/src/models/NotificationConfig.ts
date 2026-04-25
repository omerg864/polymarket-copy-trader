import mongoose, { Schema, type Document } from 'mongoose';

export interface INotificationConfigDoc extends Document {
	key: string;
	mode: string;
	value: any;
}

const notificationConfigSchema = new Schema(
	{
		key: { type: String, required: true, index: true },
		mode: { type: String, required: true, index: true },
		value: { type: Schema.Types.Mixed, required: true },
	},
	{ timestamps: true },
);

notificationConfigSchema.index({ key: 1, mode: 1 }, { unique: true });

export const NotificationConfigModel = mongoose.model<INotificationConfigDoc>(
	'NotificationConfig',
	notificationConfigSchema,
);
