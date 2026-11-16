import {
  ActivityIcon,
  AppleIcon,
  BrainIcon,
  BriefcaseIcon,
  ScissorsIcon,
  SparklesIcon,
  StethoscopeIcon,
  type LucideProps,
} from "lucide-react"
import type { VerticalId } from "@/lib/verticals"

function ToothIcon(props: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M7 3c-2.2 0-4 1.8-4 4.2 0 2 .9 3.4 1.5 5 .7 1.9.8 4 1.3 6 .4 1.7 1 2.8 2 2.8 1.5 0 1.6-2.4 2-4.3.3-1.4.9-2.2 2.2-2.2s1.9.8 2.2 2.2c.4 1.9.5 4.3 2 4.3 1 0 1.6-1.1 2-2.8.5-2 .6-4.1 1.3-6 .6-1.6 1.5-3 1.5-5C21 4.8 19.2 3 17 3c-1.8 0-2.9 1-5 1S8.8 3 7 3Z" />
    </svg>
  )
}

const ICONS: Record<VerticalId, React.ComponentType<LucideProps>> = {
  psychology: BrainIcon,
  nutrition: AppleIcon,
  dentistry: ToothIcon,
  medicine: StethoscopeIcon,
  physiotherapy: ActivityIcon,
  beauty: ScissorsIcon,
  aesthetics: SparklesIcon,
  other: BriefcaseIcon,
}

export function VerticalIcon({ vertical, ...props }: { vertical: VerticalId } & LucideProps) {
  const Icon = ICONS[vertical]
  return <Icon {...props} />
}
