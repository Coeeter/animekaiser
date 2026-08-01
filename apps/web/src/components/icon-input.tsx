import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@animekaiser/ui/components/input-group"
import type { LucideIcon } from "lucide-react"
import type { ComponentProps } from "react"

export function IconInput({
  icon: Icon,
  ...props
}: ComponentProps<"input"> & { icon: LucideIcon }) {
  return (
    <InputGroup className={props.className}>
      <InputGroupAddon>
        <Icon />
      </InputGroupAddon>
      <InputGroupInput {...props} className={undefined} />
    </InputGroup>
  )
}
