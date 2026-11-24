import { ImageKey, InsumoUnit, ProductCategory, StoreSettings } from '../types';
import { getDefaultOperatingDate, parseLocalDate, toLocalDateString } from '../utils/holidays';

export const IMAGE_ASSETS: Record<ImageKey, string> = {
  brasa_geral: '/src/assets/images/hero_espetinho_brasa_1795012088579.jpg',
  espetinho_carne: '/src/assets/images/produto_espetinho_carne_1795012088764.jpg',
  bebidas_geladas: '/src/assets/images/produto_bebidas_geladas_1795012089214.jpg',
  linguica_coracao: '/src/assets/images/produto_linguica_coracao_1795012089663.jpg',
};

export const DEFAULT_STORE_SETTINGS: Omit<StoreSettings, 'ownerId' | 'createdAt' | 'updatedAt'> = {
  storeName: 'Brasa de Domingo Espetinhos',
  ownerWhatsapp: '11998765432',
  pixKey: '11998765432',
  address: 'Av. Central, 420 — Em frente à Praça da Matriz',
  operatingHours: 'Domingos e Feriados · 10h30 às 16h00',
  customerNotice:
    'Atendemos somente aos domingos e feriados! Faça seu pedido antecipado para retirar na hora sem fila ou receber quentinho.',
  confirmTemplate:
    'Olá {cliente}! Seu pedido #{pedido} no {loja} foi CONFIRMADO para {data}.\n\nItens:\n{itens}\n\nTotal: {total} ({pagamento}). Já estamos preparando na brasa!',
  readyTemplate:
    'Oi {cliente}! Seu pedido #{pedido} ({total}) do {loja} está PRONTO! Pode passar para retirar ou aguardar a entrega. Obrigado pela preferência!',
  fiadoTemplate:
    'Olá {cliente}, tudo bem? Passando para lembrar do seu saldo em aberto na caderneta do {loja}: {saldo}.\n\nQuando puder acertar, nossa chave Pix é: {pix}. Muito obrigado!',
};

export interface InsumoCatalogSeed {
  key: string;
  name: string;
  aliases?: string[];
  unit: InsumoUnit;
  currentStock: number;
  minStock: number;
  unitCost: number;
  supplier: string;
}

export interface ProductCatalogSeed {
  key: string;
  name: string;
  aliases?: string[];
  category: ProductCategory;
  price: number;
  costPrice: number;
  insumoKey: string;
  insumoQtyPerUnit: number;
  extraInsumos?: { insumoKey: string; qtyPerUnit: number }[];
  imageKey: ImageKey;
  description: string;
}

