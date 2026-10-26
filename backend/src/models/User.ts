import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'ADMIN' | 'ANALYST';

export interface IUser extends Document {
  username: string;
  email: string;
  role: UserRole;
  created_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    role: {
      type: String,
      enum: ['ADMIN', 'ANALYST'],
      default: 'ANALYST',
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
export default User;
