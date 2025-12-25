import React from 'react';
import { useWindowControls } from '../../hooks/useTauri';

const TitleBar: React.FC = () => {
  const { minimize, toggleMaximize, close, isTauri } = useWindowControls();

  if (!isTauri) return null;

  return (
    <div
      className="h-8 flex items-center justify-between bg-[#1e1f22] select-none"
      data-tauri-drag-region
    >
      {/* macOS style traffic lights */}
      <div className="flex items-center pl-3 gap-2" data-tauri-drag-region>
        <button
          onClick={close}
          className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-90 transition-all"
        />
        <button
          onClick={minimize}
          className="w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-90 transition-all"
        />
        <button
          onClick={toggleMaximize}
          className="w-3 h-3 rounded-full bg-[#28c840] hover:brightness-90 transition-all"
        />
      </div>

      {/* Title */}
      <div
        className="absolute left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-400"
        data-tauri-drag-region
      >
        Helix
      </div>

      <div className="w-20" />
    </div>
  );
};

export default TitleBar;
