import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { username } from "better-auth/plugins"
import { db, schema } from "@/db"
import { provisionWorkspace } from "@/lib/provision"
import { RESERVED_USERNAMES, USERNAME_REGEX } from "@/lib/constants"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, defaultValue: "America/Sao_Paulo" },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Todo novo usuário ganha uma organização pessoal, uma agenda padrão
        // e tipos de evento de exemplo.
        after: async (user) => {
          await provisionWorkspace({
            id: user.id,
            name: user.name,
            username: (user.username as string | undefined) ?? user.id.slice(0, 8),
            timezone: (user.timezone as string | undefined) ?? "America/Sao_Paulo",
          })
        },
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (value) => USERNAME_REGEX.test(value) && !RESERVED_USERNAMES.has(value),
    }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
