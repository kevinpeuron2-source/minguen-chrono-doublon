
import React, { createContext, useContext, useState, useCallback } from 'react';

interface DatabaseContextType {
  dbError: string | null;
  setDbError: (error: string | null) => void;
  isPermissionDenied: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbError, setDbError] = useState<string | null>(null);

  const handleSetError = useCallback((error: string | null) => {
    setDbError(error);
  }, []);

  const isPermissionDenied = !!dbError && dbError.toLowerCase().includes('permission');

  return (
    <DatabaseContext.Provider value={{ dbError, setDbError: handleSetError, isPermissionDenied }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