export const INSUMOS_CATALOG_SEED: InsumoCatalogSeed[] = [
  // Espetos crus / preparados
  { key: 'alcatra', name: 'Espeto de Alcatra Preparado', aliases: ['Espeto de Alcatra'], unit: 'un', currentStock: 65, minStock: 25, unitCost: 5.2, supplier: 'Açougue Bom Corte' },
  { key: 'picanha', name: 'Espeto de Picanha', unit: 'un', currentStock: 35, minStock: 15, unitCost: 8.5, supplier: 'Açougue Bom Corte' },
  { key: 'contrafile', name: 'Espeto de Contra-Filé', unit: 'un', currentStock: 45, minStock: 18, unitCost: 6.2, supplier: 'Açougue Bom Corte' },
  { key: 'frango', name: 'Espeto de Frango Temperado', unit: 'un', currentStock: 50, minStock: 20, unitCost: 3.8, supplier: 'Açougue Bom Corte' },
  { key: 'medalhao', name: 'Espeto Medalhão Frango c/ Bacon', unit: 'un', currentStock: 36, minStock: 15, unitCost: 5.4, supplier: 'Açougue Bom Corte' },
  { key: 'coracao', name: 'Espeto de Coração', unit: 'un', currentStock: 35, minStock: 18, unitCost: 4.5, supplier: 'Avícola Central' },
  { key: 'linguica', name: 'Espeto de Linguiça Toscana', unit: 'un', currentStock: 45, minStock: 15, unitCost: 4.0, supplier: 'Frigorífico Sul' },
  { key: 'kafta', name: 'Espeto de Kafta Bovina', unit: 'un', currentStock: 35, minStock: 15, unitCost: 4.8, supplier: 'Açougue Bom Corte' },
  { key: 'tulipa', name: 'Espeto de Tulipa (Asinha)', unit: 'un', currentStock: 35, minStock: 15, unitCost: 4.3, supplier: 'Avícola Central' },
  { key: 'coalho', name: 'Queijo Coalho no Palito', unit: 'un', currentStock: 35, minStock: 12, unitCost: 4.2, supplier: 'Laticínios Sertão' },
  { key: 'pao_alho', name: 'Pão de Alho Tradicional', unit: 'un', currentStock: 40, minStock: 15, unitCost: 3.2, supplier: 'Padaria Central' },

  // Bebidas individuais (1 insumo por produto vendido)
  { key: 'coca_lata', name: 'Coca-Cola Lata 350ml', aliases: ['Refrigerante Lata 350ml'], unit: 'un', currentStock: 48, minStock: 20, unitCost: 2.9, supplier: 'Distribuidora Gelada' },
  { key: 'guarana_lata', name: 'Guaraná Antarctica Lata 350ml', unit: 'un', currentStock: 48, minStock: 20, unitCost: 2.7, supplier: 'Distribuidora Gelada' },
  { key: 'fanta_lata', name: 'Fanta Laranja Lata 350ml', unit: 'un', currentStock: 24, minStock: 12, unitCost: 2.7, supplier: 'Distribuidora Gelada' },
  { key: 'coca_2l', name: 'Coca-Cola Garrafa 2L', unit: 'un', currentStock: 18, minStock: 6, unitCost: 7.5, supplier: 'Distribuidora Gelada' },
  { key: 'guarana_2l', name: 'Guaraná Antarctica 2L', unit: 'un', currentStock: 16, minStock: 6, unitCost: 6.5, supplier: 'Distribuidora Gelada' },
  { key: 'agua_sem_gas', name: 'Água Mineral 500ml', unit: 'un', currentStock: 48, minStock: 18, unitCost: 1.2, supplier: 'Distribuidora Gelada' },
  { key: 'agua_com_gas', name: 'Água Mineral com Gás 500ml', unit: 'un', currentStock: 24, minStock: 12, unitCost: 1.4, supplier: 'Distribuidora Gelada' },
  { key: 'suco_lata', name: 'Suco Del Valle Lata 290ml', unit: 'un', currentStock: 24, minStock: 10, unitCost: 3.2, supplier: 'Distribuidora Gelada' },
  { key: 'cerveja_lata', name: 'Cerveja Lata 350ml', unit: 'un', currentStock: 48, minStock: 24, unitCost: 3.4, supplier: 'Distribuidora Gelada' },

  // Acompanhamentos
  { key: 'farofa', name: 'Farofa Temperada (Porção)', unit: 'un', currentStock: 40, minStock: 15, unitCost: 1.5, supplier: 'Empório Brasa' },
  { key: 'vinagrete', name: 'Vinagrete Fresco (Porção)', unit: 'un', currentStock: 40, minStock: 15, unitCost: 1.6, supplier: 'Hortifrúti Centro' },
  { key: 'mandioca', name: 'Mandioca Cozida (Porção)', unit: 'un', currentStock: 25, minStock: 10, unitCost: 3.5, supplier: 'Hortifrúti Centro' },
  { key: 'tropeiro', name: 'Feijão Tropeiro (Porção)', unit: 'un', currentStock: 25, minStock: 10, unitCost: 4.5, supplier: 'Cozinha Brasa' },

  // Operacionais
  { key: 'carvao', name: 'Carvão Vegetal Saco 5kg', unit: 'pct', currentStock: 6, minStock: 5, unitCost: 18.0, supplier: 'Carvoaria Minas' },
  { key: 'gelo', name: 'Gelo Filtrado Saco 5kg', unit: 'pct', currentStock: 6, minStock: 4, unitCost: 10.0, supplier: 'Fábrica Gelo Sul' },
];

