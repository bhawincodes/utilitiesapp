import { StrictMode } from 'react'
import { Provider } from 'react-redux';
import { store } from './store/store';
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import About from './pages/About'
import Workhours from './features/workhours/Workhours.jsx'
import App from './App.jsx'
import ToonParser from './features/toonparser/toonparser.jsx'
import AuthCallback from './AuthCallback.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/toonparser" element={<ToonParser />} />
          <Route path="/workhours" element={<Workhours />} />
          <Route path="/*" element={<App />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
