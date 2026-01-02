import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

export default function TopBar({ user, role }) {
  const navigate = useNavigate();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (e) {
      console.error('Erro ao sair:', e);
    }
  };

  const linkBase =
    'px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition';
  const linkActive = 'bg-gray-100 text-gray-900';
  const linkInactive = 'text-gray-700';
  const isAdmin = role === 'admin';

  useEffect(() => {
    const handler = (e) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <header className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-gray-900">
              Sistema de Apoio Psicológico
            </span>

            <nav className="hidden sm:flex items-center gap-2">
              <NavLink
                to="/agenda"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Agenda
              </NavLink>
              <NavLink
                to="/gerenciar-solicitacoes"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Solicitações
              </NavLink>
              <NavLink
                to="/sessoes"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Sessões
              </NavLink>
              <NavLink
                to="/discentes"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Discentes
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:inline text-sm text-gray-600">
                {user.email}
              </span>
            )}

            {user && (
              <div className="relative" ref={adminMenuRef}>
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen((v) => !v)}
                  className="px-3 py-2 text-sm font-semibold border rounded-md text-gray-800 hover:bg-gray-50 inline-flex items-center gap-1"
                >
                  {isAdmin ? 'Admin' : 'Menu'}
                  <span className="text-xs">{adminMenuOpen ? '▲' : '▼'}</span>
                </button>
                {adminMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md border bg-white shadow-lg z-20">
                    {isAdmin && (
                      <>
                        <NavLink
                          to="/relatorios"
                          className={({ isActive }) =>
                            `block px-3 py-2 text-sm ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`
                          }
                          onClick={() => setAdminMenuOpen(false)}
                        >
                          Relatórios
                        </NavLink>
                        <NavLink
                          to="/usuarios"
                          className={({ isActive }) =>
                            `block px-3 py-2 text-sm ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`
                          }
                          onClick={() => setAdminMenuOpen(false)}
                        >
                          Usuários
                        </NavLink>
                        <div className="h-px bg-gray-100 my-1" />
                      </>
                    )}
                    <NavLink
                      to="/configuracoes"
                      className={({ isActive }) =>
                        `block px-3 py-2 text-sm ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`
                      }
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      Configurações
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {user && (
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700"
              >
                Sair
              </button>
            )}
          </div>
        </div>

        {/* navegação mobile */}
        <nav className="sm:hidden pb-3 -mx-1 px-1 overflow-x-auto">
          <div className="flex gap-2 flex-nowrap min-w-max">
            <NavLink
              to="/agenda"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              Agenda
            </NavLink>
            <NavLink
              to="/gerenciar-solicitacoes"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              Solicitações
            </NavLink>
            <NavLink
              to="/sessoes"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              Sessões
            </NavLink>
            <NavLink
              to="/discentes"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              Discentes
            </NavLink>
            {role === 'admin' && (
              <NavLink
                to="/relatorios"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Relatórios
              </NavLink>
            )}
            {role === 'admin' && (
              <NavLink
                to="/usuarios"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Usuários
              </NavLink>
            )}
            <NavLink
              to="/configuracoes"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              Configurações
            </NavLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
