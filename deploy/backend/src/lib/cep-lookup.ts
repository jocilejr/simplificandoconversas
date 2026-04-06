export interface MercadoPagoAddress {
  zip_code: string;
  street_name: string;
  street_number: string;
  neighborhood: string;
  city: string;
  federal_unit: string;
}

const FALLBACK_ADDRESS: MercadoPagoAddress = {
  zip_code: "01001000",
  street_name: "Praça da Sé",
  street_number: "s/n",
  neighborhood: "Sé",
  city: "São Paulo",
  federal_unit: "SP",
};

export async function lookupCep(cep: string): Promise<MercadoPagoAddress> {
  const cleanCep = cep.replace(/\D/g, "");

  // Try BrasilAPI first
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data: any = await resp.json();
      if (data.street) {
        return {
          zip_code: cleanCep,
          street_name: data.street || "Rua Principal",
          street_number: "s/n",
          neighborhood: data.neighborhood || "Centro",
          city: data.city || "São Paulo",
          federal_unit: data.state || "SP",
        };
      }
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: AwesomeAPI
  try {
    const resp = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data: any = await resp.json();
      if (data.address) {
        return {
          zip_code: cleanCep,
          street_name: data.address || "Rua Principal",
          street_number: "s/n",
          neighborhood: data.district || "Centro",
          city: data.city || "São Paulo",
          federal_unit: data.state || "SP",
        };
      }
    }
  } catch {
    // fall through to hardcoded fallback
  }

  // Ultimate fallback
  return { ...FALLBACK_ADDRESS, zip_code: cleanCep };
}
