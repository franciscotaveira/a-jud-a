/**
 * Normaliza e valida CNPJ segundo o algoritmo oficial da Receita Federal.
 */
export function normalizeCnpj(input: string): string {
  return input.replace(/\D/g, '');
}

export function isValidCnpj(rawCnpj: string): boolean {
  const cnpj = normalizeCnpj(rawCnpj);

  if (cnpj.length !== 14) return false;
  // Rejeita sequências de dígitos repetidos, inclusive 00000000000000
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
 */
export function normalizeEntityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export type MatchDecision = 'AUTO_MATCH' | 'POSSIBLE_MATCH' | 'MANUAL_REVIEW' | 'NO_MATCH';

export interface EntityIdentifierInput {
  scheme: 'CNPJ' | 'CPF' | 'CVM_CODE' | 'BACEN_CODE' | 'PROCESS_CNJ' | 'AIRCRAFT_REGISTRATION' | string;
  value: string;
  jurisdiction?: string;
}

export interface IdentityResolutionInput {
  entityTypeA: 'ORGANIZATION' | 'PERSON' | 'PROCESS' | 'CONTRACT' | 'FUND' | 'AIRCRAFT';
  entityTypeB: 'ORGANIZATION' | 'PERSON' | 'PROCESS' | 'CONTRACT' | 'FUND' | 'AIRCRAFT';
  nameA: string;
  nameB: string;
  identifierA?: EntityIdentifierInput;
  identifierB?: EntityIdentifierInput;
  jurisdictionA?: string;
  jurisdictionB?: string;
}

/**
 * Resolução conservadora de identidades conforme MASTER SPEC.
 * - Valida e normaliza identificadores antes de qualquer decisão AUTO_MATCH.
 * - Respeita tipo de entidade, scheme e jurisdição.
 * - Caso de regressão obrigatório: CNPJ 00000000000000 NUNCA produz AUTO_MATCH.
 * - Pessoas físicas NUNCA sofrem fusão apenas por nome.
 */
export function resolveIdentity(input: IdentityResolutionInput): {
  decision: MatchDecision;
  reason: string;
} {
  // 1. Tipos de entidade incompatíveis nunca se fundem
  if (input.entityTypeA !== input.entityTypeB) {
    return {
      decision: 'NO_MATCH',
      reason: `Tipos de entidade distintos: ${input.entityTypeA} e ${input.entityTypeB}.`
    };
  }

  // 2. Jurisdições conflitantes
  const jurA = input.jurisdictionA || 'BR';
  const jurB = input.jurisdictionB || 'BR';
  if (jurA !== jurB) {
    return {
      decision: 'NO_MATCH',
      reason: `Jurisdições incompatíveis: ${jurA} e ${jurB}.`
    };
  }

  // 3. Avaliação de identificadores oficiais (com validação prévia)
  if (input.identifierA && input.identifierB) {
    // Mesma jurisdição de identificador
    const identJurA = input.identifierA.jurisdiction || jurA;
    const identJurB = input.identifierB.jurisdiction || jurB;
    if (identJurA !== identJurB) {
      return {
        decision: 'NO_MATCH',
        reason: 'Identificadores pertencem a jurisdições distintas.'
      };
    }

    // Mesmo scheme de identificador
    if (input.identifierA.scheme === input.identifierB.scheme) {
      if (input.identifierA.scheme === 'CNPJ') {
        const cnpjA = normalizeCnpj(input.identifierA.value);
        const cnpjB = normalizeCnpj(input.identifierB.value);

        // REGRA DE REGRESSÃO OBRIGATÓRIA:
        // Se qualquer um dos CNPJs for inválido (como 00000000000000), NÃO pode dar AUTO_MATCH!
        if (!isValidCnpj(cnpjA) || !isValidCnpj(cnpjB)) {
          return {
            decision: 'MANUAL_REVIEW',
            reason: 'Identificador CNPJ inválido ou corrompido detectado; AUTO_MATCH bloqueado.'
          };
        }

        if (cnpjA === cnpjB) {
          return {
            decision: 'AUTO_MATCH',
            reason: 'CNPJs oficiais válidos e correspondentes.'
          };
        } else {
          return {
            decision: 'NO_MATCH',
            reason: 'CNPJs válidos distintos.'
          };
        }
      }

      // Outros schemes (CVM, BACEN, etc.)
      const valA = input.identifierA.value.trim();
      const valB = input.identifierB.value.trim();
      if (valA === valB && valA.length > 0) {
        return {
          decision: 'AUTO_MATCH',
          reason: `Identificadores correspondentes no scheme ${input.identifierA.scheme}.`
        };
      } else {
        return {
          decision: 'NO_MATCH',
          reason: `Valores distintos no scheme ${input.identifierA.scheme}.`
        };
      }
    }
  }

  const normA = normalizeEntityName(input.nameA);
  const normB = normalizeEntityName(input.nameB);

  // 4. REGRA INEGOCIÁVEL: Pessoas físicas NUNCA sofrem fusão apenas por nome
  if (input.entityTypeA === 'PERSON') {
    if (normA === normB) {
      return {
        decision: 'MANUAL_REVIEW',
        reason: 'Homônimos em pessoas físicas exigem identificador unívoco ou evidência documental adicional; fusão automática proibida.'
      };
    }
    return {
      decision: 'NO_MATCH',
      reason: 'Nomes de pessoas físicas distintos.'
    };
  }

  // 5. Organizações com mesmo nome mas sem CNPJ
  if (normA === normB) {
    return {
      decision: 'POSSIBLE_MATCH',
      reason: 'Nomes empresariais correspondentes; requer confirmação por identificador oficial.'
    };
  }

  return {
    decision: 'NO_MATCH',
    reason: 'Denominações distintas.'
  };
}
