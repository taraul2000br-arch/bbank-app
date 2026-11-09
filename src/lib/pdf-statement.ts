import {
  BANK_LOGO_WIDTH,
  BANK_LOGO_HEIGHT,
  BANK_LOGO_ASPECT_RATIO,
  getBankLogoJpegBytes,
} from "./pdf-logo.ts";

export interface StatementTx {
  date: string;
  time: string;
  description: string;
  type: string;
  amount: number;
  balanceAfter?: number | null;
}

export function getTxSignedAmount(tx: { type?: string | null; amount: number; description?: string | null }): number {
  const rawAmt = Math.abs(Number(tx.amount) || 0);
  const typeStr = (tx.type || "").toLowerCase();
  const descStr = (tx.description || "").toLowerCase();

  if (
    typeStr === "saida" ||
    typeStr.includes("debit") ||
    typeStr.includes("saque") ||
    typeStr.includes("withdrawal") ||
    descStr.includes("saída") ||
    descStr.includes("saida") ||
    descStr.includes("debit") ||
    descStr.includes("transfer to") ||
    Number(tx.amount) < 0
  ) {
    return -rawAmt;
  }
  return rawAmt;
}

export interface StatementData {
  accountHolder: string;
  sortCode: string;
  accountNumber: string;
  iban: string;
  currency: string;
  periodLabel: string;
  lang?: string; // 'en' | 'pt' | 'es'
  documentTitle?: string;
  documentSubtitle?: string;
  isFiltered?: boolean;
  currentBalance: number;
  openingBalance?: number | null;
  closingBalance?: number | null;
  totalInflow: number;
  totalOutflow: number;
  transactions: StatementTx[];
  generatedAt: string;
}

// Windows-1252 mapping for Western European languages and typography
const WIN1252_SPECIAL_MAP: Record<string, number> = {
  '\u20AC': 0x80, // Euro €
  '\u201A': 0x82, // Single low-9 quotation mark ‚
  '\u0192': 0x83, // Latin small letter f with hook ƒ
  '\u201E': 0x84, // Double low-9 quotation mark „
  '\u2026': 0x85, // Horizontal ellipsis …
  '\u2020': 0x86, // Dagger †
  '\u2021': 0x87, // Double dagger ‡
  '\u02C6': 0x88, // Modifier letter circumflex accent ˆ
  '\u2030': 0x89, // Per mille sign ‰
  '\u0160': 0x8A, // Latin capital letter S with caron Š
  '\u2039': 0x8B, // Single left-pointing angle quotation mark ‹
  '\u0152': 0x8C, // Latin capital ligature OE Œ
  '\u017D': 0x8E, // Latin capital letter Z with caron Ž
  '\u2018': 0x91, // Left single quotation mark ‘
  '\u2019': 0x92, // Right single quotation mark ’
  '\u201C': 0x93, // Left double quotation mark “
  '\u201D': 0x94, // Right double quotation mark ”
  '\u2022': 0x95, // Bullet •
  '\u2013': 0x96, // En dash –
  '\u2014': 0x97, // Em dash —
  '\u02DC': 0x98, // Small tilde ˜
  '\u2122': 0x99, // Trade mark sign ™
  '\u0161': 0x9A, // Latin small letter s with caron š
  '\u203A': 0x9B, // Single right-pointing angle quotation mark ›
  '\u0153': 0x9C, // Latin small ligature oe œ
  '\u017E': 0x9E, // Latin small letter z with caron ž
  '\u0178': 0x9F, // Latin capital letter Y with diaeresis Ÿ
};

export function escapePdfText(str: string): string {
  if (!str) return '';
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    if (ch === '\\') {
      res += '\\\\';
    } else if (ch === '(') {
      res += '\\(';
    } else if (ch === ')') {
      res += '\\)';
    } else if (code >= 32 && code <= 126) {
      res += ch;
    } else if (code >= 160 && code <= 255) {
      // Latin-1 / Windows-1252 direct accented letters (á, é, í, ó, ú, ç, ã, õ, £, §, etc.)
      res += '\\' + code.toString(8).padStart(3, '0');
    } else if (WIN1252_SPECIAL_MAP[ch] !== undefined) {
      res += '\\' + WIN1252_SPECIAL_MAP[ch].toString(8).padStart(3, '0');
    } else {
      res += ' ';
    }
  }
  return res;
}

