# Kaiser

Kaiser is an anime streaming platform that combines external anime catalog data, user library management, and stream resolution into a single product experience.

## Language

**Anime**:
A canonical anime title or work in Kaiser, identified by its MAL ID. Descriptive data for the anime may come from MAL, AniList, Jikan, or other sources.
_Avoid_: Local anime record, AniList anime

**Anime ID**:
The MAL ID used as Kaiser's canonical identifier for an anime.
_Avoid_: Local anime ID, internal anime ID

**Library Entry**:
A user's Kaiser record for one Anime, containing the user's status, progress, score, and notes.
_Avoid_: Watchlist item, external list item

**Job**:
A durable work item used to track background work such as library imports and external list syncs.
_Avoid_: Task, background task

**Library Conflict**:
A disagreement between a user's Kaiser Library Entry and an external list value that requires the user to choose a resolution.
_Avoid_: Sync error, merge error

**Streaming Provider Anime ID**:
A provider-specific identifier that maps an Anime to its corresponding title on a streaming provider.
_Avoid_: Stream ID, episode ID, playable source
