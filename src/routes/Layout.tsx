import NavBar from '../components/NavBar'
import { Outlet } from 'react-router-dom'
import Footer from '../components/Footer'
import CookieConsentBanner from '../components/CookieConsentBanner'
import AnalyticsConsentProvider from '../analytics/AnalyticsConsentProvider'
import AnalyticsRouteTracker from '../analytics/AnalyticsRouteTracker'
import styles from './css/Layout.module.css'

const Layout = () => {
  return (
    <AnalyticsConsentProvider>
        <AnalyticsRouteTracker />
        <NavBar />
        <div className={`container ${styles.content}`}>
          <Outlet />
        </div>
        <Footer />
        <CookieConsentBanner />
    </AnalyticsConsentProvider>
  )
}

export default Layout