export function measureTextWidth(text: string, fontSize: number, isBold = false): number {
  let width = 0;
  const factor = isBold ? 1.06 : 1.0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '.' || ch === ',' || ch === ':' || ch === ' ' || ch === '!' || ch === '\'' || ch === ';') {
      width += fontSize * 0.28;
    } else if (ch === 'i' || ch === 'l' || ch === 'I' || ch === 't' || ch === 'j' || ch === 'f') {
      width += fontSize * 0.32;
    } else if (ch === 'w' || ch === 'W' || ch === 'm' || ch === 'M' || ch === '@' || ch === '%') {
      width += fontSize * 0.85;
    } else if (ch >= 'A' && ch <= 'Z') {
      width += fontSize * 0.65;
    } else if (ch >= '0' && ch <= '9') {
      width += fontSize * 0.55;
    } else {
      width += fontSize * 0.52;
    }
  }
  return width * factor;
}

export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureTextWidth(testLine, fontSize);
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

type StatementI18n = {
  demoNotice: string;
  demoSubtitle: string;
  statementTitle: string;
  filteredReportTitle: string;
  issued: string;
  docRef: string;
  accountDetails: string;
  accountHolder: string;
  sortCodeAndAccount: string;
  statementPeriod: string;
  reportPeriod: string;
  iban: string;
  currency: string;
  financialSummary: string;
  openingBalance: string;
  closingBalance: string;
  moneyIn: string;
  moneyOut: string;
  balance: string;
  notAvailable: string;
  transactionHistory: string;
  colDate: string;
  colDetails: string;
  colMoneyOut: string;
  colMoneyIn: string;
  colBalance: string;
  noTxTitle: string;
  noTxDesc: string;
  docInfoTitle: string;
  docInfoP1: string;
  docInfoP2: string;
  footerDisclaimer: string;
  pageOf: (p: number, t: number) => string;
};

const I18N_DICT: Record<string, StatementI18n> = {
  en: {
    demoNotice: "",
    demoSubtitle: "",
    statementTitle: "Bank Statement",
    filteredReportTitle: "Filtered Transaction Report",
    issued: "Issue Date",
    docRef: "STATEMENT REF",
    accountDetails: "ACCOUNT INFORMATION",
    accountHolder: "ACCOUNT HOLDER",
    sortCodeAndAccount: "SORT CODE & ACCOUNT NUMBER",
    statementPeriod: "STATEMENT PERIOD",
    reportPeriod: "REPORT PERIOD (FILTERED)",
    iban: "IBAN",
    currency: "CURRENCY",
    financialSummary: "ACCOUNT SUMMARY",
    openingBalance: "OPENING BALANCE",
    closingBalance: "CLOSING BALANCE",
    moneyIn: "MONEY IN (+)",
    moneyOut: "MONEY OUT (-)",
    balance: "BALANCE",
    notAvailable: "Not available",
    transactionHistory: "TRANSACTION HISTORY",
    colDate: "DATE",
    colDetails: "DESCRIPTION",
    colMoneyOut: "MONEY OUT (£)",
    colMoneyIn: "MONEY IN (£)",
    colBalance: "BALANCE (£)",
    noTxTitle: "No transactions recorded for this period.",
    noTxDesc: "This account has not registered any settled incoming or outgoing transactions for the selected statement period.",
    docInfoTitle: "DOCUMENT INFORMATION & ADVISORY NOTES",
    docInfoP1: "Account statements reflect settled domestic and international transactions. For inquiries regarding statements, account status, or transactions, please consult B Bank Online or your relationship manager.",
    docInfoP2: "B Bank S.A. is authorised by the Prudential Regulation Authority and regulated by the Financial Conduct Authority and the Prudential Regulation Authority (Financial Services Register No. 759676).",
    footerDisclaimer: "",
    pageOf: (p, t) => `Page ${p} of ${t}`,
  },
  pt: {
    demoNotice: "",
    demoSubtitle: "",
    statementTitle: "Extrato Bancário",
    filteredReportTitle: "Relatório de Transações Filtradas",
    issued: "Data de Emissão",
    docRef: "REF. EXTRATO",
    accountDetails: "DADOS DA CONTA",
    accountHolder: "TITULAR DA CONTA",
    sortCodeAndAccount: "SORT CODE & NÚMERO DA CONTA",
    statementPeriod: "PERÍODO DO EXTRATO",
    reportPeriod: "PERÍODO DO RELATÓRIO (FILTRADO)",
    iban: "IBAN",
    currency: "MOEDA",
    financialSummary: "RESUMO DA CONTA",
    openingBalance: "SALDO INICIAL",
    closingBalance: "SALDO FINAL",
    moneyIn: "ENTRADAS (+)",
    moneyOut: "SAÍDAS (-)",
    balance: "SALDO",
    notAvailable: "Não disponível",
    transactionHistory: "HISTÓRICO DE MOVIMENTAÇÕES",
    colDate: "DATA",
    colDetails: "DESCRIÇÃO",
    colMoneyOut: "SAÍDAS (£)",
    colMoneyIn: "ENTRADAS (£)",
    colBalance: "SALDO (£)",
    noTxTitle: "Nenhuma movimentação registrada para este período.",
    noTxDesc: "Esta conta não registrou lançamentos liquidados de entrada ou saída durante o intervalo selecionado.",
    docInfoTitle: "INFORMAÇÕES SOBRE O DOCUMENTO E NOTAS ADICIONAIS",
    docInfoP1: "Os extratos bancários refletem transações nacionais e internacionais liquidadas. Para esclarecimentos sobre lançamentos ou movimentações, consulte o portal de internet banking ou seu gerente de relacionamento.",
    docInfoP2: "O B Bank S.A. é autorizado pela Prudential Regulation Authority e regulamentado pela Financial Conduct Authority e pela Prudential Regulation Authority (Registro nº 759676).",
    footerDisclaimer: "",
    pageOf: (p, t) => `Página ${p} de ${t}`,
  },
  es: {
    demoNotice: "",
    demoSubtitle: "",
    statementTitle: "Extracto Bancario",
    filteredReportTitle: "Informe de Transacciones Filtradas",
    issued: "Fecha de Emisión",
    docRef: "REF. EXTRACTO",
    accountDetails: "DATOS DE LA CUENTA",
    accountHolder: "TITULAR DE LA CUENTA",
    sortCodeAndAccount: "SORT CODE & NÚMERO DE CUENTA",
    statementPeriod: "PERÍODO DEL EXTRACTO",
    reportPeriod: "PERÍODO DEL INFORME (FILTRADO)",
    iban: "IBAN",
    currency: "MONEDA",
    financialSummary: "RESUMEN DE LA CUENTA",
    openingBalance: "SALDO INICIAL",
    closingBalance: "SALDO FINAL",
    moneyIn: "ENTRADAS (+)",
    moneyOut: "SALIDAS (-)",
    balance: "SALDO",
    notAvailable: "No disponible",
    transactionHistory: "HISTORIAL DE MOVIMIENTOS",
    colDate: "FECHA",
    colDetails: "DESCRIPCIÓN",
    colMoneyOut: "SALIDAS (£)",
    colMoneyIn: "ENTRADAS (£)",
    colBalance: "SALDO (£)",
    noTxTitle: "No hay transacciones registradas para este período.",
    noTxDesc: "Esta cuenta no registró transacciones liquidadas de entrada o salida para el intervalo seleccionado.",
    docInfoTitle: "INFORMACIÓN DEL DOCUMENTO Y NOTAS ADICIONALES",
    docInfoP1: "Los extractos bancarios reflejan transacciones nacionales e internacionales liquidadas. Para consultas sobre movimientos o estados de cuenta, consulte el portal de banca digital o su gestor.",
    docInfoP2: "B Bank S.A. está autorizado por la Prudential Regulation Authority y regulado por la Financial Conduct Authority y la Prudential Regulation Authority (Registro nº 759676).",
    footerDisclaimer: "",
    pageOf: (p, t) => `Página ${p} de ${t}`,
  },
};

