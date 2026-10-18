import type { SocialUser } from "@animekaiser/domain"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@animekaiser/ui/components/avatar"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { UserRound } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { DataError } from "../../components/data-error"
import { DebouncedSearchInput } from "../../components/debounced-search-input"
import { PageHero } from "../../components/page-hero"
import { friendsAtom, searchUsersAtom } from "./atoms"
import { FriendActionButtons } from "./friend-button"

export function FriendsPage() {
  const [query, setQuery] = useState("")
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 pb-8 md:p-6">
      <PageHero
        icon={UserRound}
        kicker="Social"
        title="Friends"
        description="Friends can invite each other to rooms. Being friends doesn't share your private profile, list, or AI chats."
      />
      <section className="flex flex-col gap-3">
        <DebouncedSearchInput
          committed={query}
          onCommit={(value) => setQuery(value ?? "")}
          placeholder="Find people by username"
          label="Find people by username"
        />
        {query.trim().length >= 2 ? (
          <SearchResults query={query.trim()} />
        ) : null}
      </section>
      <FriendLists />
    </div>
  )
}

function SearchResults({ query }: { query: string }) {
  const result = useAtomValue(searchUsersAtom(query))
  return AsyncResult.builder(result)
    .onInitialOrWaiting(() => <Skeleton className="h-16 rounded-2xl" />)
    .onFailure(() => (
      <p className="text-sm text-muted-foreground">Search failed. Try again.</p>
    ))
    .onSuccess((users) =>
      users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one found. Private profiles only appear for their exact username.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {users.map((user) => (
            <PersonRow key={user.id} user={user}>
              <FriendActionButtons userId={user.id} relation={user.relation} />
            </PersonRow>
          ))}
        </ul>
      )
    )
    .render()
}

function FriendLists() {
  const result = useAtomValue(friendsAtom)
  const refresh = useAtomRefresh(friendsAtom)
  return AsyncResult.builder(result)
    .onInitialOrWaiting(() => <Skeleton className="h-40 rounded-3xl" />)
    .onFailure(() => (
      <DataError title="Unable to load friends" onRetry={refresh} />
    ))
    .onSuccess((overview) => (
      <>
        {overview.incoming.length > 0 ? (
          <Group title={`Requests (${overview.incoming.length})`}>
            {overview.incoming.map((user) => (
              <PersonRow key={user.id} user={user}>
                <FriendActionButtons userId={user.id} relation="incoming" />
              </PersonRow>
            ))}
          </Group>
        ) : null}
        <Group title={`Friends (${overview.friends.length})`}>
          {overview.friends.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              Search for people by username to add friends.
            </p>
          ) : (
            overview.friends.map((user) => (
              <PersonRow key={user.id} user={user}>
                <FriendActionButtons userId={user.id} relation="friends" />
              </PersonRow>
            ))
          )}
        </Group>
        {overview.outgoing.length > 0 ? (
          <Group title="Sent requests">
            {overview.outgoing.map((user) => (
              <PersonRow key={user.id} user={user}>
                <FriendActionButtons userId={user.id} relation="outgoing" />
              </PersonRow>
            ))}
          </Group>
        ) : null}
      </>
    ))
    .render()
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  )
}

function PersonRow({
  user,
  children,
}: {
  user: SocialUser
  children: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl px-2 py-2">
      <Avatar className="size-10">
        {user.image ? <AvatarImage src={user.image} alt="" /> : null}
        <AvatarFallback>
          {user.displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        {user.username ? (
          <Link
            to="/u/$username"
            params={{ username: user.username }}
            className="block truncate font-medium hover:underline"
          >
            {user.displayName}
          </Link>
        ) : (
          <span className="block truncate font-medium">{user.displayName}</span>
        )}
        {user.username ? (
          <span className="text-xs text-muted-foreground">
            @{user.username}
          </span>
        ) : null}
      </div>
      {children}
    </li>
  )
}
