import React from 'react';
import { Outlet } from 'react-router-dom';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import { isTauri } from '../../hooks/useTauri';

const AppShell: React.FC = () => {
  const inTauri = isTauri();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#1e1f22]">
      {/* Title Bar (Tauri only) */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className={`flex-1 bg-[#f8f5f2] overflow-hidden ${inTauri ? 'rounded-tl-xl' : ''}`}>
          <div className="h-full overflow-y-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
