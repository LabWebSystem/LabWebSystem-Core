export function printSection(title: string): void {
  process.stdout.write(`\n[${title}]\n`);
}

export function printList(items: string[]): void {
  for (const item of items) {
    process.stdout.write(`- ${item}\n`);
  }
}

export function printKeyValue(label: string, value: string): void {
  process.stdout.write(`${label}: ${value}\n`);
}
