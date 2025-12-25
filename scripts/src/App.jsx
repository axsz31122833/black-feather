import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import PassengerHome from './pages/PassengerHome.jsx'
import PassengerRidePage from './pages/PassengerRidePage.jsx'
import DriverHome from './pages/DriverHome.jsx'
import DriverRidePage from './pages/DriverRidePage.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <div className="brand">Black Feather 車隊</div>
        <nav className="nav">
          <Link to="/login">登入</Link>
          <Link to="/passenger">乘客</Link>
          <Link to="/passenger/ride">乘客行程</Link>
          <Link to="/driver">司機</Link>
          <Link to="/driver/ride">司機行程</Link>
          <Link to="/admin">管理端</Link>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/passenger" element={<PassengerHome />} />
          <Route path="/passenger/ride" element={<PassengerRidePage />} />
          <Route path="/driver" element={<DriverHome />} />
          <Route path="/driver/ride" element={<DriverRidePage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
