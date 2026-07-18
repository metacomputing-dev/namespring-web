import { ContentLifecycleServiceV1 } from "./content-service.js";
import { FirestoreContentRepositoryV1 } from "./content-repository.js";

let cachedService: ContentLifecycleServiceV1 | null = null;

export function getContentLifecycleService(): ContentLifecycleServiceV1 {
  cachedService ??= new ContentLifecycleServiceV1(new FirestoreContentRepositoryV1());
  return cachedService;
}
