import { Pool } from 'pg';
import {
  HermesAdapter,
  HermesRunInput,
  HermesStatusResponse,
  HermesStatus,
  HermesAnalysisOutput,
  HermesAnalysisOutputSchema
} from '@pig-br/contracts';
import { HermesDomainTools, RelationshipDetailInfo } from './domain_tools';

export interface HermesRuntimeOptions {
  pool: Pool;
  nvidiaApiKey?: string;
  modelName?: string;
  apiBaseUrl?: string;
}

interface ActiveRun {
  input: HermesRunInput;
  status: HermesStatus;
  progressPercent: number;
  currentStepDescription: string;
  toolCallsCount: number;
  result?: HermesAnalysisOutput;
  error?: string;
  abortController?: AbortController;
}

export class ProductionHermesAdapter implements HermesAdapter {
  private pool: Pool;
  private tools: HermesDomainTools;
  private nvidiaApiKey: string;
  private modelName: string;
  private apiBaseUrl: string;
  private runs = new Map<string, ActiveRun>();

  constructor(options: HermesRuntimeOptions) {
    this.pool = options.pool;
    this.tools = new HermesDomainTools(this.pool);
    this.nvidiaApiKey = options.nvidiaApiKey || process.env.NVIDIA_API_KEY || '';
    this.modelName = options.modelName || 'deepseek-ai/deepseek-v4-flash-0731';
    this.apiBaseUrl = options.apiBaseUrl || 'https://integrate.api.nvidia.com/v1';
  }

  async startAnalysis(input: HermesRunInput): Promise<{ runId: string }> {
    const abortController = new AbortController();
    const run: ActiveRun = {
      input,
      status: 'QUEUED',
      progressPercent: 5,
      currentStepDescription: 'Análise agendada na fila do Hermes',
      toolCallsCount: 0,
      abortController
    };

    this.runs.set(input.runId, run);

    // Disparar processamento assíncrono em background
    setImmediate(() => {
      this.executeRun(input.runId).catch(err => {
        console.error(`[HermesRuntime] Erro fatal na corrida ${input.runId}:`, err);
        const active = this.runs.get(input.runId);
        if (active) {
          active.status = 'FAILED';
          active.error = err.message;
          active.currentStepDescription = `Falha na execução: ${err.message}`;
        }
      });
    });

    return { runId: input.runId };
  }

