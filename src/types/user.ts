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
  // Nulo em contas legadas criadas só por telefone (sem email). O banco aceita
  // NULL de propósito: string vazia colidia no índice UNIQUE. Ver migration
  // 20260724140000_users_email_nullable.sql.
  email: string | null;
  telefone: string;
  avatar_url?: string;

  estado: string;
  municipio: string;
  lat?: number;
  lng?: number;

  documento_verificado: boolean;
  verificado_em?: string;

  criado_em: string;
  atualizado_em: string;
  ultimo_login?: string;
  aceite_termos: string;
  aceite_privacidade: string;
  skip_2fa?: boolean;
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
