export function readOption(args: string[], name: string): string | undefined {
  const long = `--${name}`;
  const index = args.indexOf(long);
  if (index < 0) {
    return undefined;
  }
  return args[index + 1];
}

export function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}
