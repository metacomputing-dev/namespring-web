export const REPOSITORY_DATA_INVALID = 'REPOSITORY_DATA_INVALID' as const;
export const REPOSITORY_QUERY_INVALID = 'REPOSITORY_QUERY_INVALID' as const;

export type RepositoryDataSource = 'fourframe' | 'hanja' | 'name-stat';

/**
 * Stable, non-retryable error for rows that violate a repository's data
 * contract. Network and lifecycle failures must use a different error path:
 * retrying cannot repair a malformed database row.
 */
export class RepositoryDataError extends Error {
  public readonly code = REPOSITORY_DATA_INVALID;
  public readonly retryable = false;

  public constructor(
    public readonly repository: RepositoryDataSource,
    public readonly path: string,
    reason: string,
  ) {
    super(`${repository} repository data is invalid at ${path}: ${reason}`);
    this.name = 'RepositoryDataError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Stable, non-retryable error for public repository query contract violations. */
export class RepositoryQueryValidationError extends Error {
  public readonly code = REPOSITORY_QUERY_INVALID;
  public readonly retryable = false;

  public constructor(
    public readonly repository: RepositoryDataSource,
    public readonly path: string,
    public readonly reason: string,
  ) {
    super(`${repository} repository query is invalid at ${path}: ${reason}`);
    this.name = 'RepositoryQueryValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