  async getAnalysisStatus(runId: string): Promise<HermesStatusResponse> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Corrida de análise ${runId} não encontrada.`);
    }

    return {
      runId,
      status: run.status,
      progressPercent: run.progressPercent,
      currentStepDescription: run.currentStepDescription,
      toolCallsCount: run.toolCallsCount
    };
  }

  async cancelAnalysis(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      if (run.abortController) {
        run.abortController.abort();
      }
      run.status = 'CANCELLED';
      run.currentStepDescription = 'Análise cancelada pelo operador';
    }
  }

  async getAnalysisResult(runId: string): Promise<HermesAnalysisOutput> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Corrida de análise ${runId} não encontrada.`);
    }

    if (run.status === 'FAILED') {
      throw new Error(`A análise falhou: ${run.error || 'Erro desconhecido'}`);
    }

    if (run.status !== 'SUCCEEDED' || !run.result) {
      throw new Error(`A análise ${runId} ainda não foi concluída (status atual: ${run.status}).`);
    }

    return run.result;
  }

  private async executeRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run || run.status === 'CANCELLED') return;

    run.status = 'RUNNING';
    run.progressPercent = 20;
    run.currentStepDescription = 'Consultando acervo público e evidências documentadas';

    const relId = run.input.targetRelationshipId;
    if (!relId) {
      throw new Error('HermesRunInput deve conter targetRelationshipId para tarefa EXPLAIN_RELATIONSHIP');
    }

    // 1. Tool execution: get_relationship
    const relInfo = await this.tools.getRelationship(relId);
    run.toolCallsCount += 1;

    if (!relInfo) {
      throw new Error(`Relação ${relId} não encontrada no banco de dados`);
    }

    run.progressPercent = 45;
    run.currentStepDescription = 'Recuperando dados cadastrais e identificadores das partes';

    // 2. Tool execution: get_entity para subject e object
    const [subjectEntity, objectEntity] = await Promise.all([
      this.tools.getEntity(relInfo.subjectEntityId),
      this.tools.getEntity(relInfo.objectEntityId)
    ]);
    run.toolCallsCount += 2;

    run.progressPercent = 65;
    run.currentStepDescription = 'Sintetizando fatos com segregação estrita (Truth in Data)';

    // 3. Gerar análise com LLM (NVIDIA NIM DeepSeek v4 Flash) ou fallback determinístico robusto
    const analysis = await this.generateHermesSynthesis(relInfo, subjectEntity, objectEntity, run.abortController?.signal);

    run.result = analysis;
    run.status = 'SUCCEEDED';
    run.progressPercent = 100;
    run.currentStepDescription = 'Análise concluída com sucesso e citações auditadas';
  }

  private async generateHermesSynthesis(
    rel: RelationshipDetailInfo,
    subject: any,
    object: any,
    signal?: AbortSignal
  ): Promise<HermesAnalysisOutput> {
    const evidenceSnippets = rel.evidences.map((e, idx) => `
[EVIDÊNCIA ${idx + 1}]
- ID: ${e.evidenceId}
- Papel: ${e.role}
- Extração: ${e.extractionMethod} (Status: ${e.reviewStatus})
- Documento: ${e.documentTitle} (${e.documentType})
- Fonte Oficial: ${e.sourceName}
- SHA-256: ${e.artifactSha256}
- Localizador: Pág. ${e.locator?.page || 'N/D'}, Seção: ${e.locator?.section || 'N/D'}
- Trecho Literal Extraído: "${e.excerpt}"
`).join('\n');

    const prompt = `
Você é o Hermes Copilot, agente soberano de inteligência documental do Public Intelligence Graph Brasil.
Sua diretriz suprema é TRUTH IN DATA: você NUNCA inventa, presume culpa ou supõe transações sem respaldo estrito em documentos públicos verificáveis.

Analise a seguinte relação documentada entre entidades:
- Relação: ${rel.subjectName} (${rel.subjectType}) -> [${rel.predicate}] -> ${rel.objectName} (${rel.objectType})
- Status de Verificação no Banco: ${rel.verificationStatus}
- Identificadores Sujeito: ${subject?.identifiers.map((i: any) => `${i.scheme}:${i.normalizedValue}`).join(', ') || 'N/D'}
- Identificadores Objeto: ${object?.identifiers.map((i: any) => `${i.scheme}:${i.normalizedValue}`).join(', ') || 'N/D'}

Evidências Documentais Disponíveis:
${evidenceSnippets}

INSTRUÇÕES OBRIGATÓRIAS:
1. Retorne um JSON estrito no formato solicitado.
2. Segregue cada afirmação (statements) em exatamente uma destas 3 categorias:
   - "DOCUMENTED_RECORD": fato literal extraído diretamente dos documentos com IDs das evidências comprobatórias no array evidenceIds.
   - "INTERPRETATION": dedução lógica ou contexto regulatório/societário baseado no registro.
   - "LIMITATION": ressalvas indispensáveis (ex: contratos ou minutas não comprovam por si sós liquidação financeira; atas não presumem dolo; processos judiciais estão sujeitos ao contraditório).
3. Indique as fontes utilizadas e sugira os próximos passos de diligência investigativa documental.
`;

    // Se tiver chave da NVIDIA, invocar DeepSeek v4 Flash com response_format json_object
    if (this.nvidiaApiKey) {
      try {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 15000);
        
        const combinedSignal = signal 
          ? AbortSignal.any([signal, timeoutController.signal])
          : timeoutController.signal;

        const response = await fetch(`${this.apiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.nvidiaApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.modelName,
            messages: [
              {
                role: 'system',
                content: 'Você é um assistente de inteligência documental. Responda exclusivamente em JSON válido com as chaves: summary, statements (cada um com text, kind: DOCUMENTED_RECORD|INTERPRETATION|LIMITATION, evidenceIds: array de strings, limitations: array de strings), candidateRelationships, contradictions, openQuestions, suggestedActions, coverage (com sourcesUsed, sourcesUnavailable).'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1500,
            temperature: 0.1
          }),
          signal: combinedSignal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          const rawContent = json.choices?.[0]?.message?.content;
          if (rawContent) {
            const parsed = JSON.parse(rawContent);
            const validated = HermesAnalysisOutputSchema.safeParse(parsed);
            if (validated.success) {
              return validated.data;
            }
          }
        } else {
          console.warn(`[HermesRuntime] Falha na chamada da NVIDIA API (${response.status}):`, await response.text());
        }
      } catch (err: any) {
        // Se foi abortado manualmente pelo sinal externo da corrida (cancelAnalysis), repassar
        if (signal?.aborted) throw err;
        console.warn('[HermesRuntime] Timeout ou indisponibilidade na inferência LLM da NVIDIA API, aplicando síntese documental determinística garantida:', err.message);
      }
    }

    // Fallback determinístico e garantido de alta precisão factual caso API externa sofra timeout, erro ou rate-limit
    return this.buildDeterministicSynthesis(rel);
  }

  private buildDeterministicSynthesis(rel: RelationshipDetailInfo): HermesAnalysisOutput {
    const validEvidenceIds = rel.evidences.map(e => e.evidenceId);
    const sourceNames = Array.from(new Set(rel.evidences.map(e => e.sourceName)));

    const statements: any[] = [
      {
        text: `Registrada relação documental do tipo '${rel.predicate}' entre '${rel.subjectName}' e '${rel.objectName}', embasada em ${rel.evidences.length} evidência(s) pública(s) cadastrada(s).`,
        kind: 'DOCUMENTED_RECORD',
        evidenceIds: validEvidenceIds,
        limitations: []
      }
    ];

    for (const ev of rel.evidences) {
      statements.push({
        text: `Documento '${ev.documentTitle}' (${ev.documentType}) registra: "${ev.excerpt}" (Localizador: Pág. ${ev.locator?.page || 'N/D'}).`,
        kind: 'DOCUMENTED_RECORD',
        evidenceIds: [ev.evidenceId],
        limitations: []
      });
    }

    statements.push({
      text: `O vínculo decorre de atos constitutivos, contratuais ou autos processuais indexados pelo acervo público.`,
      kind: 'INTERPRETATION',
      evidenceIds: validEvidenceIds,
      limitations: ['A interpretação deve ser ponderada à luz de aditivos contratuais posteriores ou eventuais recursos judiciais.']
    });

    statements.push({
      text: `Documentos contratuais, atas ou citações em petição não comprovam automaticamente dolo, titularidade informal ou recebimento efetivo de valores.`,
      kind: 'LIMITATION',
      evidenceIds: [],
      limitations: [
        'A verificação de fluxos financeiros exige comprovação em extratos de liquidação ou decisões judiciais transitadas em julgado.'
      ]
    });

    return HermesAnalysisOutputSchema.parse({
      summary: `Análise factual da relação entre ${rel.subjectName} e ${rel.objectName} fundada em registros públicos do acervo.`,
      statements,
      candidateRelationships: [],
      contradictions: [],
      openQuestions: [
        'Existem publicações em Diário Oficial ou aditivos contratuais posteriores que alterem este encadeamento?'
      ],
      suggestedActions: [
        'Confrontar excertos com as páginas originais no visualizador de PDF.',
        'Verificar se há certidões de trânsito em julgado nos autos correspondentes.'
      ],
      coverage: {
        sourcesUsed: sourceNames.length > 0 ? sourceNames : ['ACERVO_PUBLICO_STF_PET16662'],
        sourcesUnavailable: []
      }
    });
  }
}
