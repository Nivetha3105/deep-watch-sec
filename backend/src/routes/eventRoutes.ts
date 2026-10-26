import { Router } from 'express';
import { ingestEvent, getEvents } from '../controllers/eventController';

const router = Router();

// Ingest network event
router.post('/', ingestEvent);

// List/query network events
router.get('/', getEvents);

export default router;