// Rounded rectangle vector path generator
function roundedRect(
  x: number, y: number, w: number, h: number, r: number,
  fillR: number, fillG: number, fillB: number,
  strokeR: number, strokeG: number, strokeB: number,
  strokeW = 0.5, fill = true, stroke = true
): string {
  const k = r * 0.5522847;
  let s = '';
  s += `${strokeW.toFixed(2)} w\n`;
  if (fill) s += `${fillR.toFixed(3)} ${fillG.toFixed(3)} ${fillB.toFixed(3)} rg\n`;
  if (stroke) s += `${strokeR.toFixed(3)} ${strokeG.toFixed(3)} ${strokeB.toFixed(3)} RG\n`;
  
  s += `${(x + r).toFixed(2)} ${y.toFixed(2)} m\n`;
  s += `${(x + w - r).toFixed(2)} ${y.toFixed(2)} l\n`;
  s += `${(x + w - r + k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + w).toFixed(2)} ${(y + r).toFixed(2)} c\n`;
  s += `${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} l\n`;
  s += `${(x + w).toFixed(2)} ${(y + h - r + k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)} c\n`;
  s += `${(x + r).toFixed(2)} ${(y + h).toFixed(2)} l\n`;
  s += `${(x + r - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r + k).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)} c\n`;
  s += `${x.toFixed(2)} ${(y + r).toFixed(2)} l\n`;
  s += `${x.toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + r - k).toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c\n`;
  s += `h\n`;
  s += fill && stroke ? 'B\n' : fill ? 'f\n' : 'S\n';
  return s;
}

