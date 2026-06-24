import { Schema, model, Document } from 'mongoose';

export interface ICourse extends Document {
  title: string;
  description: string;
  instructor: string;
  thumbnailUrl?: string;
}

const CourseSchema = new Schema<ICourse>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  instructor: { type: String, required: true },
  thumbnailUrl: { type: String },
}, { timestamps: true });

export const Course = model<ICourse>('Course', CourseSchema);
