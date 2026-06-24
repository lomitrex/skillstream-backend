import { Schema, model, Document , Types} from 'mongoose';

export interface IReview extends Document {
  courseId: Types.ObjectId;
  userId: number;
  rating: number;
  comment: string;
}

const ReviewSchema = new Schema<IReview>({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  userId: { type: Number, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
}, { timestamps: true });

export const Review = model<IReview>('Review', ReviewSchema);