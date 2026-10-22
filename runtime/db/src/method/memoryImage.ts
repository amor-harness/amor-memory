import { Types } from 'mongoose';
import type * as t from '../types';
import { logger } from '@librechat/data-schemas';
import memoryImageCounterSchema from '../schema/memoryImageCounter';
import { createMemoryImageModel } from '../model/memoryImage';
import { emitMemoryChange } from '../memoryEvents';

/** Store filter: `storeId: null` matches both null and missing fields, so rows
 *  written before stores existed stay reachable. */
const partitionFilter = (storeId?: string) => ({ storeId: storeId ?? null });

/** Listing projection: metadata only, never the stored binary. */
const META_PROJECTION = '-data -__v';

export function createMemoryImageMethods(mongoose: typeof import('mongoose')): {
  upsertMemoryImage: (params: t.UpsertMemoryImageParams) => Promise<t.UpsertMemoryImageResult>;
  getMemoryImages: (params: t.GetMemoryImagesParams) => Promise<t.IMemoryImageMeta[]>;
  getMemoryImage: (params: t.MemoryImageLookupParams) => Promise<t.IMemoryImage | null>;
  nextMemoryImageId: (userId: string | Types.ObjectId) => Promise<number>;
  deleteMemoryImage: (params: t.DeleteMemoryImageParams) => Promise<number>;
  deleteAllUserMemoryImages: (userId: string | Types.ObjectId) => Promise<number>;
  markMemoryImagesRecalled: (params: t.MarkMemoryImagesRecalledParams) => Promise<number>;
  markMemoryImageEmbedded: (params: t.MarkMemoryImageEmbeddedParams) => Promise<number>;
  touchMemoryImage: (params: t.MarkMemoryImageEmbeddedParams) => Promise<number>;
} {
  const MemoryImage = mongoose.models.MemoryImage ?? createMemoryImageModel(mongoose);
  const MemoryImageCounter =
    mongoose.models.MemoryImageCounter ??
    mongoose.model('MemoryImageCounter', memoryImageCounterSchema);

  /** Next short id for this user's images. Atomic, so concurrent ingests cannot
   *  hand out the same id. */
  async function nextMemoryImageId(userId: string | Types.ObjectId): Promise<number> {
    const counter = await MemoryImageCounter.findOneAndUpdate(
      { userId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<{ seq: number }>();
    return Number(counter?.seq ?? 1);
  }

  /**
   * Stores an image, deduping exact content: the same bytes refresh the
   * existing row instead of adding one. Visual ("nearly the same") dedupe is
   * the caller's call — it needs hash-distance policy, which lives with the
   * ingest pipeline, not here.
   */
  async function upsertMemoryImage({
    userId,
    storeId,
    domainId,
    sha256,
    dhash,
    mime,
    width,
    height,
    bytes,
    data,
    source,
    origin,
    tenantId,
  }: t.UpsertMemoryImageParams): Promise<t.UpsertMemoryImageResult> {
    try {
      const existing = await MemoryImage.findOne({ userId, ...partitionFilter(storeId), sha256 })
        .select(META_PROJECTION)
        .lean<t.IMemoryImageMeta>();
      if (existing) {
        /** Rows written before short ids existed adopt one the first time they
         *  are seen again, so the sha256 path is never the only one they have. */
        const id = existing.id ?? (await nextMemoryImageId(userId));
        await MemoryImage.updateOne(
          { userId, ...partitionFilter(storeId), sha256 },
          {
            $set: {
              updatedAt: new Date(),
              id,
              ...(domainId != null ? { domainId: String(domainId) } : {}),
            },
          },
        );
        return { ok: true, deduped: 'sha256', image: { ...existing, id } };
      }

      const id = await nextMemoryImageId(userId);
      await MemoryImage.create({
        userId,
        storeId,
        ...(domainId != null ? { domainId: String(domainId) } : {}),
        id,
        sha256,
        dhash,
        mime,
        width,
        height,
        bytes,
        data,
        source,
        origin,
        tenantId,
        updatedAt: new Date(),
      });

      return {
        ok: true,
        image: {
          userId: new Types.ObjectId(String(userId)),
          storeId,
          id,
          sha256,
          dhash,
          mime,
          width,
          height,
          bytes,
          source,
          origin,
          updatedAt: new Date(),
        },
      };
    } catch (error) {
      /** A concurrent ingest of the same image can lose the unique-index race;
       *  that is a dedupe, not a failure. */
      if ((error as { code?: number })?.code === 11000) {
        return { ok: true, deduped: 'sha256' };
      }
      logger.error('[memoryImage] Failed to upsert image', error);
      return { ok: false, reason: 'Failed to store image' };
    }
  }

  /** Metadata for a user's images, newest first. Excludes the binary. */
  async function getMemoryImages({
    userId,
    storeId,
    limit,
  }: t.GetMemoryImagesParams): Promise<t.IMemoryImageMeta[]> {
    return await MemoryImage.find({ userId, ...partitionFilter(storeId) })
      .select(META_PROJECTION)
      .sort({ updatedAt: -1 })
      .limit(Number(limit) > 0 ? Number(limit) : 0)
      .lean<t.IMemoryImageMeta[]>();
  }

  /** The full row (binary included), by exact content or by short id. */
  async function getMemoryImage({
    userId,
    storeId,
    sha256,
    id,
  }: t.MemoryImageLookupParams): Promise<t.IMemoryImage | null> {
    if (sha256 == null && id == null) {
      return null;
    }
    /** The short id is unique per user, so a store-less lookup (serving the
     *  image URL) is unambiguous; an explicit store still narrows the match. */
    return await MemoryImage.findOne({
      userId,
      ...(storeId != null ? { storeId } : {}),
      ...(sha256 != null ? { sha256 } : { id }),
    }).lean<t.IMemoryImage>();
  }

  async function deleteMemoryImage({
    userId,
    storeId,
    sha256,
  }: t.DeleteMemoryImageParams): Promise<number> {
    const result = await MemoryImage.deleteOne({ userId, ...partitionFilter(storeId), sha256 });
    return result.deletedCount ?? 0;
  }

  /** Cascade for account deletion. */
  async function deleteAllUserMemoryImages(userId: string | Types.ObjectId): Promise<number> {
    const result = await MemoryImage.deleteMany({ userId });
    /** Rows drop directly, which emits nothing; an image-scoped sweep drops
     *  their vector rows and leaves the user's text memories — and the text
     *  index — alone. */
    emitMemoryChange({ type: 'delete', userId: String(userId), sweep: true, image: true });
    return result.deletedCount ?? 0;
  }

  /** Stamps the recall time of the images that just rode a turn, so capacity
   *  eviction can drop least-recently-recalled images first. */
  async function markMemoryImagesRecalled({
    userId,
    storeId,
    hashes,
  }: t.MarkMemoryImagesRecalledParams): Promise<number> {
    if (!Array.isArray(hashes) || hashes.length === 0) {
      return 0;
    }
    const result = await MemoryImage.updateMany(
      { userId, ...partitionFilter(storeId), sha256: { $in: hashes } },
      { $set: { lastRecalledAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  /** Flags a row as searchable once its recall embedding has been written. */
  async function markMemoryImageEmbedded({
    userId,
    storeId,
    sha256,
  }: t.MarkMemoryImageEmbeddedParams): Promise<number> {
    const result = await MemoryImage.updateOne(
      { userId, ...partitionFilter(storeId), sha256 },
      { $set: { embedded: true } },
    );
    return result.modifiedCount ?? 0;
  }

  /** Refreshes recency when an already-known image is seen again, so it keeps
   *  its place in the panel's newest-first ordering. */
  async function touchMemoryImage({
    userId,
    storeId,
    sha256,
  }: t.MarkMemoryImageEmbeddedParams): Promise<number> {
    const result = await MemoryImage.updateOne(
      { userId, ...partitionFilter(storeId), sha256 },
      { $set: { updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  return {
    upsertMemoryImage,
    getMemoryImages,
    getMemoryImage,
    nextMemoryImageId,
    deleteMemoryImage,
    deleteAllUserMemoryImages,
    markMemoryImagesRecalled,
    markMemoryImageEmbedded,
    touchMemoryImage,
  };
}

export type MemoryImageMethods = ReturnType<typeof createMemoryImageMethods>;
