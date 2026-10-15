import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed break-words">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _, ...props }) => (
            <h3 className="mt-1 text-base font-semibold" {...props} />
          ),
          h2: ({ node: _, ...props }) => (
            <h3 className="mt-1 text-base font-semibold" {...props} />
          ),
          h3: ({ node: _, ...props }) => (
            <h4 className="mt-1 font-semibold" {...props} />
          ),
          h4: ({ node: _, ...props }) => (
            <h4 className="mt-1 font-semibold" {...props} />
          ),
          ul: ({ node: _, ...props }) => (
            <ul className="flex list-disc flex-col gap-1 pl-5" {...props} />
          ),
          ol: ({ node: _, ...props }) => (
            <ol className="flex list-decimal flex-col gap-1 pl-5" {...props} />
          ),
          a: ({ node: _, ...props }) => (
            <a
              className="underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          blockquote: ({ node: _, ...props }) => (
            <blockquote
              className="border-l-2 pl-3 text-muted-foreground"
              {...props}
            />
          ),
          code: ({ node: _, ...props }) => (
            <code
              className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
              {...props}
            />
          ),
          pre: ({ node: _, ...props }) => (
            <pre
              className="overflow-x-auto rounded-xl bg-muted p-3 [&>code]:bg-transparent [&>code]:p-0"
              {...props}
            />
          ),
          table: ({ node: _, ...props }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left" {...props} />
            </div>
          ),
          th: ({ node: _, ...props }) => (
            <th className="border-b px-2 py-1 font-semibold" {...props} />
          ),
          td: ({ node: _, ...props }) => (
            <td className="border-b px-2 py-1" {...props} />
          ),
          hr: ({ node: _, ...props }) => <hr className="my-1" {...props} />,
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}
