import { createHash } from 'node:crypto';
import type { EvidenceLocator } from '@pig-br/contracts';

/**
 * Calcula o hash SHA-256 de qualquer artefato bruto ou texto coletado.
 */
export function calculateSha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Validador estrito de integridade literal de evidência.
 * O trecho indicado no locator DEVE constar literalmente no documento original.
 */
export function verifyExcerptIntegrity(
  fullDocumentText: string,
  locator: EvidenceLocator
): { valid: boolean; calculatedOffset?: number; reason?: string } {
  if (!locator.exactText || locator.exactText.trim().length === 0) {
    return { valid: false, reason: 'O trecho exato da evidência não pode ser vazio.' };
  }

  const foundIndex = fullDocumentText.indexOf(locator.exactText);
  if (foundIndex === -1) {
    return {
      valid: false,
      reason: 'O trecho indicado não existe literalmente no corpo do documento.'
    };
  }

  return {
    valid: true,
    calculatedOffset: foundIndex
  };
}
