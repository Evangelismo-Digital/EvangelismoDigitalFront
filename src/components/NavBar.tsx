import { useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom'
import styles from './css/NavBar.module.css';

/** Home page sections, in page order; `id` is the `?section=` value HomePage scrolls to. */
const NAV_SECTIONS = [
  { id: 'artigos', label: 'Artigos' },
  { id: 'recursos', label: 'Recursos' },
  { id: 'quem-somos', label: 'Quem somos' },
  { id: 'contato', label: 'Contato' },
  { id: 'encontre-uma-igreja', label: 'Encontre uma igreja' },
] as const;

const DEFAULT_SECTION = 'artigos';

const NavBar = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const section = params.get("section");
  const togglerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // On small screens the expanded menu would cover the section it just scrolled to: fold it back,
  // through Bootstrap's own toggler so its state and aria-expanded stay in sync.
  // Stryker disable OptionalChaining: both elements are always rendered, so the refs are always set
  const closeMenu = () => {
    if (menuRef.current?.classList.contains('show')) {
      togglerRef.current?.click();
    }
  };
  // Stryker restore OptionalChaining

  return (
    <nav className={`navbar navbar-expand-lg fixed-top bg-white ${styles.navbar}`}>
        <div className="container-fluid">
            <NavLink
                className="nav-link"
                aria-current="page"
                to="/?section=artigos"
            >
                <img src="/FaithTech Logo Text - Grey Orange (1) 1.png" alt="FaithTech" style={{maxHeight: "30px"}}/>
            </NavLink>
                
            <button ref={togglerRef} className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
            </button>
            <div ref={menuRef} className="collapse navbar-collapse justify-content-center" id="navbarNav">
                <ul className="navbar-nav">
                    {NAV_SECTIONS.map(({ id, label }) => {
                        const active = location.pathname === "/" && (section ?? DEFAULT_SECTION) === id;
                        return (
                            <li key={id} className="nav-item">
                                {/* NavLink ignores the query, so it would mark every section as current on "/". */}
                                <NavLink
                                    className={active ? `nav-link ${styles['active-navlink']}` : "nav-link"}
                                    aria-current={active ? "page" : "false"}
                                    to={`/?section=${id}`}
                                    onClick={closeMenu}
                                >
                                    {label}
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    </nav>
  )
}

export default NavBar;