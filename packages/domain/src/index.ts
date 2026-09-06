/**
 * Normaliza e valida CNPJ segundo o algoritmo oficial da Receita Federal.
 */
export function normalizeCnpj(input: string): string {
  return input.replace(/\D/g, '');
}

export function isValidCnpj(rawCnpj: string): boolean {
  const cnpj = normalizeCnpj(rawCnpj);

  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  let length = cnpj.length - 2;
  let numbers = cnpj.substring(0, length);
  const digits = cnpj.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  length = length + 1;
  numbers = cnpj.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

export function formatCnpj(rawCnpj: string): string {
  const clean = normalizeCnpj(rawCnpj);
  if (clean.length !== 14) return rawCnpj;
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Normalização textual conservadora de organizações brasileiras.
 * Remove acentuação e espaços redundantes mantendo integridade.
 */
export function normalizeEntityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Resolução conservadora de identidades.
 * NUNCA funde pessoas por similaridade de nome isolado.
 */
export type MatchDecision = 'AUTO_MATCH' | 'POSSIBLE_MATCH' | 'MANUAL_REVIEW' | 'NO_MATCH';

export interface IdentityResolutionInput {
  entityType: 'ORGANIZATION' | 'PERSON';
  nameA: string;
  nameB: string;
  identifierA?: { scheme: string; value: string };
  identifierB?: { scheme: string; value: string };
}

export function resolveIdentity(input: IdentityResolutionInput): {
  decision: MatchDecision;
  reason: string;
} {
  // Se ambos tiverem identificadores oficiais
  if (input.identifierA && input.identifierB) {
    if (input.identifierA.scheme === input.identifierB.scheme) {
      if (input.identifierA.value === input.identifierB.value) {
        return {
          decision: 'AUTO_MATCH',
          reason: `Identificadores canônicos correspondentes (${input.identifierA.scheme})`
        };
      } else {
        return {
          decision: 'NO_MATCH',
          reason: `Identificadores diferentes do mesmo scheme (${input.identifierA.scheme})`
        };
      }
    }
  }

  const normA = normalizeEntityName(input.nameA);
  const normB = normalizeEntityName(input.nameB);

  // Regra Inegociável: Nome sozinho NUNCA funde pessoas
  if (input.entityType === 'PERSON') {
    if (normA === normB) {
      return {
        decision: 'MANUAL_REVIEW',
        reason: 'Homônimos em pessoas físicas exigem evidência ou identificador adicional; fusão proibida.'
      };
    }
    return {
      decision: 'NO_MATCH',
      reason: 'Nomes de pessoas físicas distintos.'
    };
  }

  // Organizações
  if (normA === normB) {
    return {
      decision: 'POSSIBLE_MATCH',
      reason: 'Nomes empresariais correspondentes; requer confirmação por CNPJ.'
    };
  }

  return {
    decision: 'NO_MATCH',
    reason: 'Organizações com denominações sociais distintas.'
  };
}
