import {
  RepositoryDataError,
  type RepositoryDataSource,
} from './repository-errors.js';

interface IntegerOptions {
  readonly min?: number;
  readonly max?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Small fail-closed decoder shared by every SQLite-backed repository. */
export class RepositoryRowDecoder {
  private readonly row: Record<string, unknown>;

  public constructor(
    private readonly repository: RepositoryDataSource,
    row: unknown,
    private readonly basePath = 'row',
  ) {
    if (!isRecord(row)) {
      throw new RepositoryDataError(repository, basePath, 'expected an object row');
    }
    this.row = row;
  }

  public fail(path: string, reason: string): never {
    throw new RepositoryDataError(this.repository, path, reason);
  }

  public string(field: string, options: { readonly allowEmpty?: boolean } = {}): string {
    const value = this.required(field);
    if (typeof value !== 'string') {
      return this.fail(this.path(field), 'expected a string');
    }
    if (!options.allowEmpty && value.trim().length === 0) {
      return this.fail(this.path(field), 'expected a non-empty string');
    }
    return value;
  }

  public nullableString(field: string): string | null {
    const value = this.required(field);
    if (value === null) return null;
    if (typeof value !== 'string') {
      return this.fail(this.path(field), 'expected a string or null');
    }
    return value.length > 0 ? value : null;
  }

  public integer(field: string, options: IntegerOptions = {}): number {
    const value = this.required(field);
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      return this.fail(this.path(field), 'expected a finite safe integer');
    }
    if (options.min !== undefined && value < options.min) {
      return this.fail(this.path(field), `expected a value >= ${options.min}`);
    }
    if (options.max !== undefined && value > options.max) {
      return this.fail(this.path(field), `expected a value <= ${options.max}`);
    }
    return value;
  }

  public enumString<const Value extends string>(
    field: string,
    allowed: ReadonlySet<Value>,
  ): Value {
    const value = this.string(field);
    if (!allowed.has(value as Value)) {
      return this.fail(this.path(field), 'contained an unsupported enum value');
    }
    return value as Value;
  }

  public jsonStringArray(field: string): string[] {
    const parsed = this.json(field);
    if (!Array.isArray(parsed)) {
      return this.fail(this.path(field), 'expected a JSON array');
    }
    for (let index = 0; index < parsed.length; index += 1) {
      if (typeof parsed[index] !== 'string' || parsed[index].trim().length === 0) {
        return this.fail(`${this.path(field)}[${index}]`, 'expected a non-empty string');
      }
    }
    return [...parsed] as string[];
  }

  public jsonObject(field: string): Record<string, unknown> {
    const parsed = this.json(field);
    if (!isRecord(parsed)) {
      return this.fail(this.path(field), 'expected a JSON object');
    }
    return parsed;
  }

  public path(field: string): string {
    return `${this.basePath}.${field}`;
  }

  private required(field: string): unknown {
    if (!Object.prototype.hasOwnProperty.call(this.row, field)) {
      return this.fail(this.path(field), 'required field is missing');
    }
    return this.row[field];
  }

  private json(field: string): unknown {
    const source = this.string(field, { allowEmpty: true });
    let parsed: unknown;
    try {
      parsed = JSON.parse(source) as unknown;
    } catch {
      return this.fail(this.path(field), 'expected valid JSON');
    }
    this.assertSafeJsonValue(parsed, this.path(field));
    return parsed;
  }

  private assertSafeJsonValue(value: unknown, path: string): void {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        this.fail(path, 'contained a non-finite JSON number');
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.assertSafeJsonValue(item, path + '[' + index + ']'));
      return;
    }
    if (isRecord(value)) {
      for (const [key, nested] of Object.entries(value)) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
          this.fail(path + '.' + key, 'contained an unsafe object key');
        }
        this.assertSafeJsonValue(nested, path + '.' + key);
      }
      return;
    }
    this.fail(path, 'contained a non-JSON value');
  }
}
