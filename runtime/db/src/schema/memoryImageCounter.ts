import { Schema } from 'mongoose';

/**
 * Per-user sequence behind the short image ids used in `/memory/images/<id>`.
 * Ids only have to be unique inside one user's images, because every lookup is
 * scoped to the authenticated user.
 */
export interface IMemoryImageCounter {
  userId: Schema.Types.ObjectId;
  seq: number;
}

const memoryImageCounterSchema = new Schema<IMemoryImageCounter>({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export default memoryImageCounterSchema;
