import { render } from 'preact';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import { App } from './App';
import './index.css';

// Load a small font so flag emojis render correctly on Windows too.
polyfillCountryFlagEmojis();

render(<App />, document.getElementById('app')!);
