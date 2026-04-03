import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Compositor from './pages/Compositor'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/compositor" element={<Compositor />} />
    </Routes>
  )
}

export default App
