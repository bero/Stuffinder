import Router, { Route } from 'preact-router';
import { Home } from './pages/Home';
import { AddItem } from './pages/AddItem';
import { Settings } from './pages/Settings';
import { ItemDetail } from './pages/ItemDetail';
import { NavBar } from './components/NavBar';

export function App() {
  return (
    <div class="min-h-screen flex flex-col safe-top safe-bottom">
      <main class="flex-1 pb-20">
        <Router>
          <Route path="/" component={Home} />
          <Route path="/add" component={AddItem} />
          <Route path="/item/:id" component={ItemDetail} />
          <Route path="/settings" component={Settings} />
        </Router>
      </main>
      <NavBar />
    </div>
  );
}
