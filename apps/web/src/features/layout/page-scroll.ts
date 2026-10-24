import * as Atom from "effect/reactivity/Atom"

export const pageScrollAtom = Atom.make((get) => {
  let lastY = window.scrollY
  const onScroll = () => {
    const y = window.scrollY
    if (Math.abs(y - lastY) < 8) return
    get.setSelf({
      scrollingDown: y > lastY && y > 56,
      belowFirstScreen: y > window.innerHeight / 2,
    })
    lastY = y
  }
  window.addEventListener("scroll", onScroll, { passive: true })
  get.addFinalizer(() => window.removeEventListener("scroll", onScroll))
  return { scrollingDown: false, belowFirstScreen: false }
})
