import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import config from './config';
import { errorHandler } from './middleware/errorHandler';
import botRoutes from './routes/bot.routes';

const app = express();

const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 100, // limit each IP to 100 requests per window
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later.' },
});

app.use(cors());
app.use(express.json());
app.use(limiter);

app.use('/api', botRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
	console.log(`Dashboard API running on http://localhost:${config.port}`);
});

export default app;
