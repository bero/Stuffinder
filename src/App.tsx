import Router, { Route } from 'preact-router';
import { Home } from './pages/Home';
import { AddItem } from './pages/AddItem';
import { Settings } from './pages/Settings';
import { ItemDetail } from './pages/ItemDetail';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { AuthCallback } from './pages/AuthCallback';
import { Onboarding } from './pages/Onboarding';
import { NavBar } from './components/NavBar';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useSession, useMemberships, useActiveHousehold } from './lib/auth';

function FullscreenLoader() {
  return (
    <div class="min-h-screen flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
    </div>
  );
}

export function App() {
  const { session, loading: sessionLoading } = useSession();

  if (sessionLoading) return <FullscreenLoader />;

  if (!session) {
    return (
      <>
        <Router>
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/signup" component={Signup} />
          <Route default component={Login} />
        </Router>
        <UpdatePrompt />
      </>
    );
  }

  return <AuthedApp session={session} />;
}

function AuthedApp({ session }: { session: import('@supabase/supabase-js').Session }) {
  const { memberships, loading, reload } = useMemberships(session);
  const { activeId, select } = useActiveHousehold(memberships);

  if (loading) return <FullscreenLoader />;

  if (memberships.length === 0) {
    return <Onboarding onDone={reload} />;
  }

  if (!activeId) return <FullscreenLoader />;

  return (
    <div class="min-h-screen flex flex-col safe-top safe-bottom">
      <main class="flex-1 pb-20">
        <Router>
          <Route path="/" component={Home} activeHouseholdId={activeId} />
          <Route path="/add" component={AddItem} activeHouseholdId={activeId} />
          <Route path="/item/:id" component={ItemDetail} activeHouseholdId={activeId} />
          <Route
            path="/settings"
            component={Settings}
            activeHouseholdId={activeId}
            memberships={memberships}
            onSelectHousehold={select}
            onHouseholdChange={reload}
          />
        </Router>
      </main>
      <NavBar />
      <UpdatePrompt />
    </div>
  );
}
