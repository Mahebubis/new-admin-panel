// ===========================================================================
//  Footer.jsx — the thin strip under every signed-in screen.
// ===========================================================================
import { Link } from 'react-router-dom';
import { Globe } from './icons';
import './footer.css';

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap ftr-inner">
        <div className="ftr-left">
          <span className="ftr-logo"><span className="ftr-logo-i">i</span>Studio</span>

          <button type="button" className="ftr-lang">
            <Globe size={16} /> LANGUAGES
          </button>

          <Link to="/about" className="ftr-link">About Us</Link>
        </div>

        <div className="ftr-right">
          <span className="ftr-badge">
            <span className="ftr-badge-mark">iS</span>
            <span className="ftr-badge-text">
              <em>Powered by</em>
              <strong>INTERNSHIP STUDIO</strong>
            </span>
          </span>
        </div>
      </div>

      <div className="wrap ftr-copy">Copyright © {new Date().getFullYear()} iStudio</div>
    </footer>
  );
}
