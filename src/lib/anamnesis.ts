/**
 * Modelos de anamnese por área. Ficam no código (versionados com o app) e a
 * anamnese salva guarda só o id do modelo e as respostas. Campos novos em um
 * modelo não quebram respostas antigas: aparecem como "não respondido".
 */
import type { VerticalId } from "./verticals"

export type FieldType = "text" | "textarea" | "number" | "yesno" | "radio" | "multi"

export type Field = {
  id: string
  label: string
  type: FieldType
  options?: string[]
  unit?: string
  placeholder?: string
  required?: boolean
  /** Só aparece quando outro campo tem este valor (ex.: "Sim"). */
  showIf?: { field: string; equals: string }
}

export type Section = { title: string; fields: Field[] }

export type Template = { id: string; title: string; intro: string; sections: Section[] }

export type Answers = Record<string, string | string[]>

const contactSection: Section = {
  title: "Sobre você",
  fields: [
    { id: "occupation", label: "Profissão", type: "text" },
    {
      id: "reason",
      label: "O que te trouxe até aqui?",
      type: "textarea",
      required: true,
      placeholder: "Conte com suas palavras",
    },
  ],
}

const healthSection: Section = {
  title: "Saúde",
  fields: [
    { id: "conditions", label: "Tem alguma doença diagnosticada?", type: "yesno" },
    {
      id: "conditions_detail",
      label: "Quais?",
      type: "text",
      showIf: { field: "conditions", equals: "Sim" },
    },
    { id: "medications", label: "Usa medicamentos contínuos?", type: "yesno" },
    {
      id: "medications_detail",
      label: "Quais e em que dose?",
      type: "text",
      showIf: { field: "medications", equals: "Sim" },
    },
    { id: "allergies", label: "Tem alergias?", type: "yesno" },
    {
      id: "allergies_detail",
      label: "A quê?",
      type: "text",
      showIf: { field: "allergies", equals: "Sim" },
    },
  ],
}

export const TEMPLATES = {
  psychology: {
    id: "psychology",
    title: "Anamnese psicológica",
    intro: "Essas informações ajudam a preparar nosso primeiro encontro. Responda no seu tempo.",
    sections: [
      contactSection,
      {
        title: "Histórico",
        fields: [
          { id: "previous_therapy", label: "Já fez terapia antes?", type: "yesno" },
          {
            id: "previous_therapy_detail",
            label: "Por quanto tempo e como foi?",
            type: "textarea",
            showIf: { field: "previous_therapy", equals: "Sim" },
          },
          { id: "psychiatric", label: "Faz ou já fez acompanhamento psiquiátrico?", type: "yesno" },
          { id: "medications", label: "Usa alguma medicação?", type: "text", placeholder: "Se sim, qual" },
        ],
      },
      {
        title: "Rotina",
        fields: [
          {
            id: "sleep",
            label: "Como está seu sono?",
            type: "radio",
            options: ["Bom", "Regular", "Ruim"],
          },
          {
            id: "affected_areas",
            label: "Quais áreas da vida estão mais afetadas?",
            type: "multi",
            options: ["Trabalho/estudos", "Relacionamentos", "Família", "Saúde", "Finanças", "Autoestima"],
          },
          { id: "support", label: "Com quem você pode contar?", type: "text" },
          { id: "expectations", label: "O que espera da terapia?", type: "textarea" },
        ],
      },
    ],
  },
  nutrition: {
    id: "nutrition",
    title: "Anamnese nutricional",
    intro: "Preencha antes da consulta para aproveitarmos melhor o tempo juntos.",
    sections: [
      {
        title: "Objetivo",
        fields: [
          {
            id: "goal",
            label: "Qual seu principal objetivo?",
            type: "radio",
            options: ["Emagrecimento", "Ganho de massa", "Saúde e exames", "Performance esportiva", "Outro"],
            required: true,
          },
          { id: "reason", label: "Conte um pouco mais", type: "textarea" },
        ],
      },
      healthSection,
      {
        title: "Hábitos",
        fields: [
          { id: "meals_per_day", label: "Quantas refeições faz por dia?", type: "number" },
          { id: "water", label: "Quanta água bebe por dia?", type: "number", unit: "litros" },
          {
            id: "restrictions",
            label: "Restrições ou preferências",
            type: "multi",
            options: ["Vegetariano", "Vegano", "Sem lactose", "Sem glúten", "Nenhuma"],
          },
          {
            id: "activity",
            label: "Atividade física",
            type: "radio",
            options: ["Sedentário", "1 a 2x por semana", "3 a 4x por semana", "5x ou mais"],
          },
          {
            id: "bowel",
            label: "Funcionamento intestinal",
            type: "radio",
            options: ["Regular", "Preso", "Solto"],
          },
          { id: "dislikes", label: "Alimentos que não come de jeito nenhum", type: "text" },
        ],
      },
    ],
  },
  dentistry: {
    id: "dentistry",
    title: "Anamnese odontológica",
    intro: "Algumas perguntas de saúde são importantes para a segurança do seu tratamento.",
    sections: [
      contactSection,
      healthSection,
      {
        title: "Saúde bucal",
        fields: [
          { id: "bleeding", label: "Sua gengiva sangra ao escovar?", type: "yesno" },
          { id: "sensitivity", label: "Tem sensibilidade nos dentes?", type: "yesno" },
          { id: "anesthesia", label: "Já teve reação à anestesia?", type: "yesno" },
          { id: "pregnant", label: "Está grávida ou amamentando?", type: "yesno" },
          { id: "last_visit", label: "Quando foi sua última consulta?", type: "text" },
        ],
      },
    ],
  },
  aesthetics: {
    id: "aesthetics",
    title: "Ficha de avaliação",
    intro: "Precisamos saber de algumas condições antes do procedimento.",
    sections: [
      contactSection,
      healthSection,
      {
        title: "Pele",
        fields: [
          {
            id: "skin_type",
            label: "Tipo de pele",
            type: "radio",
            options: ["Seca", "Normal", "Mista", "Oleosa", "Não sei"],
          },
          { id: "sunscreen", label: "Usa protetor solar diariamente?", type: "yesno" },
          { id: "acids", label: "Usa ácidos ou retinoides?", type: "yesno" },
          { id: "pregnant", label: "Está grávida ou amamentando?", type: "yesno" },
        ],
      },
    ],
  },
  general: {
    id: "general",
    title: "Anamnese",
    intro: "Preencha antes do atendimento. Suas respostas ficam protegidas e só a equipe que te atende vê.",
    sections: [
      contactSection,
      healthSection,
      {
        title: "Hábitos",
        fields: [
          { id: "smoker", label: "Fuma?", type: "yesno" },
          {
            id: "activity",
            label: "Atividade física",
            type: "radio",
            options: ["Sedentário", "1 a 2x por semana", "3x ou mais por semana"],
          },
          { id: "surgeries", label: "Cirurgias anteriores", type: "text" },
        ],
      },
    ],
  },
} satisfies Record<string, Template>

