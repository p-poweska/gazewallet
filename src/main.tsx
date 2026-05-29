import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import App from './App'
import { requestPersistentStorage } from './lib/store'
import { applyAccent, loadAccent } from './lib/theme'
import './index.css'

applyAccent(loadAccent())

const DAY = 1000 * 60 * 60 * 24

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min świeżości — w tym oknie używa cache
      gcTime: DAY,
      // Auto-odświeżanie: co 5 min w tle oraz po powrocie do karty (jeśli nieświeże).
      refetchInterval: 1000 * 60 * 5,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 15000),
    },
  },
})

// Cache zapisywany w localStorage — po reloadzie saldo widać natychmiast,
// bez ponownego odpytywania mempool.space (chroni też przed 429).
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'gazewallet:rq:v2',
})

void requestPersistentStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: DAY }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>,
)
