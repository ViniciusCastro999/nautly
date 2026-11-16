export const APP_NAME = "Nautly"
export const APP_TAGLINE = "Agendamentos"
export const APP_DOMAIN = "nautly.app"

export const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/** Rotas de primeiro nível que não podem virar username público. */
export const RESERVED_USERNAMES = new Set([
  "app",
  "api",
  "login",
  "signup",
  "logout",
  "booking",
  "settings",
  "admin",
  "help",
  "pricing",
  "about",
  "onboarding",
  "anamnese",
  "orcamento",
])

export const EVENT_COLORS = [
  "#1b6a8a",
  "#3f9fbf",
  "#8247f5",
  "#0ab39c",
  "#e55cff",
  "#ff4f00",
  "#ffa600",
  "#17e885",
] as const

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
export const WEEKDAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]

export const LOCATION_LABELS = {
  video: "Videochamada",
  phone: "Telefone",
  in_person: "Presencial",
} as const

export const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Bahia",
  "America/Fortaleza",
  "America/Recife",
  "America/Belem",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Rio_Branco",
  "America/Noronha",
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
]
