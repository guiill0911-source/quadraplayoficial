export type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export type HorarioDia = {
  ativo: boolean;
  abre: string;
  fecha: string;
};

export type Funcionamento = {
  modo: "padrao" | "porDia";
  padrao: { abre: string; fecha: string };
  porDia: Record<DiaSemana, HorarioDia>;
};

/**
 * Funcionamento padrão (mesmo horário todos os dias)
 */
export const funcionamentoPadrao: Funcionamento = {
  modo: "padrao",
  padrao: { abre: "08:00", fecha: "22:00" },
  porDia: {
    seg: { ativo: true, abre: "08:00", fecha: "22:00" },
    ter: { ativo: true, abre: "08:00", fecha: "22:00" },
    qua: { ativo: true, abre: "08:00", fecha: "22:00" },
    qui: { ativo: true, abre: "08:00", fecha: "22:00" },
    sex: { ativo: true, abre: "08:00", fecha: "22:00" },
    sab: { ativo: true, abre: "08:00", fecha: "22:00" },
    dom: { ativo: true, abre: "08:00", fecha: "22:00" },
  },
};

/**
 * Funcionamento padrão POR DIA (nome que o app está tentando importar)
 */
export const funcionamentoPorDiaPadrao: Funcionamento = {
  modo: "porDia",
  padrao: { abre: "08:00", fecha: "22:00" },
  porDia: {
    seg: { ativo: true, abre: "08:00", fecha: "22:00" },
    ter: { ativo: true, abre: "08:00", fecha: "22:00" },
    qua: { ativo: true, abre: "08:00", fecha: "22:00" },
    qui: { ativo: true, abre: "08:00", fecha: "22:00" },
    sex: { ativo: true, abre: "08:00", fecha: "22:00" },
    sab: { ativo: false, abre: "08:00", fecha: "22:00" },
    dom: { ativo: false, abre: "08:00", fecha: "22:00" },
  },
};
