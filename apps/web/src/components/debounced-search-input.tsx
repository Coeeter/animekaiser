import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@animekaiser/ui/components/input-group"
import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useDebouncedText } from "../hooks/use-debounced-text"

const defaultDebounceMs = 300

export function DebouncedSearchInput({
  committed,
  onCommit,
  placeholder,
  label,
  debounceMs = defaultDebounceMs,
  className,
}: {
  committed: string
  onCommit: (query: string | undefined) => void
  placeholder: string
  label: string
  debounceMs?: number
  className?: string
}) {
  const [value, setValue] = useState(committed)
  const debounced = useDebouncedText(value.trim(), debounceMs)

  useEffect(() => {
    if (debounced === committed) return
    onCommit(debounced || undefined)
  }, [committed, debounced])

  return (
    <InputGroup className={className ?? "h-11 md:h-9"}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {value.length > 0 ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setValue("")}
            aria-label="Clear search"
          >
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
