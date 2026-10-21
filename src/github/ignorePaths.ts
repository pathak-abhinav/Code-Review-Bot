const IGNORE_PATTERNS = [
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /\.min\.(js|css)$/,
  /^dist\//,
  /^node_modules\//,
  /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|woff2?)$/i,
];

export function shouldIgnorePath(path: string): boolean {
  return IGNORE_PATTERNS.some((re) => re.test(path));
}

export function filterTouchedPaths(paths: string[]): string[] {
  return paths.filter((p) => !shouldIgnorePath(p));
}
