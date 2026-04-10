import bancodobrasilImg from "@/assets/cards/bancodobrasil.png";
import banrisulImg from "@/assets/cards/banrisul.png";
import nubankImg from "@/assets/cards/nubank.png";
import sicrediImg from "@/assets/cards/sicredi.png";
import unicredImg from "@/assets/cards/unicred.png";

export interface CardBrand {
  id: string;
  name: string;
  aliases: string[];
  asset: string | null;
  gradient: string;
  textColor: string;
  accentColor: string;
}

const CARD_BRANDS: CardBrand[] = [
  {
    id: "bancodobrasil",
    name: "Banco do Brasil",
    aliases: ["banco do brasil", "bb"],
    asset: bancodobrasilImg,
    gradient: "linear-gradient(135deg, #FFCD00 0%, #003882 40%, #002D62 100%)",
    textColor: "#fff",
    accentColor: "#FFCD00",
  },
  {
    id: "nubank",
    name: "Nubank",
    aliases: ["nu", "nuba", "nubank", "nu pagamentos"],
    asset: nubankImg,
    gradient: "linear-gradient(135deg, #820AD1 0%, #AB47BC 50%, #CE93D8 100%)",
    textColor: "#fff",
    accentColor: "#820AD1",
  },
  {
    id: "sicredi",
    name: "Sicredi",
    aliases: ["sicr", "sicredi", "sicred"],
    asset: sicrediImg,
    gradient: "linear-gradient(135deg, #006B3F 0%, #00A86B 50%, #4CAF50 100%)",
    textColor: "#fff",
    accentColor: "#006B3F",
  },
  {
    id: "unicred",
    name: "Unicred",
    aliases: ["unicred"],
    asset: unicredImg,
    gradient: "linear-gradient(135deg, #003366 0%, #0066CC 50%, #4DA6FF 100%)",
    textColor: "#fff",
    accentColor: "#003366",
  },
  {
    id: "banrisul",
    name: "Banrisul",
    aliases: ["banrisul", "banri", "banri compras"],
    asset: banrisulImg,
    gradient: "linear-gradient(135deg, #003B8E 0%, #1565C0 50%, #42A5F5 100%)",
    textColor: "#fff",
    accentColor: "#003B8E",
  },
];

const GENERIC_BRAND: CardBrand = {
  id: "generic",
  name: "Cartão",
  aliases: [],
  asset: null,
  gradient: "linear-gradient(135deg, hsl(221 85% 53%) 0%, hsl(199 89% 48%) 50%, hsl(173 80% 40%) 100%)",
  textColor: "#fff",
  accentColor: "hsl(221, 85%, 53%)",
};

export function detectCardBrand(label: string | null | undefined): CardBrand {
  if (!label) return GENERIC_BRAND;
  const normalized = label.toLowerCase().trim();

  for (const brand of CARD_BRANDS) {
    for (const alias of brand.aliases) {
      if (normalized.includes(alias)) return brand;
    }
  }

  return GENERIC_BRAND;
}

export function getAllBrands(): CardBrand[] {
  return [...CARD_BRANDS, GENERIC_BRAND];
}

export { GENERIC_BRAND };