export const CATALOG_PRODUCTS_SEED: ProductCatalogSeed[] = [
  // Espetinhos
  { key: 'prod_alcatra', name: 'Espetinho de Alcatra', category: 'espetinho', price: 12.0, costPrice: 5.2, insumoKey: 'alcatra', insumoQtyPerUnit: 1, imageKey: 'espetinho_carne', description: 'Cubos macios de alcatra na brasa com sal de parrilla, farofa e limão.' },
  { key: 'prod_picanha', name: 'Espetinho de Picanha', category: 'espetinho', price: 18.0, costPrice: 8.5, insumoKey: 'picanha', insumoQtyPerUnit: 1, imageKey: 'espetinho_carne', description: 'Corte nobre de picanha fatiada na brasa com sal grosso e alho.' },
  { key: 'prod_contrafile', name: 'Espetinho de Contra-Filé', category: 'espetinho', price: 14.0, costPrice: 6.2, insumoKey: 'contrafile', insumoQtyPerUnit: 1, imageKey: 'espetinho_carne', description: 'Contra-filé suculento assado na brasa com capa de gordura dourada.' },
  { key: 'prod_frango', name: 'Espetinho de Frango', aliases: ['Espetinho de Frango Temperado'], category: 'espetinho', price: 10.0, costPrice: 3.8, insumoKey: 'frango', insumoQtyPerUnit: 1, imageKey: 'espetinho_carne', description: 'Peito de frango temperado no alho, ervas e páprica defumada.' },
  { key: 'prod_medalhao', name: 'Medalhão de Frango com Bacon', category: 'espetinho', price: 13.0, costPrice: 5.4, insumoKey: 'medalhao', insumoQtyPerUnit: 1, imageKey: 'espetinho_carne', description: 'Cubos de frango envolvidos em fatias de bacon crocante na brasa.' },
  { key: 'prod_coracao', name: 'Espetinho de Coração', category: 'espetinho', price: 11.0, costPrice: 4.5, insumoKey: 'coracao', insumoQtyPerUnit: 1, imageKey: 'linguica_coracao', description: 'Coração de frango suculento assado no ponto certo na brasa.' },
  { key: 'prod_linguica', name: 'Espetinho de Linguiça Toscana', aliases: ['Linguiça Toscana na Brasa'], category: 'espetinho', price: 10.0, costPrice: 4.0, insumoKey: 'linguica', insumoQtyPerUnit: 1, imageKey: 'linguica_coracao', description: 'Linguiça toscana assada com toque de chimichurri.' },
  { key: 'prod_kafta', name: 'Espetinho de Kafta Bovina', category: 'espetinho', price: 12.0, costPrice: 4.8, insumoKey: 'kafta', insumoQtyPerUnit: 1, imageKey: 'linguica_coracao', description: 'Carne bovina moída temperada com hortelã, cebola e especiarias.' },
  { key: 'prod_tulipa', name: 'Tulipa de Frango na Brasa', category: 'espetinho', price: 11.0, costPrice: 4.3, insumoKey: 'tulipa', insumoQtyPerUnit: 1, imageKey: 'espetinho_carne', description: 'Meio da asa temperado no limão e alho, assado até ficar dourado.' },
  { key: 'prod_coalho', name: 'Queijo Coalho na Brasa', aliases: ['Queijo Coalho Assado'], category: 'espetinho', price: 10.0, costPrice: 4.2, insumoKey: 'coalho', insumoQtyPerUnit: 1, imageKey: 'brasa_geral', description: 'Queijo coalho dourado na brasa com orégano e mel opcional.' },
  { key: 'prod_pao_alho', name: 'Pão de Alho na Brasa', category: 'espetinho', price: 9.0, costPrice: 3.2, insumoKey: 'pao_alho', insumoQtyPerUnit: 1, imageKey: 'brasa_geral', description: 'Pão crocante recheado com creme de alho, queijo e ervas.' },

  // Bebidas
  { key: 'prod_coca_lata', name: 'Coca-Cola Lata 350ml', category: 'bebida', price: 6.0, costPrice: 2.9, insumoKey: 'coca_lata', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Lata 350ml trincando de gelada direto do balde de gelo.' },
  { key: 'prod_guarana_lata', name: 'Guaraná Antarctica Lata', aliases: ['Guaraná Antarctica Lata 350ml'], category: 'bebida', price: 6.0, costPrice: 2.7, insumoKey: 'guarana_lata', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Guaraná lata 350ml bem gelado.' },
  { key: 'prod_fanta_lata', name: 'Fanta Laranja Lata 350ml', category: 'bebida', price: 6.0, costPrice: 2.7, insumoKey: 'fanta_lata', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Lata 350ml bem gelada.' },
  { key: 'prod_coca_2l', name: 'Coca-Cola 2 Litros', category: 'bebida', price: 14.0, costPrice: 7.5, insumoKey: 'coca_2l', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Garrafa 2L gelada ideal para compartilhar.' },
  { key: 'prod_guarana_2l', name: 'Guaraná Antarctica 2 Litros', category: 'bebida', price: 12.0, costPrice: 6.5, insumoKey: 'guarana_2l', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Garrafa 2L gelada para toda a família.' },
  { key: 'prod_agua', name: 'Água Mineral 500ml', aliases: ['Água Mineral 500ml (sem/com gás)', 'Água Mineral sem Gás 500ml'], category: 'bebida', price: 4.0, costPrice: 1.2, insumoKey: 'agua_sem_gas', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Garrafa 500ml sem gás bem gelada.' },
  { key: 'prod_agua_gas', name: 'Água Mineral com Gás 500ml', category: 'bebida', price: 4.5, costPrice: 1.4, insumoKey: 'agua_com_gas', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Garrafa 500ml com gás bem gelada.' },
  { key: 'prod_suco', name: 'Suco Del Valle Lata 290ml', category: 'bebida', price: 7.0, costPrice: 3.2, insumoKey: 'suco_lata', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Suco lata gelado sabores diversos.' },
  { key: 'prod_cerveja', name: 'Cerveja Gelada Lata 350ml', category: 'bebida', price: 7.0, costPrice: 3.4, insumoKey: 'cerveja_lata', insumoQtyPerUnit: 1, imageKey: 'bebidas_geladas', description: 'Cerveja lata 350ml super gelada.' },

  // Acompanhamentos
  { key: 'prod_farofa', name: 'Porção de Farofa Temperada', category: 'acompanhamento', price: 5.0, costPrice: 1.5, insumoKey: 'farofa', insumoQtyPerUnit: 1, imageKey: 'brasa_geral', description: 'Potinho caprichado de farofa crocante temperada na casa.' },
  { key: 'prod_vinagrete', name: 'Porção de Vinagrete Fresco', category: 'acompanhamento', price: 5.0, costPrice: 1.6, insumoKey: 'vinagrete', insumoQtyPerUnit: 1, imageKey: 'brasa_geral', description: 'Vinagrete fresquinho de tomate, cebola e cheiro-verde.' },
  { key: 'prod_mandioca', name: 'Mandioca Cozida na Manteiga', category: 'acompanhamento', price: 10.0, costPrice: 3.5, insumoKey: 'mandioca', insumoQtyPerUnit: 1, imageKey: 'brasa_geral', description: 'Porção de mandioca macia com manteiga de garrafa e cheiro-verde.' },
  { key: 'prod_tropeiro', name: 'Feijão Tropeiro (Pote Individual)', category: 'acompanhamento', price: 12.0, costPrice: 4.5, insumoKey: 'tropeiro', insumoQtyPerUnit: 1, imageKey: 'brasa_geral', description: 'Feijão tropeiro tradicional com bacon, calabresa e couve.' },

  // Combos (com múltiplos insumos vinculados!)
  {
    key: 'prod_combo_domingo',
    name: 'Combo Domingo (2 Espetos + Refri)',
    category: 'combo',
    price: 28.0,
    costPrice: 13.3,
    insumoKey: 'alcatra',
    insumoQtyPerUnit: 2,
    extraInsumos: [{ insumoKey: 'coca_lata', qtyPerUnit: 1 }],
    imageKey: 'brasa_geral',
    description: '2 espetinhos de alcatra na brasa + 1 Coca-Cola lata 350ml.',
  },
  {
    key: 'prod_combo_misto',
    name: 'Combo Duplo Misto (Alcatra + Frango + Guaraná)',
    category: 'combo',
    price: 26.0,
    costPrice: 11.7,
    insumoKey: 'alcatra',
    insumoQtyPerUnit: 1,
    extraInsumos: [
      { insumoKey: 'frango', qtyPerUnit: 1 },
      { insumoKey: 'guarana_lata', qtyPerUnit: 1 },
    ],
    imageKey: 'brasa_geral',
    description: '1 espetinho de alcatra + 1 espetinho de frango + 1 Guaraná lata.',
  },
  {
    key: 'prod_combo_familia',
    name: 'Combo Família (4 Alcatras + 2 Linguiças + Coca 2L)',
    category: 'combo',
    price: 76.0,
    costPrice: 36.3,
    insumoKey: 'alcatra',
    insumoQtyPerUnit: 4,
    extraInsumos: [
      { insumoKey: 'linguica', qtyPerUnit: 2 },
      { insumoKey: 'coca_2l', qtyPerUnit: 1 },
    ],
    imageKey: 'brasa_geral',
    description: '4 espetinhos de alcatra + 2 espetinhos de linguiça + 1 Coca-Cola 2L.',
  },
];

export const PUBLIC_PREVIEW_PRODUCTS = CATALOG_PRODUCTS_SEED.slice(0, 12).map((p, idx) => ({
  id: `prev-${idx + 1}`,
  name: p.name,
  category: p.category,
  price: p.price,
  costPrice: p.costPrice,
  description: p.description,
  imageKey: p.imageKey,
  active: true,
}));

/**
 * Computes recent Sundays relative to today so seeded demo orders always fall on real Sundays.
 */
export function getRecentSundays(count = 4): string[] {
  const nextOrToday = getDefaultOperatingDate([]);
  let base = parseLocalDate(nextOrToday.dateStr);
  const today = new Date();
  const dayOfWeek = today.getDay();
  base = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek, 12, 0, 0);

  const sundays: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime());
    d.setDate(d.getDate() - i * 7);
    sundays.push(toLocalDateString(d));
  }
  return sundays;
}
