import { Component } from 'react';
import { useT } from '../i18n/I18nProvider';

// Catches any crash while a page renders, so one bad page can never blank the whole website.
// It clears itself when `resetKey` changes (App passes the current path), without remounting healthy pages.
function Fallback({ onRetry }) {
  const t = useT();
  return (
    <div className="center-screen" role="alert">
      <div className="card stack" style={{ maxWidth: 460, textAlign: 'center' }}>
        <h3>{t('error.title')}</h3>
        <p className="muted">{t('error.body')}</p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-gold" onClick={onRetry}>{t('error.retry')}</button>
          <a className="btn btn-ghost" href="/">{t('error.home')}</a>
        </div>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Page crashed:', error); }
  componentDidUpdate(prev) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() { return this.state.failed ? <Fallback onRetry={() => this.setState({ failed: false })} /> : this.props.children; }
}
