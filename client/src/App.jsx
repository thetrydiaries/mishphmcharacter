import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Upload from './pages/Upload'
import Compositor from './pages/Compositor'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/compositor" element={<Compositor />} />
    </Routes>
  )
}

export default App
