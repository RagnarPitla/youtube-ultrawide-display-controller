import UrlInput from './components/UrlInput'
import PreviewBox from './components/PreviewBox'
import PanControls from './components/PanControls'
import ZoomSlider from './components/ZoomSlider'
import TransportBar from './components/TransportBar'
import { useControlIpc } from './hooks/useIpc'
import { useTransform } from './hooks/useTransform'

export default function App() {
  const { playbackState, isPlayerReady, isSignedIn } = useControlIpc()
  const { transform, setScale, pan, resetCenter, resetAll } = useTransform()

  return (
    <div className="flex flex-col gap-4 h-full bg-[#1a1a2e] py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-bold text-white">Rbuild.ai Breath App</h1>
          <p className="text-xs text-gray-500">
            Output: 2880 x 960 · {' '}
            {isPlayerReady ? (
              <span className="text-green-400">Player ready</span>
            ) : (
              <span className="text-yellow-400">Waiting for player...</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <>
              <span className="text-xs text-green-400">Signed in</span>
              <button
                onClick={() => window.controlAPI.signOut()}
                className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => window.controlAPI.openYouTubeLogin()}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              Sign in to YouTube
            </button>
          )}
        </div>
      </div>

      {/* URL Input */}
      <UrlInput />

      {/* Preview */}
      <PreviewBox transform={transform} onPan={pan} />

      {/* Pan + Zoom controls */}
      <div className="flex items-start gap-2">
        <PanControls onPan={pan} onResetCenter={resetCenter} onResetAll={resetAll} />
        <ZoomSlider scale={transform.scale} onScaleChange={setScale} />
      </div>

      {/* Transport */}
      <div className="mt-auto">
        <TransportBar playbackState={playbackState} />
      </div>
    </div>
  )
}
