export enum AccountStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

export interface User {
  id: string;
  status: AccountStatus;

  nome: string;
  cpf_cnpj: string;
  email: string;
  telefone: string;
  avatar_url?: string;

  estado: string;
  municipio: string;
  coordenadas?: { lat: number; lng: number };

  documento_verificado: boolean;
  verificado_em?: string;

  criado_em: string;
  atualizado_em: string;
  ultimo_login?: string;
  aceite_termos: string;
  aceite_privacidade: string;
}

export interface Propriedade {
  id: string;
  produtor_id: string;
  nome: string;
  area_total_hectares: number;
  altitude_metros?: number;
  regiao_cafeeira?: string;
  municipio?: string;
  estado?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  tipo: 'TERMOS_USO' | 'PRIVACIDADE' | 'MARKETING';
  aceito: boolean;
  ip_address?: string;
  timestamp: string;
  versao_documento: string;
}
