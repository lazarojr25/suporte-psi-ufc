import React from 'react';
import useDashboardData from './Dashboard/hooks/useDashboardData';
import DashboardView from './Dashboard/components/DashboardView';

export default function Dashboard() {
  const { user } = useDashboardData();

  return user ? <DashboardView /> : <div>Carregando...</div>;
}
