import {
  computePartition,
  fingerprintPartitionInput,
  type PartitionInput,
  type PartitionPublicationToken,
  type PartitionState,
} from "./partition";

export interface PartitionStoreStats {
  computes: number;
  warmHits: number;
  invalidations: number;
  cachedContents: number;
  published: boolean;
}

type PartitionContent = Omit<PartitionState, "publicationToken">;

/**
 * One atomic publication store beside the plan coordinator. Invalidation
 * unpublishes but retains content by inputFingerprint, so W4 can rebind
 * identical finalized content to a new generation without recomputing cells.
 */
export class PartitionStore {
  private contents = new Map<string, PartitionContent>();
  private published: PartitionState | undefined;
  private stats = { computes: 0, warmHits: 0, invalidations: 0 };

  ensure(input: PartitionInput): PartitionState {
    const inputFingerprint = fingerprintPartitionInput(input);
    let content = this.contents.get(inputFingerprint);
    if (content) {
      this.stats.warmHits++;
    } else {
      const computed = computePartition(input);
      const { publicationToken: _publicationToken, ...computedContent } =
        computed;
      content = computedContent;
      this.contents.set(inputFingerprint, content);
      this.stats.computes++;
    }
    const next: PartitionState = {
      ...content,
      publicationToken: { ...input.publicationToken },
    };
    this.published = next;
    return next;
  }

  invalidate() {
    if (this.published) {
      this.published = undefined;
      this.stats.invalidations++;
    }
  }

  getPublished(
    currentToken?: PartitionPublicationToken,
  ): PartitionState | undefined {
    if (
      currentToken &&
      this.published &&
      (this.published.publicationToken.epoch !== currentToken.epoch ||
        this.published.publicationToken.configEpoch !==
          currentToken.configEpoch)
    ) {
      return undefined;
    }
    return this.published;
  }

  getStats(): PartitionStoreStats {
    return {
      ...this.stats,
      cachedContents: this.contents.size,
      published: Boolean(this.published),
    };
  }
}
