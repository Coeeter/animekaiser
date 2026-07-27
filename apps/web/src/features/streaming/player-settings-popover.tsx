import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type {
  StreamAudio,
  StreamPlayback,
  StreamProviderId,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Switch } from "@workspace/ui/components/switch"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { cn } from "@workspace/ui/lib/utils"
import {
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  ListVideo,
  Play,
  Settings,
  SkipForward,
  Volume2,
} from "lucide-react"
import type { ReactNode } from "react"
import { useId, useState } from "react"
import { audioLabel, speedOptions } from "./player-format"
import {
  playerCaptionAtom,
  playerQualityAtom,
  playerQualityLevelsAtom,
  playerSpeedAtom,
  playerUiAtom,
  updatePlayerUiAtom,
} from "./player-ui-state"
import {
  playerPreferencesAtom,
  updatePlayerPreferencesAtom,
} from "./preferences"
import { SubtitleSettings } from "./subtitle-settings"

export function PlayerSettingsPopover({
  portalContainer,
  playback,
}: {
  portalContainer: HTMLElement | null
  playback: StreamPlayback
}) {
  const playerUi = useAtomValue(playerUiAtom)
  const updatePlayerUi = useAtomSet(updatePlayerUiAtom)
  const caption = useAtomValue(playerCaptionAtom)
  const setCaption = useAtomSet(playerCaptionAtom)
  const quality = useAtomValue(playerQualityAtom)
  const setQuality = useAtomSet(playerQualityAtom)
  const qualityLevels = useAtomValue(playerQualityLevelsAtom)
  const speed = useAtomValue(playerSpeedAtom)
  const setSpeed = useAtomSet(playerSpeedAtom)
  const preferences = useAtomValue(playerPreferencesAtom)
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)
  const isMobile = useIsMobile()
  const [view, setView] = useState<
    "main" | "quality" | "captions" | "speed" | "audio"
  >("main")
  const open = playerUi.settingsOpen
  const setOpen = (settingsOpen: boolean) => updatePlayerUi({ settingsOpen })
  const currentQuality =
    quality === "-1"
      ? "Auto"
      : (qualityLevels.find((level) => String(level.index) === quality)
          ?.label ?? "Auto")
  const currentCaption =
    caption === "off"
      ? "Off"
      : (playback.tracks[Number(caption)]?.label ?? "Off")
  const currentSpeed = speed === "1" ? "Normal" : `${speed}x`

  const choose = (action: () => void) => {
    action()
    setView("main")
  }

  const trigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-white hover:bg-white/10 hover:text-white"
    >
      <Settings />
      <span className="sr-only">Player settings</span>
    </Button>
  )

  const content = (
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
      {view === "main" ? (
        <div className="flex flex-col py-2">
          <PlayerPreferenceSwitch
            icon={<Play />}
            label="Autoplay"
            checked={preferences.autoplay}
            onCheckedChange={(checked) =>
              updatePreferences({ autoplay: checked })
            }
          />
          <PlayerPreferenceSwitch
            icon={<SkipForward />}
            label="Auto next"
            checked={preferences.autoNext}
            onCheckedChange={(checked) =>
              updatePreferences({ autoNext: checked })
            }
          />
          <PlayerPreferenceSwitch
            icon={<SkipForward />}
            label="Auto skip intro"
            checked={preferences.autoSkipIntro}
            onCheckedChange={(checked) =>
              updatePreferences({ autoSkipIntro: checked })
            }
          />
          <PlayerPreferenceSwitch
            icon={<SkipForward />}
            label="Auto skip outro"
            checked={preferences.autoSkipOutro}
            onCheckedChange={(checked) =>
              updatePreferences({ autoSkipOutro: checked })
            }
          />
          <PlayerPreferenceSwitch
            icon={<ListVideo />}
            label="External list sync"
            checked={preferences.syncLibraryOnFinish}
            onCheckedChange={(checked) =>
              updatePreferences({ syncLibraryOnFinish: checked })
            }
          />
          <div className="my-2 h-px bg-white/10" />
          <SettingSegmented
            label="Video fit"
            value={preferences.videoFit}
            options={[
              ["contain", "Contain"],
              ["cover", "Cover"],
              ["fill", "Fill"],
            ]}
            onValueChange={(videoFit) => updatePreferences({ videoFit })}
          />
          <div className="my-2 h-px bg-white/10" />
          <SettingNavRow
            icon={<Gauge />}
            label="Quality"
            value={currentQuality}
            onClick={() => setView("quality")}
          />
          <SettingNavRow
            icon={<Play />}
            label="Speed"
            value={currentSpeed}
            onClick={() => setView("speed")}
          />
          <SettingNavRow
            icon={<Volume2 />}
            label="Audio"
            value={audioLabel(playback.audio)}
            onClick={() => setView("audio")}
          />
          <SettingNavRow
            icon={<Captions />}
            label="Subtitles"
            value={currentCaption}
            onClick={() => setView("captions")}
          />
        </div>
      ) : null}

      {view === "quality" ? (
        <SettingsOptionPage title="Quality" onBack={() => setView("main")}>
          <SettingsOption
            label="Auto"
            selected={quality === "-1"}
            onClick={() => choose(() => setQuality("-1"))}
          />
          {qualityLevels.map((level) => (
            <SettingsOption
              key={level.index}
              label={level.label}
              selected={quality === String(level.index)}
              onClick={() => choose(() => setQuality(String(level.index)))}
            />
          ))}
        </SettingsOptionPage>
      ) : null}

      {view === "captions" ? (
        <SettingsOptionPage title="Subtitles" onBack={() => setView("main")}>
          <SettingsOption
            label="Off"
            selected={caption === "off"}
            onClick={() => choose(() => setCaption("off"))}
          />
          {playback.tracks.map((track, index) => (
            <SettingsOption
              key={`${track.file}-${index}`}
              label={track.label}
              selected={caption === String(index)}
              onClick={() => choose(() => setCaption(String(index)))}
            />
          ))}
          <div className="my-2 h-px bg-white/10" />
          <SubtitleSettings compact />
        </SettingsOptionPage>
      ) : null}

      {view === "speed" ? (
        <SettingsOptionPage title="Speed" onBack={() => setView("main")}>
          {speedOptions.map((option) => (
            <SettingsOption
              key={option}
              label={option === "1" ? "Normal" : `${option}x`}
              selected={speed === option}
              onClick={() => choose(() => setSpeed(option))}
            />
          ))}
        </SettingsOptionPage>
      ) : null}

      {view === "audio" ? (
        <SettingsOptionPage title="Audio" onBack={() => setView("main")}>
          {playback.episode.availableAudio.map((audio) => (
            <SettingsOption
              key={audio}
              label={audioLabel(audio)}
              selected={audio === playback.audio}
              watchRoute={{
                malId: playback.anime.malId,
                provider: playback.provider,
                episodeId: playback.episode.id,
                audio,
              }}
            />
          ))}
          <div className="my-2 h-px bg-white/10" />
          <SettingRange
            label="Audio enhancer"
            value={preferences.audioEnhancementPercent}
            min={100}
            max={300}
            step={25}
            valueLabel={`${preferences.audioEnhancementPercent}%`}
            onValueChange={(audioEnhancementPercent) =>
              updatePreferences({ audioEnhancementPercent })
            }
          />
        </SettingsOptionPage>
      ) : null}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          portalContainer={portalContainer}
          side="bottom"
          className="max-h-[82dvh] gap-0 overflow-hidden rounded-t-2xl border-white/10 bg-black/95 p-0 text-white shadow-2xl backdrop-blur-xl [@media_(orientation:portrait)]:max-h-[82dvw]"
        >
          <SheetTitle className="sr-only">Player settings</SheetTitle>
          <SheetDescription className="sr-only">
            Playback, audio, video, and subtitle settings.
          </SheetDescription>
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25" />
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        portalContainer={portalContainer}
        align="end"
        side="top"
        sideOffset={12}
        className="max-h-[calc(100dvh-6rem)] w-[min(23rem,calc(100vw-1.5rem))] gap-0 overflow-hidden rounded-xl border border-white/10 bg-black/90 p-0 text-white shadow-2xl ring-white/10 backdrop-blur-md md:max-h-none"
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}

