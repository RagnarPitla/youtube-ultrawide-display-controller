import { app, BrowserWindow, screen, session, ipcMain } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'

let controlWindow: BrowserWindow | null = null
let displayWindow: BrowserWindow | null = null
let loginWindow: BrowserWindow | null = null

// Use a persistent partition so YouTube cookies/login survive restarts
const YOUTUBE_PARTITION = 'persist:youtube'

function createWindows(): void {
  // Create a persistent session for YouTube content
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION)

  // Control window - standard window for the operator
  controlWindow = new BrowserWindow({
    width: 850,
    height: 750,
    title: 'Rbuild.ai Breath App',
    webPreferences: {
      preload: join(__dirname, '../preload/control.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Display window - frameless, meant for external ultrawide monitor
  displayWindow = new BrowserWindow({
    width: 2880,
    height: 960,
    frame: false,
    resizable: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/display.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      partition: YOUTUBE_PARTITION
    }
  })

  // Try to position display window on external monitor
  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()
  const externalDisplay = displays.find(
    (d) => d.id !== primaryDisplay.id
  )
  if (externalDisplay) {
    displayWindow.setPosition(
      externalDisplay.bounds.x,
      externalDisplay.bounds.y
    )
  }

  // Register IPC relay between windows
  registerIpcHandlers(controlWindow, displayWindow)

  // Handle sign-in request from control window
  ipcMain.on('open-youtube-login', () => {
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.focus()
      return
    }

    loginWindow = new BrowserWindow({
      width: 900,
      height: 700,
      title: 'Sign in to YouTube',
      parent: controlWindow || undefined,
      webPreferences: {
        partition: YOUTUBE_PARTITION,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    loginWindow.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/')

    loginWindow.on('closed', () => {
      loginWindow = null
      // Notify control window that login window was closed
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('login-window-closed')
      }
    })

    // Detect when user reaches YouTube (login complete)
    loginWindow.webContents.on('did-navigate', (_event, url) => {
      if (url.startsWith('https://www.youtube.com')) {
        if (controlWindow && !controlWindow.isDestroyed()) {
          controlWindow.webContents.send('login-success')
        }
        // Close login window after a short delay
        setTimeout(() => {
          if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.close()
          }
        }, 1500)
      }
    })
  })

  // Handle sign-out request
  ipcMain.on('youtube-sign-out', async () => {
    await youtubeSession.clearStorageData()
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('signed-out')
    }
  })

  // Load renderer pages
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    controlWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/control/`)
    displayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/display/`)
  } else {
    controlWindow.loadFile(join(__dirname, '../renderer/control/index.html'))
    displayWindow.loadFile(join(__dirname, '../renderer/display/index.html'))
  }

  // Close both windows together
  controlWindow.on('closed', () => {
    controlWindow = null
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.close()
    }
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close()
    }
  })

  displayWindow.on('closed', () => {
    displayWindow = null
  })
}

app.whenReady().then(() => {
  createWindows()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
