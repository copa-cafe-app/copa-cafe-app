export type AtividadeTipo = 'ADUBACAO' | 'PULVERIZACAO' | 'PODA' | 'COLHEITA' | 'IRRIGACAO' | 'OUTRO';

export interface Atividade {
  id: string;
  produtor_id: string;
  tipo: AtividadeTipo;
  titulo: string;
  descricao?: string;
  data: string; // YYYY-MM-DD
  custo?: number;
  criado_em: string;
}

export const ATIVIDADE_LABELS: Record<AtividadeTipo, string> = {
  ADUBACAO: 'Adubação',
  PULVERIZACAO: 'Pulverização',
  PODA: 'Poda',
  COLHEITA: 'Colheita',
  IRRIGACAO: 'Irrigação',
  OUTRO: 'Outro',
};

export const ATIVIDADE_CORES: Record<AtividadeTipo, string> = {
  COLHEITA: '#2E7D32',
  IRRIGACAO: '#1565C0',
  ADUBACAO: '#E65100',
  PULVERIZACAO: '#C62828',
  PODA: '#6A1B9A',
  OUTRO: '#757575',
};
