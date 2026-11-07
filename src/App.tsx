import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { NavBar } from './components/NavBar'
import { CookieBanner } from './components/CookieBanner'
import HomePage from './pages/HomePage'
import ListingsPage from './pages/ListingsPage'
import ListingDetailPage from './pages/ListingDetailPage'
import ListPropertyPage from './pages/ListPropertyPage'
import AuctionPage from './pages/AuctionPage'
import AboutPage from './pages/AboutPage'
import ImpressumPage from './pages/ImpressumPage'
import DatenschutzPage from './pages/DatenschutzPage'
import QuizPage from './pages/QuizPage'
import MortgagePage from './pages/MortgagePage'
import BuyingGuidePage from './pages/BuyingGuidePage'
import MarketPage from './pages/MarketPage'
import NotFoundPage from './pages/NotFoundPage'
import { useRouteCanonical } from './utils/seo'
import ProcessGuidePage from './pages/guide/ProcessGuidePage'
import TaxesGuidePage from './pages/guide/TaxesGuidePage'
import LoanGuidePage from './pages/guide/LoanGuidePage'
import DoeblingGuidePage from './pages/guide/DoeblingGuidePage'
import StudentsGuidePage from './pages/guide/StudentsGuidePage'

export default function App() {
  useRouteCanonical()

  return (
    <>
      <Routes>
        {/* Auction page: full-screen with fixed nav offset */}
        <Route path="/auction"     element={<><NavBar /><AuctionPage /></>} />

        {/* Standard pages */}
        <Route path="/"            element={<><NavBar /><HomePage /></>} />
        <Route path="/listings"      element={<><NavBar /><ListingsPage /></>} />
        <Route path="/listings/:id"  element={<><NavBar /><ListingDetailPage /></>} />
        <Route path="/list-property" element={<><NavBar /><ListPropertyPage /></>} />
        <Route path="/about"       element={<><NavBar /><AboutPage /></>} />
        <Route path="/impressum"   element={<><NavBar /><ImpressumPage /></>} />
        <Route path="/datenschutz" element={<><NavBar /><DatenschutzPage /></>} />

        {/* Tools */}
        <Route path="/quiz"          element={<><NavBar /><QuizPage /></>} />
        <Route path="/mortgage"      element={<><NavBar /><MortgagePage /></>} />
        <Route path="/buying-guide"  element={<><NavBar /><BuyingGuidePage /></>} />
        <Route path="/buying-guide/process"     element={<><NavBar /><ProcessGuidePage /></>} />
        <Route path="/buying-guide/taxes"       element={<><NavBar /><TaxesGuidePage /></>} />
        <Route path="/buying-guide/loan"        element={<><NavBar /><LoanGuidePage /></>} />
        <Route path="/buying-guide/doebling-19" element={<><NavBar /><DoeblingGuidePage /></>} />
        <Route path="/buying-guide/students"    element={<><NavBar /><StudentsGuidePage /></>} />
        <Route path="/market"        element={<><NavBar /><MarketPage /></>} />

        <Route path="*"              element={<><NavBar /><NotFoundPage /></>} />
      </Routes>

      {/* Cookie consent — rendered outside Routes so it appears on every page */}
      <CookieBanner />

      {/* Vercel Web Analytics — privacy-friendly pageview tracking,
          GDPR compliant (no cookies). Dashboard:
          https://vercel.com/<team>/vienna-auction-dashboard/analytics */}
      <Analytics />
    </>
  )
}
