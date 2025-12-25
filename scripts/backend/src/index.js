import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';

import ridesRouter from './routes/rides.js';
import driversRouter from './routes/drivers.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/rides', ridesRouter);
app.use('/drivers', driversRouter);
app.use('/auth', authRouter);

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Taxi API server listening on http://localhost:${PORT}`);
});