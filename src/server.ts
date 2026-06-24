import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import router from './routes';
import { connectMongo } from './config/mongo';
import { initPgDb } from './config/db';
import { connectRedis } from './config/redis';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;


app.disable('x-powered-by'); 
app.use(express.json({ limit: '10kb' })); 


app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});


app.use('/api/v1', router);


app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint resource target missing' });
});

const startup = async () => {
  await initPgDb();
  await connectMongo();
  await connectRedis();
  
  server.listen(PORT, () => {
    console.log(`Server executing operations live on port ${PORT}`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startup();
}

export { app, server };