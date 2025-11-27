import React from 'react'
import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 text-xl font-semibold">MyNeedsApp</div>
          <nav className="space-x-4">
            <Link to="/" className="text-gray-700 hover:text-gray-900">Home</Link>
            <Link to="/about" className="text-gray-700 hover:text-gray-900">About</Link>
            <Link to="/toonparser" className="text-gray-700 hover:text-gray-900">Toon Parser</Link>
            <Link to="/workhours" className="text-gray-700 hover:text-gray-900">Workhours</Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
