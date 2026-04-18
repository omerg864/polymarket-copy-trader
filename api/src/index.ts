import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import config from './config';
import { errorHandler } from './middleware/errorHandler';
import botRoutes from './routes/bot.routes';
import notificationRoutes from './routes/notification.routes';
import priceRoutes from './routes/price.routes';
import simulationRoutes from './routes/simulation.routes';

const app = express();

const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 100, // limit each IP to 100 requests per window
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later.' },
});

app.use(
	cors({
		origin: config.clientUrl,
	}),
);
app.use(express.json());
app.use(limiter);

app.use('/api', botRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/simulation', simulationRoutes);

app.use(errorHandler);

async function start() {
	await mongoose.connect(config.mongoUri);
	console.log('Connected to MongoDB');

	app.listen(config.port, () => {
		console.log(`Dashboard API running on http://localhost:${config.port}`);
	});
}

start().catch((err) => {
	console.error('Failed to start API:', err);
	process.exit(1);
});

export default app;