// Rounded rectangle with ONLY TOP corners rounded (for table headers and cards)
function topRoundedRect(
  x: number, y: number, w: number, h: number, r: number,
  fillR: number, fillG: number, fillB: number,
  strokeR: number, strokeG: number, strokeB: number,
  strokeW = 0.5, fill = true, stroke = true
): string {
  const k = r * 0.5522847;
  let s = '';
  s += `${strokeW.toFixed(2)} w\n`;
  if (fill) s += `${fillR.toFixed(3)} ${fillG.toFixed(3)} ${fillB.toFixed(3)} rg\n`;
  if (stroke) s += `${strokeR.toFixed(3)} ${strokeG.toFixed(3)} ${strokeB.toFixed(3)} RG\n`;
  
  s += `${x.toFixed(2)} ${y.toFixed(2)} m\n`;
  s += `${(x + w).toFixed(2)} ${y.toFixed(2)} l\n`;
  s += `${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} l\n`;
  s += `${(x + w).toFixed(2)} ${(y + h - r + k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)} c\n`;
  s += `${(x + r).toFixed(2)} ${(y + h).toFixed(2)} l\n`;
  s += `${(x + r - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r + k).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)} c\n`;
  s += `${x.toFixed(2)} ${(y + h - r).toFixed(2)} l\n`;
  s += `${x.toFixed(2)} ${y.toFixed(2)} l\n`;
  s += `h\n`;
  s += fill && stroke ? 'B\n' : fill ? 'f\n' : 'S\n';
  return s;
}

// Draw B Bank Eagle logo image XObject (/Im1)
function drawEagleLogo(x: number, y: number, height = 26): { ops: string; width: number } {
  const width = height * BANK_LOGO_ASPECT_RATIO;
  const ops = `q\n${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im1 Do\nQ\n`;
  return { ops, width };
}

