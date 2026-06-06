import React, { useState, useEffect } from 'react';
import LeaderboardTables from './LeaderboardTables';

export default function DashboardHome() {
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPartidas = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/partidas');
        if (!res.ok) throw new Error('No se pudo establecer enlace con la telemetría central.');
        const data = await res.json();
        setPartidas(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPartidas();
  }, []);

  if (loading) {
    return (
      <div className="font-mono-label text-primary animate-pulse text-[12px] py-8">
        &gt; RENDERING_MATRIX_LEADERBOARDS...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-error/30 bg-error-container/10 font-mono-label text-[12px] text-on-error">
        [!] CRITICAL_DASHBOARD_ERROR: {error}
      </div>
    );
  }

  return <LeaderboardTables partidas={partidas} />;
}
