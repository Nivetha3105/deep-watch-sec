import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event';
import detectionEngine from '../detection/detectionEngine';
import { inMemoryStore } from '../services/inMemoryStore';

/**
 * Controller to ingest simulated or real network events.
 * Endpoint: POST /api/events
 */
export async function ingestEvent(req: Request, res: Response): Promise<void> {
  try {
    const { source_ip, destination_ip, port, action, result, timestamp, metadata } = req.body;

    // Validate required fields
    if (!source_ip || !action || !result) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Missing required fields: source_ip, action, and result are mandatory.',
      });
      return;
    }

    let savedEvent: any;

    if (mongoose.connection.readyState === 1) {
      // Save event to MongoDB
      const event = new Event({
        source_ip,
        destination_ip: destination_ip || null,
        port: port ? Number(port) : null,
        action: action.toUpperCase(),
        result: result.toUpperCase(),
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        metadata: metadata || {},
      });
      savedEvent = await event.save();
    } else {
      // In-memory fallback
      savedEvent = inMemoryStore.saveEvent({
        source_ip,
        destination_ip,
        port: port ? Number(port) : null,
        action,
        result,
        timestamp,
        metadata,
      });
    }

    // Trigger detection engine evaluation asynchronously so ingestion remains blazing fast
    detectionEngine.evaluateEvent(savedEvent).catch((detectionErr) => {
      console.error('[EventIngest] Error evaluating event in detection engine:', detectionErr);
    });

    res.status(201).json({
      success: true,
      message: 'Network event ingested successfully',
      data: savedEvent,
    });
  } catch (error: any) {
    console.error('Error ingesting event:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to ingest network event',
    });
  }
}

/**
 * Controller to fetch events with pagination and filtering.
 * Endpoint: GET /api/events
 */
export async function getEvents(req: Request, res: Response): Promise<void> {
  try {
    const { source_ip, action, result, limit = 50, page = 1 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    if (mongoose.connection.readyState === 1) {
      const filter: Record<string, any> = {};
      if (source_ip) filter.source_ip = source_ip;
      if (action) filter.action = (action as string).toUpperCase();
      if (result) filter.result = (result as string).toUpperCase();

      const [events, total] = await Promise.all([
        Event.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean(),
        Event.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: events,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } else {
      const allEvents = inMemoryStore.findEvents({
        source_ip: source_ip as string,
        action: action ? (action as string).toUpperCase() : undefined,
        result: result ? (result as string).toUpperCase() : undefined,
      });
      const total = allEvents.length;
      const paginated = allEvents.slice(skip, skip + limitNum);

      res.status(200).json({
        success: true,
        data: paginated,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  } catch (error: any) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch events',
    });
  }
}
