import { Router } from 'express';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../controllers/alertController';

const router = Router();

// GET /api/alerts - filterable alerts list
router.get('/', getAlerts);

// POST /api/alerts - manual/test alert creation
router.post('/', createAlert);

// PATCH /api/alerts/:id - update alert status (e.g. resolve)
router.patch('/:id', updateAlert);

// DELETE /api/alerts/:id - delete alert record
router.delete('/:id', deleteAlert);

export default router;
