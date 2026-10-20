export const hasAiMention = (text: string) =>
  /(^|\s)@ai(?=\s|[.,!?;:]|$)/i.test(text)

export const mentionQueryAt = (text: string, caret: number) => {
  const before = text.slice(0, caret)
  const match = /(?:^|\s)@([^\s@]*)$/.exec(before)
  return match
    ? { start: caret - match[1].length - 1, end: caret, query: match[1] }
    : null
}

export const memberMention = (member: {
  username: string | null
  displayName: string
}) => member.username ?? member.displayName.replaceAll(/\s+/g, "_")
