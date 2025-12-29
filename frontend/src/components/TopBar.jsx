import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

export default function TopBar({ user, role }) {
  const navigate = useNavigate();

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
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:inline text-sm text-gray-600">
                {user.email}
              </span>
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
