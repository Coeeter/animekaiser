import { Atom } from "@effect-atom/atom-react"

export const searchOpenAtom = Atom.make(false)

export const searchShortcutAtom = Atom.make((get) => {
  const keydown = (event: KeyboardEvent) => {
    const target = event.target
    const editing =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

    if (
      event.key !== "/" ||
      editing ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return

    event.preventDefault()
    get.set(searchOpenAtom, true)
  }

  window.addEventListener("keydown", keydown)
  get.addFinalizer(() => window.removeEventListener("keydown", keydown))
})