function PlayerPreferenceSwitch({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ReactNode
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()

  return (
    <label
      htmlFor={id}
      className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 transition hover:bg-white/10"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-white/60">{icon}</span>
        <p className="truncate text-sm font-medium">{label}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

function SettingSegmented<TValue extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: TValue
  options: ReadonlyArray<readonly [TValue, string]>
  onValueChange: (value: TValue) => void
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex rounded-xl bg-white/10 p-1">
        {options.map(([option, optionLabel]) => (
          <button
            key={option}
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm text-white/60 transition",
              value === option && "bg-white/20 text-white"
            )}
            onClick={() => onValueChange(option)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  )
}

function SettingRange({
  label,
  value,
  min,
  max,
  step,
  valueLabel,
  onValueChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  valueLabel: string
  onValueChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-2 px-4 py-3 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="text-white/55">{valueLabel}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onValueChange(Number(event.currentTarget.value))}
        className="h-2 w-full accent-white"
      />
    </label>
  )
}

function SettingNavRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left transition hover:bg-white/10"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="text-white/60">{icon}</span>
        <span className="truncate text-sm font-medium">{label}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2 text-sm text-white/50">
        <span className="truncate">{value}</span>
        <ChevronRight />
      </span>
    </button>
  )
}

function SettingsOptionPage({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="flex min-h-11 items-center gap-2 border-b border-white/10 px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={onBack}
        >
          <ChevronLeft />
          <span className="sr-only">Back</span>
        </Button>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="flex flex-col py-2">{children}</div>
    </div>
  )
}

function SettingsOption({
  label,
  selected,
  onClick,
  watchRoute,
}: {
  label: string
  selected: boolean
  onClick?: () => void
  watchRoute?: {
    malId: number
    provider: StreamProviderId
    episodeId: string
    audio: StreamAudio
    serverId?: string | undefined
  }
}) {
  const className =
    "grid w-full grid-cols-[1.5rem_1fr] items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-white/10"
  const content = (
    <>
      <span className="text-white">{selected ? <Check /> : null}</span>
      <span>{label}</span>
    </>
  )

  if (watchRoute) {
    return (
      <Link
        to="/watch/$malId/$provider/$episodeId"
        params={{
          malId: watchRoute.malId,
          provider: watchRoute.provider,
          episodeId: watchRoute.episodeId,
        }}
        search={{ audio: watchRoute.audio, serverId: watchRoute.serverId }}
        className={className}
        aria-current={selected ? "page" : undefined}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-pressed={selected}
    >
      {content}
    </button>
  )
}
