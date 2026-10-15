export type AnchoredPlayback = {
  playing: boolean
  positionSeconds: number
  positionAt: number
  rate: number
}

export const projectPosition = (playback: AnchoredPlayback, now: number) =>
  playback.playing
    ? Math.max(
        0,
        playback.positionSeconds +
          ((now - playback.positionAt) / 1000) * playback.rate
      )
    : playback.positionSeconds
