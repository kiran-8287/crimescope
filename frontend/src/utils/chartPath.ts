// Path-command decision for a line series, kept pure so the rendering rule is
// directly testable. A point starts a new subpath ('M') when it is the first point,
// when the previous value is null, or when the series opts out of connecting the
// segment that would arrive at it (`connect(previousIndex)` returns false). Otherwise
// it continues the previous subpath ('L'). The annual cross-framework totals pass
// `connect: () => false`, so their points are never joined into a misleading trend.
export type LineCommand = 'M' | 'L' | null;

export function lineCommands(
  values: (number | null | undefined)[],
  connect?: (fromIndex: number) => boolean
): LineCommand[] {
  const commands: LineCommand[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === null || value === undefined) {
      commands.push(null);
      continue;
    }
    const previous = values[i - 1];
    const canConnect = connect ? connect(i - 1) : true;
    commands.push(i === 0 || previous === null || previous === undefined || !canConnect ? 'M' : 'L');
  }
  return commands;
}
