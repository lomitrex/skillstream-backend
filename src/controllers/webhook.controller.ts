import { Request, Response } from 'express';

export class WebhookController {
  static async receive(req: Request, res: Response): Promise<void> {
    
    const signature = req.headers['x-sync-signature'];
    if (!signature) {
      res.status(400).json({ error: 'Missing sync signature authorization' });
      return;
    }
    console.log('Mobile transaction sync log payload:', req.body);
    res.status(200).json({ received: true, status: 'synced' });
  }
}