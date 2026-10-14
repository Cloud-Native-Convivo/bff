/**
 * Validador de convención Gitmoji + Conventional Commits para bff.
 * Alineado con pr-quality.yml y AGENTS.md §11.2.
 */
describe('GitCommitConvention', () => {
  const GITMOJI_CONVENTIONAL_PATTERN =
    /^(?::\w+:|[^\w\s:]\S*)\s(\w*)(?:\(([\w$.\-*/ ]*)\))?!?:\s(.*)$/;

  const ALLOWED_TYPES = new Set([
    'feat',
    'fix',
    'docs',
    'style',
    'refactor',
    'perf',
    'test',
    'build',
    'ci',
    'chore',
    'revert',
  ]);

  function isValidCommitMessage(message: string): boolean {
    if (!message || !message.trim()) return false;
    const firstLine = message.trim().split('\n')[0].trim();
    const match = firstLine.match(GITMOJI_CONVENTIONAL_PATTERN);
    if (!match) return false;
    const type = match[1];
    return ALLOWED_TYPES.has(type);
  }

  const validExamples = [
    ':sparkles: feat: nuevo endpoint de proxy',
    '✨ feat(proxy): implementar circuit breaker con opossum',
    ':lock: fix(auth): aud claim dual validado',
    ':memo: docs(readme): documentar verificacion local',
    ':white_check_mark: test(auth): cubrir jwt-cognito',
    '🐛 fix(roles): normalizar rol a minusculas',
    ':wrench: chore(deps): actualizar librerias menores',
  ];

  test.each(validExamples)('debe aceptar mensaje valido: %s', (msg) => {
    expect(isValidCommitMessage(msg)).toBe(true);
  });

  const invalidExamples = [
    'fix: sin gitmoji al inicio',
    ':sparkles: sin tipo convencional',
    'WIP prueba rapida',
    ':sparkles: invalid_type(modulo): descripcion',
    'feat: solo texto',
    '',
  ];

  test.each(invalidExamples)('debe rechazar mensaje invalido: %s', (msg) => {
    expect(isValidCommitMessage(msg)).toBe(false);
  });
});
