import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@animekaiser/ui/components/input-group"
import { Eye, EyeOff, LockKeyhole } from "lucide-react"
import { type ComponentProps, useState } from "react"

export function PasswordInput(props: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false)

  return (
    <InputGroup className={props.className}>
      <InputGroupAddon>
        <LockKeyhole />
      </InputGroupAddon>
      <InputGroupInput
        {...props}
        className={undefined}
        type={visible ? "text" : "password"}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          size="icon-xs"
        >
          {visible ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
