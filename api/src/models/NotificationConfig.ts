import mongoose, { Schema, type Document } from 'mongoose';

export interface INotificationConfigDoc extends Document {
	key: string;
	value: any;
}

const notificationConfigSchema = new Schema(
	{
		key: { type: String, required: true, unique: true, index: true },
		value: { type: Schema.Types.Mixed, required: true },
	},
	{ timestamps: true },
);

export const NotificationConfigModel = mongoose.model<INotificationConfigDoc>(
	'NotificationConfig',
	notificationConfigSchema,
);
