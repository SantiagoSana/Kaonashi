import React, { useState } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { AppProvider } from './context/AppContext';
import { Navigation } from './components/Navigation';
import { CartDrawer } from './components/CartDrawer';
import { AiConciergeDrawer } from './components/AiConciergeDrawer';

// Customer Pages
import { Home } from './pages/Home';
import { Menu } from './pages/Menu';
import { Checkout } from './pages/Checkout';
import { OrderTracking } from './pages/OrderTracking';
import { CampaignLanding } from './pages/CampaignLanding';
import { Reservations } from './pages/Reservations';
import { Rewards } from './pages/Rewards';
import { Redeem } from './pages/Redeem';
import { Unsubscribe } from './pages/Unsubscribe';
import { StaffLogin } from './pages/auth/StaffLogin';
import { CustomerLogin } from './pages/auth/CustomerLogin';
import { Account } from './pages/Account';
import { Legal } from './pages/Legal';

// Admin Pages
import { AdminLayout } from './pages/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { Kds } from './pages/admin/Kds';
import { MenuAdmin } from './pages/admin/MenuAdmin';
import { MarketingCampaigns } from './pages/admin/MarketingCampaigns';
import { QrWizard } from './pages/admin/QrWizard';
import { RedeemInPerson } from './pages/admin/RedeemInPerson';
import { BrandingAdmin } from './pages/admin/BrandingAdmin';
import { AuditViewer } from './pages/admin/AuditViewer';
import { ReservationsAdmin } from './pages/admin/ReservationsAdmin';
import { PromotionsAdmin } from './pages/admin/PromotionsAdmin';
import { DataHub } from './pages/admin/DataHub';
import { DataAnalytics } from './pages/admin/DataAnalytics';

/** The funnel view now lives in the BTL tab of the data analytics page (real SQL figures). */
function BtlAnalyticsRedirect() {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    try {
      localStorage.setItem('kns_analytics_tab', 'btl');
    } catch {}
    setLocation('/admin/analytics', { replace: true });
  }, []);
  return null;
}

export function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <AppProvider>
      <div className="min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--text))] flex flex-col font-sans">
        <Switch>
          {/* Admin Routes with AdminLayout */}
          <Route path="/admin/dashboard">
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          </Route>
          <Route path="/admin/analytics">
            <AdminLayout>
              <DataAnalytics />
            </AdminLayout>
          </Route>
          <Route path="/admin/kds">
            <AdminLayout>
              <Kds />
            </AdminLayout>
          </Route>
          <Route path="/admin/orders">
            <AdminLayout>
              <Kds />
            </AdminLayout>
          </Route>
          <Route path="/admin/reservations">
            <AdminLayout>
              <ReservationsAdmin />
            </AdminLayout>
          </Route>
          <Route path="/admin/promotions">
            <AdminLayout>
              <PromotionsAdmin />
            </AdminLayout>
          </Route>
          <Route path="/admin/data-hub">
            <AdminLayout>
              <DataHub />
            </AdminLayout>
          </Route>
          <Route path="/admin/menu">
            <AdminLayout>
              <MenuAdmin />
            </AdminLayout>
          </Route>
          <Route path="/admin/inventory">
            <AdminLayout>
              <MenuAdmin />
            </AdminLayout>
          </Route>
          <Route path="/admin/marketing/campaigns">
            <AdminLayout>
              <MarketingCampaigns />
            </AdminLayout>
          </Route>
          <Route path="/admin/marketing/qr">
            <AdminLayout>
              <QrWizard />
            </AdminLayout>
          </Route>
          <Route path="/admin/marketing/analytics">
            <BtlAnalyticsRedirect />
          </Route>
          <Route path="/admin/redeem">
            <AdminLayout>
              <RedeemInPerson />
            </AdminLayout>
          </Route>
          <Route path="/admin/settings/branding">
            <AdminLayout>
              <BrandingAdmin />
            </AdminLayout>
          </Route>
          <Route path="/admin/audit">
            <AdminLayout>
              <AuditViewer />
            </AdminLayout>
          </Route>

          {/* Standalone Login Route */}
          <Route path="/login">
            <StaffLogin />
          </Route>
          <Route path="/account/login">
            <CustomerLogin step="login" />
          </Route>
          <Route path="/account/verify">
            <CustomerLogin step="verify" />
          </Route>

          {/* Public Routes with Global Shell Navigation */}
          <Route>
            <Navigation onOpenCart={() => setIsCartOpen(true)} />
            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
            <AiConciergeDrawer />

            <div className="flex-1">
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/menu" component={Menu} />
                <Route path="/checkout" component={Checkout} />
                <Route path="/order/:id" component={OrderTracking} />
                <Route path="/c/:slug" component={CampaignLanding} />
                <Route path="/reservations" component={Reservations} />
                <Route path="/rewards" component={Rewards} />
                <Route path="/account" component={Account} />
                <Route path="/legal/privacy">
                  <Legal kind="privacy" />
                </Route>
                <Route path="/legal/terms">
                  <Legal kind="terms" />
                </Route>
                <Route path="/redeem" component={Redeem} />
                <Route path="/u/:token" component={Unsubscribe} />

                {/* Catch-all Fallback */}
                <Route>
                  <Home />
                </Route>
              </Switch>
            </div>
          </Route>
        </Switch>
      </div>
    </AppProvider>
  );
}

export default App;
