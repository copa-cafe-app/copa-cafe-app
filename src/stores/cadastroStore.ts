import { create } from 'zustand';

interface CadastroState {
  // Step 1
  email: string;
  senha: string;
  telefone: string;
  countryDial: string;
  // Step 2
  otpCode: string;
  // Step 3
  nome: string;
  cpfCnpj: string;
  estado: string;
  municipio: string;
  // Step 4
  nomeFazenda: string;
  areaHectares: string;
  altitudeMetros: string;
  regiaoCafeeira: string;
  certificacoes: string[];
  // Step 5
  aceitouTermos: boolean;
  aceitouPrivacidade: boolean;

  setField: (field: string, value: any) => void;
  reset: () => void;
}

const initialState = {
  email: '',
  senha: '',
  telefone: '',
  countryDial: '55',
  otpCode: '',
  nome: '',
  cpfCnpj: '',
  estado: '',
  municipio: '',
  nomeFazenda: '',
  areaHectares: '',
  altitudeMetros: '',
  regiaoCafeeira: '',
  certificacoes: [],
  aceitouTermos: false,
  aceitouPrivacidade: false,
};

export const useCadastroStore = create<CadastroState>((set) => ({
  ...initialState,
  setField: (field, value) => set({ [field]: value }),
  reset: () => set(initialState),
}));
