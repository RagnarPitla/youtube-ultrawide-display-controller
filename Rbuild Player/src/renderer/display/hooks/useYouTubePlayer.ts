import { useEffect, useRef, useCallback } from 'react'
import type { PlaybackCommand, PlaybackState } from '../../../shared/types'

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
    displayAPI: {
      onLoadVideo: (cb: (videoId: string) => void) => () => void
      onPlaybackCommand: (cb: (cmd: PlaybackCommand) => void) => () => void
      onTransformUpdate: (cb: (t: { scale: number; translateX: number; translateY: number }) => void) => () => void
      sendPlaybackState: (state: PlaybackState) => void
      sendPlayerReady: () => void
    }
  }
}

export function useYouTubePlayer(containerId: string) {
  const playerRef = useRef<YT.Player | null>(null)
  const pollIntervalRef = useRef<number | null>(null)
  const apiReadyRef = useRef(false)
  const pendingVideoRef = useRef<string | null>(null)

  const sendState = useCallback(() => {
    const player = playerRef.current
    if (!player || typeof player.getCurrentTime !== 'function') return
    try {
      const state: PlaybackState = {
        currentTime: player.getCurrentTime(),
        duration: player.getDuration() || 0,
        isPlaying: player.getPlayerState() === YT.PlayerState.PLAYING
      }
      window.displayAPI.sendPlaybackState(state)
    } catch {
      // Player not ready yet
    }
  }, [])

  const createPlayer = useCallback((videoId: string) => {
    // Destroy existing player
    if (playerRef.current) {
      try { playerRef.current.destroy() } catch { /* ignore */ }
      playerRef.current = null
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    // Re-create the container div (YT.Player replaces it with an iframe)
    const existing = document.getElementById(containerId)
    if (existing) {
      const parent = existing.parentElement!
      const newDiv = document.createElement('div')
      newDiv.id = containerId
      parent.replaceChild(newDiv, existing)
    }

    playerRef.current = new YT.Player(containerId, {
      width: '3840',
      height: '2160',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1
      },
      events: {
        onReady: () => {
          window.displayAPI.sendPlayerReady()
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = window.setInterval(sendState, 250)
        },
        onStateChange: () => {
          sendState()
        },
        onError: (event: YT.OnErrorEvent) => {
          console.error('YouTube Player error:', event.data)
        }
      }
    })
  }, [containerId, sendState])

  useEffect(() => {
    // Load YouTube IFrame API script
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }

    window.onYouTubeIframeAPIReady = () => {
      apiReadyRef.current = true
      // If a video was requested before API was ready, load it now
      if (pendingVideoRef.current) {
        createPlayer(pendingVideoRef.current)
        pendingVideoRef.current = null
      }
    }

    // If YT is already loaded (hot reload)
    if (window.YT && window.YT.Player) {
      apiReadyRef.current = true
    }

    // Listen for video load commands from control window
    const unsubVideo = window.displayAPI.onLoadVideo((videoId: string) => {
      if (apiReadyRef.current) {
        createPlayer(videoId)
      } else {
        // API not ready yet, queue it
        pendingVideoRef.current = videoId
      }
    })

    // Listen for playback commands
    const unsubPlayback = window.displayAPI.onPlaybackCommand((cmd: PlaybackCommand) => {
      const player = playerRef.current
      if (!player || typeof player.playVideo !== 'function') return
      switch (cmd.type) {
        case 'play':
          player.playVideo()
          break
        case 'pause':
          player.pauseVideo()
          break
        case 'seek':
          player.seekTo(cmd.time, true)
          break
        case 'seekRelative':
          player.seekTo(player.getCurrentTime() + cmd.delta, true)
          break
      }
    })

    return () => {
      unsubVideo()
      unsubPlayback()
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
      }
    }
  }, [containerId, createPlayer])
}
