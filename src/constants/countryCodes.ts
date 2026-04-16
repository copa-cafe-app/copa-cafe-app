export interface CountryCode {
  code: string;
  dial: string;
  flag: string;
  name: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: 'BR', dial: '55', flag: '\u{1F1E7}\u{1F1F7}', name: 'Brasil' },
  { code: 'GB', dial: '44', flag: '\u{1F1EC}\u{1F1E7}', name: 'Reino Unido' },
  { code: 'US', dial: '1', flag: '\u{1F1FA}\u{1F1F8}', name: 'Estados Unidos' },
  { code: 'CO', dial: '57', flag: '\u{1F1E8}\u{1F1F4}', name: 'Col\u00f4mbia' },
  { code: 'MX', dial: '52', flag: '\u{1F1F2}\u{1F1FD}', name: 'M\u00e9xico' },
  { code: 'GT', dial: '502', flag: '\u{1F1EC}\u{1F1F9}', name: 'Guatemala' },
  { code: 'HN', dial: '504', flag: '\u{1F1ED}\u{1F1F3}', name: 'Honduras' },
  { code: 'PE', dial: '51', flag: '\u{1F1F5}\u{1F1EA}', name: 'Peru' },
  { code: 'CR', dial: '506', flag: '\u{1F1E8}\u{1F1F7}', name: 'Costa Rica' },
  { code: 'NI', dial: '505', flag: '\u{1F1F3}\u{1F1EE}', name: 'Nicar\u00e1gua' },
  { code: 'SV', dial: '503', flag: '\u{1F1F8}\u{1F1FB}', name: 'El Salvador' },
  { code: 'EC', dial: '593', flag: '\u{1F1EA}\u{1F1E8}', name: 'Equador' },
  { code: 'VE', dial: '58', flag: '\u{1F1FB}\u{1F1EA}', name: 'Venezuela' },
  { code: 'BO', dial: '591', flag: '\u{1F1E7}\u{1F1F4}', name: 'Bol\u00edvia' },
  { code: 'PA', dial: '507', flag: '\u{1F1F5}\u{1F1E6}', name: 'Panam\u00e1' },
  { code: 'DO', dial: '1809', flag: '\u{1F1E9}\u{1F1F4}', name: 'Rep. Dominicana' },
  { code: 'CU', dial: '53', flag: '\u{1F1E8}\u{1F1FA}', name: 'Cuba' },
  { code: 'JM', dial: '1876', flag: '\u{1F1EF}\u{1F1F2}', name: 'Jamaica' },
  { code: 'PY', dial: '595', flag: '\u{1F1F5}\u{1F1FE}', name: 'Paraguai' },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // Brasil
