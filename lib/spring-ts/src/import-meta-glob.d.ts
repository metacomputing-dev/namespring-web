interface ImportMeta {
  glob(
    pattern: string,
    options?: { readonly eager?: boolean },
  ): Record<string, unknown>;
}