export type TemplateId = keyof typeof TEMPLATES

const BY_VERTICAL: Partial<Record<VerticalId, TemplateId>> = {
  psychology: "psychology",
  nutrition: "nutrition",
  dentistry: "dentistry",
  aesthetics: "aesthetics",
  beauty: "aesthetics",
}

export function templateForVertical(vertical: VerticalId): Template {
  return TEMPLATES[BY_VERTICAL[vertical] ?? "general"]
}

export function getTemplate(id: string): Template {
  return (TEMPLATES as Record<string, Template>)[id] ?? TEMPLATES.general
}

export function isVisible(field: Field, answers: Answers) {
  return !field.showIf || answers[field.showIf.field] === field.showIf.equals
}

/**
 * Normaliza e valida respostas vindas de um formulário público: descarta campos
 * desconhecidos ou ocultos, limita tamanhos e confere opções e obrigatórios.
 */
export function validateAnswers(
  template: Template,
  raw: Record<string, unknown>,
): { ok: true; answers: Answers } | { ok: false; errors: Record<string, string> } {
  const answers: Answers = {}
  const errors: Record<string, string> = {}
  const fields = template.sections.flatMap((s) => s.fields)

  // Primeiro coleta valores (showIf depende de outros campos).
  for (const f of fields) {
    const value = raw[f.id]
    if (f.type === "multi") {
      const list = (Array.isArray(value) ? value : []).map(String).filter((v) => f.options?.includes(v))
      if (list.length) answers[f.id] = [...new Set(list)]
      continue
    }
    if (typeof value !== "string" && typeof value !== "number") continue
    const text = String(value)
      .trim()
      .slice(0, f.type === "textarea" ? 4000 : 300)
    if (!text) continue
    if ((f.type === "radio" || f.type === "yesno") && !(f.options ?? ["Sim", "Não"]).includes(text)) {
      errors[f.id] = "Opção inválida."
      continue
    }
    if (f.type === "number" && !Number.isFinite(Number(text.replace(",", ".")))) {
      errors[f.id] = "Informe um número."
      continue
    }
    answers[f.id] = f.type === "number" ? text.replace(",", ".") : text
  }

  for (const f of fields) {
    if (!isVisible(f, answers)) {
      delete answers[f.id]
      continue
    }
    if (f.required && !answers[f.id] && !errors[f.id]) errors[f.id] = "Campo obrigatório."
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers }
}

export function formatAnswer(field: Field, value: string | string[] | undefined) {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return null
  if (Array.isArray(value)) return value.join(", ")
  return field.unit ? `${value} ${field.unit}` : value
}
