// Índice de legibilidad INFLESZ (fórmula de perspicuidad de Szigriszt-Pazos),
// usado para RA-02. Escala: < 40 muy difícil · 40-55 algo difícil ·
// 55-65 normal · 65-80 bastante fácil · > 80 muy fácil.
// El conteo de sílabas es aproximado (grupos vocálicos con hiatos).

const VOCALES = "aeiouáéíóúü";
const FUERTES = "aeoáéó";
const DEBILES_CON_TILDE = "íú";

export function silabas(palabra: string): number {
  let cuenta = 0;
  let anterior = "";
  let enVocal = false;
  for (const ch of palabra.toLowerCase()) {
    if (VOCALES.includes(ch)) {
      const hiato =
        enVocal &&
        ((FUERTES.includes(ch) && FUERTES.includes(anterior)) || DEBILES_CON_TILDE.includes(ch) || DEBILES_CON_TILDE.includes(anterior));
      if (!enVocal || hiato) cuenta++;
      enVocal = true;
    } else {
      enVocal = false;
    }
    anterior = ch;
  }
  return Math.max(1, cuenta);
}

export function inflesz(texto: string) {
  const limpio = texto.replace(/[#*>[\]]/g, " ").replace(/^\s*[-\d.]+\s/gm, "");
  const frases = limpio
    .split(/[.!?:;\n]+/)
    .map((f) => f.trim())
    .filter((f) => /[a-záéíóúñü]/i.test(f));
  const palabras = limpio.match(/[a-záéíóúñü]+/gi) ?? [];
  const totalSilabas = palabras.reduce((acc, p) => acc + silabas(p), 0);
  const valor = 206.835 - 62.3 * (totalSilabas / palabras.length) - palabras.length / frases.length;
  const nivel = valor > 80 ? "muy fácil" : valor > 65 ? "bastante fácil" : valor > 55 ? "normal" : valor > 40 ? "algo difícil" : "muy difícil";
  return {
    valor: Math.round(valor * 10) / 10,
    nivel,
    palabras: palabras.length,
    frases: frases.length,
    silabasPorPalabra: Math.round((totalSilabas / palabras.length) * 100) / 100,
    palabrasPorFrase: Math.round((palabras.length / frases.length) * 10) / 10,
  };
}
