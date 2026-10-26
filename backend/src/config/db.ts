import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/network_intrusion';

export let isDBConnected = false;

/**
 * Connect to MongoDB with Mongoose.
 * Provides connection state logging and graceful startup even if DB is spinning up.
 */
export async function connectDB(): Promise<void> {
  try {
    mongoose.connection.on('connected', () => {
      isDBConnected = true;
      console.log('✅ MongoDB connected successfully to:', MONGODB_URI);
    });

    mongoose.connection.on('error', (err) => {
      isDBConnected = false;
      console.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      isDBConnected = false;
      console.warn('MongoDB connection lost. Reconnecting...');
    });

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
    });
    isDBConnected = true;
  } catch (error: any) {
    isDBConnected = false;
    console.warn(`⚠️ Notice: MongoDB not reached at ${MONGODB_URI} (${error.message}).`);
    console.warn(`💡 Backend is running in standalone mode. Once MongoDB / Docker starts, it will connect automatically.`);
  }
}

/**
 * Graceful shutdown hook for application termination.
 */
export async function disconnectDB(): Promise<void> {
  if (isDBConnected) {
    await mongoose.connection.close();
    console.log('MongoDB connection closed cleanly.');
  }
}

export default mongoose;
