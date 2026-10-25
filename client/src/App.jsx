import { Routes, Route } from 'react-router-dom'
import { CompositorProvider } from './context/CompositorProvider'
import Home from './pages/Home'
import Upload from './pages/Upload'
import Review from './pages/Review'
import Compositor from './pages/Compositor'

function App() {
  return (
    <CompositorProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/review" element={<Review />} />
        <Route path="/compositor" element={<Compositor />} />
      </Routes>
    </CompositorProvider>
  )
}

export default App