export function downloadStatementPdf(data: StatementData, customFilename?: string): void {
  if (typeof window === "undefined") return;
  const bytes = generateStatementPdfBytes(data);
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = customFilename || `bbank-statement-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function generateStatementPdfBytes(data: StatementData): Uint8Array {
  // A4 dimensions in points: 595.28 x 841.89
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 36;
  const MARGIN_RIGHT = 36;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 523.28 pt

  const langKey = data.lang && I18N_DICT[data.lang] ? data.lang : "en";
  const i18n = I18N_DICT[langKey] || I18N_DICT.en;

  function fmtMoney(amount: number, forcePlus = false): string {
    const formatted = Math.abs(amount).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const prefix = amount < 0 ? '-' : (forcePlus && amount > 0) ? '+' : '';
    return `${prefix}£${formatted}`;
  }

  // Pre-calculate running balances for transactions when openingBalance is available
  const hasOpening = data.openingBalance !== null && data.openingBalance !== undefined;
  let running = hasOpening ? (data.openingBalance as number) : 0;
  const txsWithBalances: StatementTx[] = [];

  for (const t of data.transactions) {
    const signed = getTxSignedAmount(t);
    running += signed;
    txsWithBalances.push({
      ...t,
      amount: signed,
      balanceAfter: hasOpening ? running : (t.balanceAfter ?? null),
    });
  }

  // Row height calculation helper
  const colDateX = MARGIN_LEFT + 8;
  const colDescX = MARGIN_LEFT + 72;
  const colOutX = MARGIN_LEFT + 280;
  const colInX = MARGIN_LEFT + 360;
  const colBalX = MARGIN_LEFT + 440;
  const rightEdge = MARGIN_LEFT + CONTENT_WIDTH;
  const maxDescWidth = colOutX - colDescX - 12; // ~196 pt

  const calcRowHeight = (tx: StatementTx) => {
    const descText = tx.description || tx.type || "Transaction";
    const descLines = wrapText(descText, maxDescWidth, 8);
    const hasCategory = tx.type && tx.type !== tx.description;
    const extraLines = (descLines.length - 1) + (hasCategory ? 1 : 0);
    return Math.max(22, 22 + extraLines * 10);
  };

  // Dynamic pagination: page 1 has header cards, subsequent pages have continuation headers
  const PAGE1_ROW_START_Y = 526;
  const SUBSEQUENT_ROW_START_Y = 764;
  const MIN_ROW_Y = 65; // Stop well before the footer at Y = 32

  const pagesData: StatementTx[][] = [];
  if (txsWithBalances.length === 0) {
    pagesData.push([]);
  } else {
    let currentPageList: StatementTx[] = [];
    let currentAvailableY = PAGE1_ROW_START_Y;
    let isP1 = true;

    for (const tx of txsWithBalances) {
      const rh = calcRowHeight(tx);
      if (currentAvailableY - rh < MIN_ROW_Y) {
        // Break to new page
        pagesData.push(currentPageList);
        currentPageList = [tx];
        isP1 = false;
        currentAvailableY = SUBSEQUENT_ROW_START_Y - rh;
      } else {
        currentPageList.push(tx);
        currentAvailableY -= rh;
      }
    }
    if (currentPageList.length > 0) {
      pagesData.push(currentPageList);
    }
  }

  const totalPages = pagesData.length;
  const pageStreams: string[] = [];

  pagesData.forEach((pageTxs, pageIdx) => {
    const isFirstPage = pageIdx === 0;
    const pageNum = pageIdx + 1;
    let ops = '';

    const drawText = (text: string, x: number, y: number, font: 'F1' | 'F2' | 'F3', size: number, r = 0, g = 0, b = 0) => {
      const escaped = escapePdfText(text);
      ops += `BT\n/${font} ${size.toFixed(1)} Tf\n${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n${x.toFixed(2)} ${y.toFixed(2)} Td\n(${escaped}) Tj\nET\n`;
    };

    const drawTextRight = (text: string, rightX: number, y: number, font: 'F1' | 'F2' | 'F3', size: number, r = 0, g = 0, b = 0) => {
      const width = measureTextWidth(text, size, font === 'F2');
      drawText(text, rightX - width, y, font, size, r, g, b);
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number, width = 0.5) => {
      ops += `${width.toFixed(2)} w\n${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
    };

    if (isFirstPage) {
      // 1. Top Header (Clean corporate white background, matching reference image)
      const logo = drawEagleLogo(MARGIN_LEFT, PAGE_HEIGHT - 67, 26);
      ops += logo.ops;
      drawText('B Bank', MARGIN_LEFT + logo.width + 7, PAGE_HEIGHT - 60, 'F2', 20, 0.0, 0.224, 0.365); // B Bank Navy #00395D
      drawText('B Bank S.A.', MARGIN_LEFT, PAGE_HEIGHT - 77, 'F1', 7.5, 0.45, 0.50, 0.55);

      const isFiltered = data.isFiltered || (data.documentTitle && data.documentTitle.toLowerCase().includes('filtered'));
      const docTitle = data.documentTitle || (isFiltered ? i18n.filteredReportTitle : i18n.statementTitle);
      const accRefCode = `BUK-${(data.accountNumber || "74187502").slice(-8)}`;

      drawTextRight(`${i18n.docRef}: ${accRefCode}`, rightEdge, PAGE_HEIGHT - 48, 'F2', 7, 0.45, 0.50, 0.55);
      drawTextRight(docTitle, rightEdge, PAGE_HEIGHT - 65, 'F2', 15.5, 0.06, 0.09, 0.16);
      drawTextRight(`${i18n.issued}: ${data.generatedAt}`, rightEdge, PAGE_HEIGHT - 77, 'F1', 8, 0.35, 0.40, 0.45);

      // Horizontal divider line
      drawLine(MARGIN_LEFT, PAGE_HEIGHT - 85, rightEdge, PAGE_HEIGHT - 85, 0.886, 0.910, 0.941, 0.6);

      // 2. Account Information Card (Card with rounded corners, matching reference image)
      const cardH = 72;
      const cardY = PAGE_HEIGHT - 99 - cardH;
      ops += roundedRect(MARGIN_LEFT, cardY, CONTENT_WIDTH, cardH, 8, 0.973, 0.980, 0.988, 0.886, 0.910, 0.941, 0.6, true, true);

      // Column 1
      const col1X = MARGIN_LEFT + 14;
      drawText(i18n.accountHolder, col1X, cardY + 54, 'F2', 7, 0.392, 0.455, 0.545);
      drawText(data.accountHolder, col1X, cardY + 41, 'F2', 10, 0.06, 0.09, 0.16);

      const periodHeader = isFiltered ? i18n.reportPeriod : i18n.statementPeriod;
      drawText(periodHeader, col1X, cardY + 23, 'F2', 7, 0.392, 0.455, 0.545);
      drawText(data.periodLabel, col1X, cardY + 11, 'F2', 9, 0.06, 0.09, 0.16);

      // Column 2
      const col2X = MARGIN_LEFT + 265;
      drawText(i18n.sortCodeAndAccount, col2X, cardY + 54, 'F2', 7, 0.392, 0.455, 0.545);
      drawText(`${data.sortCode || '10-80-00'} · ${data.accountNumber || '74187502'}`, col2X, cardY + 41, 'F2', 10, 0.06, 0.09, 0.16);

      if (data.iban) {
        drawText(i18n.iban, col2X, cardY + 23, 'F2', 7, 0.392, 0.455, 0.545);
        drawText(data.iban, col2X, cardY + 11, 'F2', 9, 0.06, 0.09, 0.16);
      } else {
        drawText(i18n.currency, col2X, cardY + 23, 'F2', 7, 0.392, 0.455, 0.545);
        drawText(`${data.currency || 'GBP'} (£) · Personal Current Account`, col2X, cardY + 11, 'F2', 9, 0.06, 0.09, 0.16);
      }

      // 3. Section: ACCOUNT SUMMARY
      const sec1Y = cardY - 20;
      drawText(i18n.financialSummary, MARGIN_LEFT, sec1Y, 'F2', 9.5, 0.06, 0.09, 0.16);

      // Summary Card (matching the reference image's clean card structure)
      const sumY = sec1Y - 48;
      const sumH = 42;
      ops += roundedRect(MARGIN_LEFT, sumY, CONTENT_WIDTH, sumH, 7, 1.0, 1.0, 1.0, 0.886, 0.910, 0.941, 0.6, true, true);
      // Top header strip inside summary card
      ops += topRoundedRect(MARGIN_LEFT, sumY + sumH - 16, CONTENT_WIDTH, 16, 7, 0.973, 0.980, 0.988, 0.886, 0.910, 0.941, 0.5, true, false);
      drawLine(MARGIN_LEFT, sumY + sumH - 16, rightEdge, sumY + sumH - 16, 0.886, 0.910, 0.941, 0.5);

      const sumColW = CONTENT_WIDTH / 4;
      drawText(i18n.openingBalance, MARGIN_LEFT + 12, sumY + sumH - 11, 'F2', 6.5, 0.392, 0.455, 0.545);
      drawText(i18n.moneyIn, MARGIN_LEFT + sumColW + 12, sumY + sumH - 11, 'F2', 6.5, 0.392, 0.455, 0.545);
      drawText(i18n.moneyOut, MARGIN_LEFT + sumColW*2 + 12, sumY + sumH - 11, 'F2', 6.5, 0.392, 0.455, 0.545);
      drawText(i18n.closingBalance, MARGIN_LEFT + sumColW*3 + 12, sumY + sumH - 11, 'F2', 6.5, 0.392, 0.455, 0.545);

      const openBalStr = data.openingBalance !== null && data.openingBalance !== undefined
        ? fmtMoney(data.openingBalance)
        : i18n.notAvailable;
      const closeBalStr = data.closingBalance !== null && data.closingBalance !== undefined
        ? fmtMoney(data.closingBalance)
        : fmtMoney(data.currentBalance);

      drawText(openBalStr, MARGIN_LEFT + 12, sumY + 9, 'F2', 9, 0.06, 0.09, 0.16);
      drawText(fmtMoney(data.totalInflow, true), MARGIN_LEFT + sumColW + 12, sumY + 9, 'F2', 9, 0.086, 0.639, 0.290); // Green
      drawText(fmtMoney(-Math.abs(data.totalOutflow)), MARGIN_LEFT + sumColW*2 + 12, sumY + 9, 'F2', 9, 0.725, 0.110, 0.110); // Red
      drawText(closeBalStr, MARGIN_LEFT + sumColW*3 + 12, sumY + 9, 'F2', 9.5, 0.06, 0.09, 0.16);

      // 4. Section: TRANSACTION HISTORY
      const sec2Y = sumY - 20;
      drawText(i18n.transactionHistory, MARGIN_LEFT, sec2Y, 'F2', 9.5, 0.06, 0.09, 0.16);

      // Table Header (Light grey with rounded top corners, matching reference image)
      const tblHeaderY = sec2Y - 26;
      const tblHeaderH = 20;
      ops += topRoundedRect(MARGIN_LEFT, tblHeaderY, CONTENT_WIDTH, tblHeaderH, 6, 0.973, 0.980, 0.988, 0.886, 0.910, 0.941, 0.6, true, true);

      drawText(i18n.colDate, colDateX, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
      drawText(i18n.colDetails, colDescX, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
      drawTextRight(i18n.colMoneyOut, colOutX + 68, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
      drawTextRight(i18n.colMoneyIn, colInX + 68, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
      drawTextRight(i18n.colBalance, rightEdge - 10, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
    } else {
      // Subsequent Pages (Page 2+): Slim Continuation Header
      const contLogo = drawEagleLogo(MARGIN_LEFT, PAGE_HEIGHT - 51, 16);
      ops += contLogo.ops;
      drawText('B Bank', MARGIN_LEFT + contLogo.width + 6, PAGE_HEIGHT - 47, 'F2', 14, 0.0, 0.224, 0.365);
      drawText(`${i18n.statementTitle} · ${data.accountHolder}`, MARGIN_LEFT + contLogo.width + 6 + 65, PAGE_HEIGHT - 46, 'F1', 8, 0.35, 0.40, 0.45);
      drawTextRight(`${data.sortCode || '10-80-00'} · ${data.accountNumber || '74187502'}`, rightEdge, PAGE_HEIGHT - 46, 'F2', 8, 0.2, 0.25, 0.3);
      drawLine(MARGIN_LEFT, PAGE_HEIGHT - 55, rightEdge, PAGE_HEIGHT - 55, 0.886, 0.910, 0.941, 0.5);

      // Repeated Table Header on Page 2+
      const tblHeaderY = PAGE_HEIGHT - 78;
      const tblHeaderH = 20;
      ops += topRoundedRect(MARGIN_LEFT, tblHeaderY, CONTENT_WIDTH, tblHeaderH, 6, 0.973, 0.980, 0.988, 0.886, 0.910, 0.941, 0.6, true, true);

      drawText(i18n.colDate, colDateX, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
      drawText(i18n.colDetails, colDescX, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
      drawTextRight(i18n.colMoneyOut, colOutX + 68, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
      drawTextRight(i18n.colMoneyIn, colInX + 68, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
      drawTextRight(i18n.colBalance, rightEdge - 10, tblHeaderY + 6, 'F2', 7, 0.278, 0.333, 0.412);
    }

    // Table Content or Empty State
    let currentY = isFirstPage ? PAGE1_ROW_START_Y : SUBSEQUENT_ROW_START_Y;

    if (pageTxs.length === 0) {
      // Empty State: Elegant card matching the bottom card of the reference image
      const emptyCardH = 75;
      const emptyCardY = currentY - emptyCardH - 10;
      ops += roundedRect(MARGIN_LEFT, emptyCardY, CONTENT_WIDTH, emptyCardH, 8, 0.973, 0.980, 0.988, 0.886, 0.910, 0.941, 0.6, true, true);

      // Green circle checkmark icon
      const checkX = MARGIN_LEFT + 22;
      const checkY = emptyCardY + emptyCardH - 24;
      ops += roundedRect(checkX, checkY, 14, 14, 7, 0.086, 0.639, 0.290, 0.086, 0.639, 0.290, 0.5, true, true);
      // White checkmark
      ops += `1.0 1.0 1.0 RG\n1.2 w\n${checkX + 3.5} ${checkY + 7} m ${checkX + 6} ${checkY + 4} l ${checkX + 10.5} ${checkY + 10} l S\n`;

      drawText(i18n.noTxTitle, MARGIN_LEFT + 44, checkY + 3, 'F2', 9.5, 0.06, 0.09, 0.16);

      const wrappedDesc = wrapText(i18n.noTxDesc, CONTENT_WIDTH - 64, 8);
      let descY = checkY - 14;
      wrappedDesc.forEach((line) => {
        drawText(line, MARGIN_LEFT + 44, descY, 'F1', 8, 0.45, 0.50, 0.55);
        descY -= 11;
      });

      // Advisory Note Card
      const noteCardH = 65;
      const noteCardY = emptyCardY - noteCardH - 14;
      ops += roundedRect(MARGIN_LEFT, noteCardY, CONTENT_WIDTH, noteCardH, 7, 1.0, 1.0, 1.0, 0.886, 0.910, 0.941, 0.5, true, true);

      drawText(i18n.docInfoTitle, MARGIN_LEFT + 14, noteCardY + noteCardH - 16, 'F2', 7.5, 0.0, 0.224, 0.365);
      const wrappedP1 = wrapText(i18n.docInfoP1, CONTENT_WIDTH - 28, 7.5);
      let nY = noteCardY + noteCardH - 28;
      wrappedP1.forEach((line) => {
        drawText(line, MARGIN_LEFT + 14, nY, 'F1', 7.5, 0.45, 0.50, 0.55);
        nY -= 10;
      });
      const wrappedP2 = wrapText(i18n.docInfoP2, CONTENT_WIDTH - 28, 7.5);
      wrappedP2.forEach((line) => {
        drawText(line, MARGIN_LEFT + 14, nY, 'F1', 7.5, 0.45, 0.50, 0.55);
        nY -= 10;
      });
    } else {
      pageTxs.forEach((tx) => {
        const rowH = calcRowHeight(tx);
        drawLine(MARGIN_LEFT, currentY, rightEdge, currentY, 0.92, 0.94, 0.96, 0.5);

        // Date
        drawText(tx.date, colDateX, currentY - 14, 'F1', 8, 0.2, 0.25, 0.3);

        // Description word-wrapping
        const descText = tx.description || tx.type || "Transaction";
        const descLines = wrapText(descText, maxDescWidth, 8);
        const hasCategory = tx.type && tx.type !== tx.description;

        let dY = currentY - 13;
        descLines.forEach((line) => {
          drawText(line, colDescX, dY, 'F1', 8, 0.06, 0.09, 0.16);
          dY -= 10;
        });
        if (hasCategory) {
          drawText(tx.type, colDescX, dY, 'F3', 6.5, 0.45, 0.50, 0.55);
        }

        // Money Out
        if (tx.amount < 0) {
          const outStr = fmtMoney(Math.abs(tx.amount));
          drawTextRight(outStr, colOutX + 68, currentY - 14, 'F2', 8, 0.725, 0.110, 0.110); // Red
        } else {
          drawTextRight('—', colOutX + 42, currentY - 14, 'F1', 8, 0.6, 0.65, 0.7);
        }

        // Money In
        if (tx.amount > 0) {
          const inStr = fmtMoney(tx.amount);
          drawTextRight(inStr, colInX + 68, currentY - 14, 'F2', 8, 0.086, 0.639, 0.290); // Green
        } else {
          drawTextRight('—', colInX + 42, currentY - 14, 'F1', 8, 0.6, 0.65, 0.7);
        }

        // Running Balance
        if (tx.balanceAfter !== null && tx.balanceAfter !== undefined) {
          drawTextRight(fmtMoney(tx.balanceAfter), rightEdge - 10, currentY - 14, 'F2', 8, 0.06, 0.09, 0.16);
        } else {
          drawTextRight('—', rightEdge - 24, currentY - 14, 'F1', 8, 0.6, 0.65, 0.7);
        }

        currentY -= rowH;
      });
      // Table bottom border
      drawLine(MARGIN_LEFT, currentY, rightEdge, currentY, 0.886, 0.910, 0.941, 0.6);
    }

    // Grounded Footer at Bottom of A4 on ALL pages
    const footerY = 32;
    drawLine(MARGIN_LEFT, footerY + 14, rightEdge, footerY + 14, 0.886, 0.910, 0.941, 0.5);
    if (i18n.footerDisclaimer) {
      drawText(i18n.footerDisclaimer, MARGIN_LEFT, footerY + 3, 'F1', 6.5, 0.45, 0.50, 0.55);
    }
    drawTextRight(i18n.pageOf(pageNum, totalPages), rightEdge, footerY + 3, 'F2', 7.5, 0.25, 0.30, 0.35);

    pageStreams.push(ops);
  });

  // Construct PDF 1.4 catalog, font resources, image XObject and xref table
  const logoBytes = getBankLogoJpegBytes();
  const logoObjId = 6;
  const logoHeader = `<<\n  /Type /XObject\n  /Subtype /Image\n  /Width ${BANK_LOGO_WIDTH}\n  /Height ${BANK_LOGO_HEIGHT}\n  /ColorSpace /DeviceRGB\n  /BitsPerComponent 8\n  /Filter /DCTDecode\n  /Length ${logoBytes.length}\n>>\nstream\n`;
  const logoFooter = `\nendstream`;

  const objects: string[] = [];
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;
  objects[5] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`;

  const pageObjectIds: number[] = [];
  let nextObjId = 7;

  pageStreams.forEach((streamText) => {
    const pageId = nextObjId++;
    const contentId = nextObjId++;
    pageObjectIds.push(pageId);

    objects[pageId] = `<<
  /Type /Page
  /Parent 2 0 R
  /Resources <<
    /Font <<
      /F1 3 0 R
      /F2 4 0 R
      /F3 5 0 R
    >>
    /XObject <<
      /Im1 ${logoObjId} 0 R
    >>
  >>
  /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}]
  /Contents ${contentId} 0 R
>>`;

    const encoder = new TextEncoder();
    const streamLen = encoder.encode(streamText).length;
    objects[contentId] = `<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream`;
  });

  objects[2] = `<<
  /Type /Pages
  /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}]
  /Count ${pageObjectIds.length}
>>`;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let currentOffset = 0;

  function pushChunk(buf: Uint8Array) {
    chunks.push(buf);
    currentOffset += buf.length;
  }

  function pushString(str: string) {
    pushChunk(encoder.encode(str));
  }

  pushString('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Objects 1 to 5
  for (let i = 1; i <= 5; i++) {
    offsets[i] = currentOffset;
    pushString(`${i} 0 obj\n${objects[i]}\nendobj\n`);
  }

  // Object 6: Logo Image XObject
  offsets[6] = currentOffset;
  pushString(`6 0 obj\n${logoHeader}`);
  pushChunk(logoBytes);
  pushString(`${logoFooter}\nendobj\n`);

  // Page and Content objects
  for (let i = 7; i < nextObjId; i++) {
    offsets[i] = currentOffset;
    pushString(`${i} 0 obj\n${objects[i]}\nendobj\n`);
  }

  const totalObjects = nextObjId;
  const startXref = currentOffset;

  let xref = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
  for (let i = 1; i < totalObjects; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    xref += `${offStr} 00000 n \n`;
  }
  xref += `trailer\n<<\n  /Size ${totalObjects}\n  /Root 1 0 R\n>>\nstartxref\n${startXref}\n%%EOF\n`;
  pushString(xref);

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}
